import { jsonResponse, verifyAuth } from '../_utils.js';

// PUT /api/recipes/:id — обновить рецепт (только для авторизованного админа)
export async function onRequestPut({ request, env, params }) {
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

  await env.DB.prepare(
    `UPDATE recipes SET
      title = ?, image_url = ?, type = ?, method = ?, time_minutes = ?,
      ingredients = ?, steps = ?, tags = ?, source_label = ?, source_url = ?, emoji = ?
     WHERE id = ?`
  ).bind(
    title,
    body.image_url || null,
    body.type || null,
    body.method || null,
    body.time_minutes ?? null,
    JSON.stringify(body.ingredients || []),
    JSON.stringify(body.steps || []),
    JSON.stringify(body.tags || []),
    body.source_label || null,
    body.source_url || null,
    body.emoji || null,
    params.id
  ).run();

  return jsonResponse({ ok: true });
}

// DELETE /api/recipes/:id — удалить рецепт (только для авторизованного админа)
export async function onRequestDelete({ request, env, params }) {
  const authed = await verifyAuth(request, env);
  if (!authed) return jsonResponse({ error: 'Unauthorized' }, 401);

  await env.DB.prepare('DELETE FROM recipes WHERE id = ?').bind(params.id).run();
  return jsonResponse({ ok: true });
}
