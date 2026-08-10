import { jsonResponse, verifyAuth } from '../_utils.js';

// POST /api/recipes/import
// body: { url, text }
// Парсит текст рецепта без внешних API — полностью бесплатно
export async function onRequestPost({ request, env }) {
  const authed = await verifyAuth(request, env);
  if (!authed) return jsonResponse({ error: 'Unauthorized' }, 401);

  let body;
  try { body = await request.json(); }
  catch { return jsonResponse({ error: 'Некорректный JSON' }, 400); }

  const text = (body.text || '').trim();
  const url  = (body.url  || '').trim();

  if (!text && !url) {
    return jsonResponse({ error: 'Нужен текст или ссылка' }, 400);
  }

  const recipe = parseRecipeText(text, url);
  return jsonResponse({ recipe });
}

// ═══════════════════════════════════════════════════════════════════════
//  ПАРСЕР РЕЦЕПТОВ
// ═══════════════════════════════════════════════════════════════════════

function parseRecipeText(text, sourceUrl = '') {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // ─── Название ───────────────────────────────────────────
  // Берём первую непустую строку которая не похожа на ингредиент/шаг
  const title = findTitle(lines);

  // ─── Секции ─────────────────────────────────────────────
  const { ingredientLines, stepLines } = splitSections(lines);

  // ─── Ингредиенты ────────────────────────────────────────
  const ingredients = ingredientLines
    .map(cleanIngredientLine)
    .filter(Boolean);

  // ─── Шаги ───────────────────────────────────────────────
  const steps = stepLines
    .map(cleanStepLine)
    .filter(Boolean);

  // ─── Время ──────────────────────────────────────────────
  const time_minutes = extractTime(text);

  // ─── Тип блюда ──────────────────────────────────────────
  const type = guessType(text, title);

  // ─── Способ ─────────────────────────────────────────────
  const method = guessMethod(text, steps.join(' '));

  // ─── Теги из ингредиентов ───────────────────────────────
  const tags = extractTags(ingredients, title);

  // ─── Эмодзи ─────────────────────────────────────────────
  const emoji = guessEmoji(type, title);

  // ─── Источник ───────────────────────────────────────────
  const source_url   = sourceUrl || null;
  const source_label = sourceUrl ? domainLabel(sourceUrl) : null;

  return {
    title,
    type,
    method,
    time_minutes,
    ingredients,
    steps,
    tags,
    emoji,
    image_url: null,
    source_label,
    source_url,
  };
}

