import { jsonResponse, verifyAuth, rowToRecipe, sanitizeUrl } from '../_utils.js';

// GET /api/recipes — публичный список всех рецептов
export async function onRequestGet({ env }) {
  const { results } = await env.DB
    .prepare('SELECT * FROM recipes ORDER BY created_at DESC')
    .all();

  return jsonResponse((results || []).map(rowToRecipe));
}

// POST /api/recipes — создать рецепт (только для авторизованного админа)
export async function onRequestPost({ request, env }) {
  const authed = await verifyAuth(request, env);
  if (!authed) return jsonResponse({ error: 'Unauthorized' }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Некорректный JSON' }, 400);
  }

  const title = (body.title || '').trim();
  if (!title) return jsonResponse({ error: 'Название обязательно' }, 400);

  const result = await env.DB.prepare(
    `INSERT INTO recipes
      (title, image_url, type, method, time_minutes, ingredients, steps, tags, source_label, source_url, emoji)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    title,
    sanitizeUrl(body.image_url),
    body.type || null,
    body.method || null,
    body.time_minutes ?? null,
    JSON.stringify(body.ingredients || []),
    JSON.stringify(body.steps || []),
    JSON.stringify(body.tags || []),
    body.source_label || null,
    sanitizeUrl(body.source_url),
    body.emoji || null
  ).run();

  return jsonResponse({ id: result.meta.last_row_id }, 201);
}
