import { jsonResponse, verifyAuth } from '../_utils.js';

// POST /api/recipes/import
// body: { url, text }
// Парсит текст рецепта без внешних платных API — полностью бесплатно.
// Если дана ссылка — сначала пробуем реально её открыть и достать данные:
//  1) структурированную разметку schema.org/Recipe (есть на большинстве кулинарных сайтов)
//  2) meta description / og:description (работает для YouTube/Instagram/TikTok,
//     где рецепт обычно в подписи под видео)
// Если ничего не нашли — используем то, что человек вставил вручную сам.
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

  let fetchNote     = null;
  let jsonLdRecipe  = null;
  let fetchedText   = '';

  if (url) {
    const page = await fetchPageData(url);
    if (page.error) {
      fetchNote = page.error;
    } else {
      jsonLdRecipe = findRecipeJsonLd(page.jsonLdBlocks);
      fetchedText  = page.meta.description || page.meta.ogDescription || '';
    }
  }

  let recipe;

  if (jsonLdRecipe) {
    // Нашли структурированные данные рецепта — это самый надёжный источник
    recipe = recipeFromJsonLd(jsonLdRecipe, url);
    // Если в разметке почему-то не оказалось ингредиентов/шагов — подстрахуемся
    // тем, что человек вставил вручную
    if (!recipe.ingredients.length && !recipe.steps.length && text) {
      const fallback = parseRecipeText(text, url);
      recipe.ingredients = fallback.ingredients;
      recipe.steps = fallback.steps;
      if (!recipe.time_minutes) recipe.time_minutes = fallback.time_minutes;
    }
  } else {
    const combinedText = [text, fetchedText].filter(Boolean).join('\n\n');
    if (!combinedText) {
      return jsonResponse({
        error: fetchNote
          ? `${fetchNote}. Вставь текст рецепта вручную.`
          : 'Не нашёл рецепт по ссылке (нет разметки и описания) — вставь текст вручную.',
      }, 422);
    }
    recipe = parseRecipeText(combinedText, url);
  }

  return jsonResponse({ recipe, fetch_note: fetchNote });
}

// ═══════════════════════════════════════════════════════════════════════
//  ЗАГРУЗКА СТРАНИЦЫ ПО ССЫЛКЕ
// ═══════════════════════════════════════════════════════════════════════

async function fetchPageData(url) {
  let parsed;
  try {
    parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) throw new Error('bad protocol');
  } catch {
    return { error: 'Некорректная ссылка' };
  }

  let resp;
  try {
    resp = await fetch(parsed.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CookLogBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
  } catch {
    return { error: 'Не удалось открыть ссылку' };
  }

  if (!resp.ok) return { error: `Сайт ответил ошибкой ${resp.status}` };

  const contentType = resp.headers.get('content-type') || '';
  if (!contentType.includes('html')) return { error: 'По ссылке не HTML-страница' };

  const jsonLdBlocks = [];
  const meta = {};

  class JsonLdCollector {
    constructor() { this.buf = ''; }
    text(chunk) {
      this.buf += chunk.text;
      if (chunk.lastInTextNode) {
        if (this.buf.trim()) jsonLdBlocks.push(this.buf);
        this.buf = '';
      }
    }
  }

  class MetaCollector {
    element(el) {
      const key = (el.getAttribute('name') || el.getAttribute('property') || '').toLowerCase();
      const content = el.getAttribute('content');
      if (!key || !content) return;
      if (key === 'description')    meta.description = content;
      if (key === 'og:description') meta.ogDescription = content;
    }
  }

  try {
    // Прогоняем поток страницы через HTMLRewriter — .text() в конце
    // заставляет его реально дойти до конца и вызвать обработчики выше
    await new HTMLRewriter()
      .on('script[type="application/ld+json"]', new JsonLdCollector())
      .on('meta', new MetaCollector())
      .transform(resp)
      .text();
  } catch {
    return { error: 'Не удалось разобрать страницу' };
  }

  return { jsonLdBlocks, meta };
}