// ─── Находим заголовок ──────────────────────────────────────────────
function findTitle(lines) {
  const skipPatterns = [
    /^ингредиент/i, /^состав/i, /^приготовлен/i, /^шаги/i,
    /^способ/i, /^рецепт/i, /^\d+[\.\)]/,
    /^[-—•*]/,  /^\d+\s*(г|гр|кг|мл|л|ст|стакан|шт|зуб)/i,
  ];
  for (const line of lines) {
    if (line.length < 3 || line.length > 120) continue;
    if (skipPatterns.some(p => p.test(line))) continue;
    // если строка не выглядит как ингредиент (нет цифры в начале + единицы)
    if (!/^\d/.test(line) || !/\d\s*(г|мл|кг|л|шт|ст\.?л|ч\.?л)/i.test(line)) {
      return capitalize(line.replace(/^#+\s*/, '').replace(/[*_]/g, ''));
    }
  }
  return 'Рецепт';
}

// ─── Разбиваем текст на секции ──────────────────────────────────────
function splitSections(lines) {
  const INGREDIENT_HEADERS = /^(ингредиент|состав|нам понадоб|продукт|для\s+(теста|соуса|начинки|маринада))/i;
  const STEP_HEADERS       = /^(приготовлен|шаги|способ|как готовить|инструкц|пошагов|рецепт|метод)/i;

  let mode = 'unknown'; // unknown | ingredients | steps
  const ingredientLines = [];
  const stepLines = [];

  // Счётчики для эвристики
  let numberedCount = 0;
  let bulletCount   = 0;

  for (const line of lines) {
    if (INGREDIENT_HEADERS.test(line)) { mode = 'ingredients'; continue; }
    if (STEP_HEADERS.test(line))       { mode = 'steps';       continue; }

    // Автодетект по виду строки
    const isNumberedStep  = /^\d+[\.\)]\s+\S/.test(line) && line.length > 15;
    const isBullet        = /^[-—•*]\s+/.test(line);
    const looksIngredient = /^\d/.test(line) && /\d\s*(г|гр|кг|мл|л|ст|стакан|шт|зуб|щепот|пучок|ч\.?л|ст\.?л)/i.test(line);

    if (isNumberedStep)   numberedCount++;
    if (isBullet)         bulletCount++;

    if (mode === 'ingredients') {
      ingredientLines.push(line);
    } else if (mode === 'steps') {
      stepLines.push(line);
    } else {
      // Эвристика когда нет явных заголовков
      if (looksIngredient) {
        ingredientLines.push(line);
      } else if (isNumberedStep) {
        stepLines.push(line);
      } else if (isBullet) {
        // пули могут быть ингредиентами или шагами — смотрим по длине
        if (line.length < 60) ingredientLines.push(line);
        else stepLines.push(line);
      } else {
        // длинные строки без маркеров → вероятно шаги
        if (line.length > 80) stepLines.push(line);
      }
    }
  }

  // Если шагов не нашли но есть длинные строки в ingredients — переносим
  if (!stepLines.length && ingredientLines.some(l => l.length > 80)) {
    const moved = ingredientLines.filter(l => l.length > 80);
    moved.forEach(l => {
      ingredientLines.splice(ingredientLines.indexOf(l), 1);
      stepLines.push(l);
    });
  }

  return { ingredientLines, stepLines };
}

