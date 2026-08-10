import { jsonResponse, verifyAuth } from '../_utils.js';

// POST /api/recipes/import
// body: { url, text }  — ссылка на рецепт + скопированный текст описания
// Нужна переменная окружения ANTHROPIC_API_KEY
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

  if (!env.ANTHROPIC_API_KEY) {
    return jsonResponse({ error: 'ANTHROPIC_API_KEY не задан в секретах' }, 500);
  }

  const prompt = `Ты помощник по разбору рецептов. Пользователь прислал текст/описание рецепта.
Извлеки из него данные и верни строго JSON без лишнего текста и без markdown-блоков.

Формат:
{
  "title": "Название блюда",
  "type": "Тип (Суп/Второе/Завтрак/Десерт/Перекус/Салат/Напиток или null)",
  "method": "Способ (Жарка/Варка/Запекание/Тушение/Без готовки/Гриль/Пар или null)",
  "time_minutes": число или null,
  "ingredients": ["ингредиент 1 с количеством", "ингредиент 2", ...],
  "steps": ["Шаг 1", "Шаг 2", ...],
  "tags": ["тег1", "тег2"],
  "emoji": "🍳",
  "source_label": "название источника или null",
  "source_url": "${url || null}"
}

${url ? `Ссылка на источник: ${url}` : ''}
Текст рецепта:
${text}`;

  let parsed;
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return jsonResponse({ error: `Claude API error: ${resp.status}`, detail: err }, 502);
    }

    const data = await resp.json();
    const raw  = data.content?.[0]?.text || '';
    // убираем возможные ```json блоки
    const clean = raw.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
    parsed = JSON.parse(clean);
  } catch (e) {
    return jsonResponse({ error: 'Не удалось разобрать ответ Claude', detail: String(e) }, 502);
  }

  return jsonResponse({ recipe: parsed });
}