// ─── Ищем объект Recipe в JSON-LD блоках ─────────────────────────────
function findRecipeJsonLd(blocks) {
  for (const block of blocks) {
    let data;
    try { data = JSON.parse(block); } catch { continue; }
    const found = searchForRecipe(data);
    if (found) return found;
  }
  return null;
}

function searchForRecipe(node) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = searchForRecipe(item);
      if (found) return found;
    }
    return null;
  }
  const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
  if (types.some(t => typeof t === 'string' && t.toLowerCase() === 'recipe')) return node;
  if (node['@graph']) return searchForRecipe(node['@graph']);
  return null;
}

// ─── Строим рецепт из объекта schema.org/Recipe ──────────────────────
function recipeFromJsonLd(obj, sourceUrl) {
  const title = cleanText(obj.name) || 'Рецепт';

  const ingredients = toArray(obj.recipeIngredient || obj.ingredients)
    .map(cleanText)
    .filter(Boolean);

  const steps = extractInstructions(obj.recipeInstructions);

  const time_minutes =
    durationToMinutes(obj.totalTime) ||
    durationToMinutes(obj.cookTime)  ||
    durationToMinutes(obj.prepTime)  ||
    extractTime(title + ' ' + steps.join(' ')) ||
    null;

  const image_url = extractImage(obj.image);

  const bagOfText = title + ' ' + ingredients.join(' ') + ' ' + steps.join(' ');
  const type   = guessType(bagOfText, title);
  const method = guessMethod(bagOfText, steps.join(' '));
  const tags   = extractTags(ingredients, title);
  const emoji  = guessEmoji(type, title);

  return {
    title, type, method, time_minutes,
    ingredients, steps, tags, emoji,
    image_url,
    source_label: sourceUrl ? domainLabel(sourceUrl) : null,
    source_url: sourceUrl || null,
  };
}

function toArray(v) {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function cleanText(s) {
  if (!s) return '';
  return String(s).replace(/\s+/g, ' ').trim();
}

// recipeInstructions бывает: строкой, массивом строк, массивом HowToStep,
// или массивом HowToSection с вложенными шагами
function extractInstructions(instr) {
  if (!instr) return [];
  if (typeof instr === 'string') {
    return instr.split(/\r?\n+/).map(cleanText).filter(Boolean);
  }
  if (Array.isArray(instr)) {
    const steps = [];
    for (const item of instr) {
      if (typeof item === 'string') {
        const t = cleanText(item);
        if (t) steps.push(t);
        continue;
      }
      if (!item || typeof item !== 'object') continue;
      if (item['@type'] === 'HowToSection' && Array.isArray(item.itemListElement)) {
        steps.push(...extractInstructions(item.itemListElement));
      } else if (item.text) {
        const t = cleanText(item.text);
        if (t) steps.push(t);
      } else if (item.name) {
        const t = cleanText(item.name);
        if (t) steps.push(t);
      }
    }
    return steps;
  }
  return [];
}

function extractImage(img) {
  if (!img) return null;
  if (typeof img === 'string') return img;
  if (Array.isArray(img)) return extractImage(img[0]);
  if (typeof img === 'object') return img.url || null;
  return null;
}

// ISO 8601 duration ("PT1H20M") → минуты
function durationToMinutes(iso) {
  if (!iso || typeof iso !== 'string') return null;
  const m = iso.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!m) return null;
  const days  = parseInt(m[1] || 0, 10);
  const hours = parseInt(m[2] || 0, 10);
  const mins  = parseInt(m[3] || 0, 10);
  const total = days * 24 * 60 + hours * 60 + mins;
  return total > 0 ? total : null;
}

// ═══════════════════════════════════════════════════════════════════════
//  ПАРСЕР ТЕКСТА РЕЦЕПТА (когда нет структурированной разметки)
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