// ─── Чистим строку ингредиента ──────────────────────────────────────
function cleanIngredientLine(line) {
  return line
    .replace(/^[-—•*]\s*/, '')   // убираем маркеры
    .replace(/^#+\s*/, '')
    .trim();
}

// ─── Чистим строку шага ─────────────────────────────────────────────
function cleanStepLine(line) {
  return line
    .replace(/^\d+[\.\)]\s*/, '')  // убираем "1. " "2) "
    .replace(/^[-—•*]\s*/, '')
    .replace(/^#+\s*/, '')
    .trim();
}

// ─── Время приготовления ────────────────────────────────────────────
function extractTime(text) {
  // "45 минут", "1 час 20 минут", "30 мин", "1,5 часа"
  const patterns = [
    { re: /(\d+)\s*час[а-я]*\s*(\d+)\s*мин/i,   fn: m => parseInt(m[1]) * 60 + parseInt(m[2]) },
    { re: /(\d+)[,.](\d+)\s*час/i,               fn: m => Math.round((parseInt(m[1]) + parseInt(m[2]) / 10) * 60) },
    { re: /(\d+)\s*час[а-я]*/i,                  fn: m => parseInt(m[1]) * 60 },
    { re: /(\d+)\s*мин(?:ут)?[а-я]*/i,           fn: m => parseInt(m[1]) },
  ];
  for (const { re, fn } of patterns) {
    const m = text.match(re);
    if (m && fn(m) > 0 && fn(m) < 600) return fn(m);
  }
  return null;
}

// ─── Тип блюда ──────────────────────────────────────────────────────
function guessType(text, title) {
  const t = (text + ' ' + title).toLowerCase();
  if (/суп|борщ|щи|уха|бульон|рассольник|солянк|похлебк/.test(t)) return 'Суп';
  if (/завтрак|каша|овсян|блин|оладь|яичниц|омлет|тост/.test(t))  return 'Завтрак';
  if (/десерт|торт|пирог|печень|кекс|брауни|мусс|желе|мороженое|конфет|трюфел/.test(t)) return 'Десерт';
  if (/салат|винегрет/.test(t))  return 'Салат';
  if (/смузи|коктейл|морс|компот|лимонад|напиток/.test(t)) return 'Напиток';
  if (/перекус|снэк|закуск|бутерброд/.test(t)) return 'Перекус';
  return 'Второе';
}

// ─── Способ приготовления ───────────────────────────────────────────
function guessMethod(text, steps) {
  const t = (text + ' ' + steps).toLowerCase();
  if (/духовк|запека|запечь|запекать|противень/.test(t))           return 'Запекание';
  if (/гриль|решетк|барбекю|bbq/.test(t))                          return 'Гриль';
  if (/пар[уе]|пароварк/.test(t))                                  return 'Пар';
  if (/туши|тушить|тушение|тушеный/.test(t))                       return 'Тушение';
  if (/вар[иуе]|варить|кипяти|кипятить|отвар/.test(t))             return 'Варка';
  if (/жар[иуе]|жарить|обжар|сковород|фритюр/.test(t))             return 'Жарка';
  if (/без.{0,10}готов|не.{0,5}готов|сыр[оы][ей]/.test(t))        return 'Без готовки';
  return null;
}

// ─── Теги из ингредиентов ───────────────────────────────────────────
function extractTags(ingredients, title) {
  const tags = new Set();
  const all  = (ingredients.join(' ') + ' ' + title).toLowerCase();

  const keyMap = [
    ['курица', 'курица'], ['говядина', 'говядина'], ['свинина', 'свинина'],
    ['фарш', 'фарш'], ['рыба', 'рыба'], ['лосось', 'лосось'], ['тунец', 'тунец'],
    ['креветк', 'морепродукты'], ['кальмар', 'морепродукты'],
    ['макарон', 'паста'], ['спагетти', 'паста'], ['паста', 'паста'],
    ['рис', 'рис'], ['гречк', 'гречка'], ['картофел', 'картофель'], ['картошк', 'картофель'],
    ['яйц', 'яйца'], ['сыр', 'сыр'], ['творог', 'творог'],
    ['грибы', 'грибы'], ['шампиньон', 'грибы'],
    ['томат', 'томаты'], ['помидор', 'томаты'],
    ['чеснок', 'чеснок'], ['лук', 'лук'],
    ['молоко', 'молочное'], ['сливки', 'молочное'], ['масло слив', 'молочное'],
  ];

  for (const [pat, tag] of keyMap) {
    if (all.includes(pat)) tags.add(tag);
  }

  return [...tags].slice(0, 6);
}

// ─── Эмодзи ─────────────────────────────────────────────────────────
function guessEmoji(type, title) {
  const t = (title || '').toLowerCase();
  if (/паст|макарон|спагетти/.test(t)) return '🍝';
  if (/пицц/.test(t))    return '🍕';
  if (/суп|борщ|щи/.test(t)) return '🍲';
  if (/салат/.test(t))   return '🥗';
  if (/блин|оладь/.test(t)) return '🥞';
  if (/торт|пирог|кекс/.test(t)) return '🎂';
  if (/яйц|омлет/.test(t))  return '🍳';
  if (/рис/.test(t))     return '🍚';
  if (/суши|ролл/.test(t))  return '🍣';
  if (/бургер/.test(t))  return '🍔';
  if (type === 'Суп')    return '🍲';
  if (type === 'Завтрак') return '🍳';
  if (type === 'Десерт') return '🍰';
  if (type === 'Салат')  return '🥗';
  if (type === 'Напиток') return '🥤';
  return '🍽️';
}

// ─── Домен как label источника ───────────────────────────────────────
function domainLabel(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    // Красивые имена для популярных сайтов
    const known = {
      'youtube.com': 'YouTube', 'youtu.be': 'YouTube',
      'tiktok.com': 'TikTok',
      'instagram.com': 'Instagram',
      'povarenok.ru': 'Поваренок',
      'eda.ru': 'Еда.ру',
      'gastronom.ru': 'Гастроном',
      'russianfood.com': 'Russian Food',
    };
    return known[host] || host;
  } catch {
    return null;
  }
}

function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
