import { jsonResponse, sign } from '../_utils.js';

const THIRTY_DAYS_MS = 1000 * 60 * 60 * 24 * 30;

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Некорректный запрос' }, 400);
  }

  const password = body.password || '';

  // Простое сравнение достаточно для личного pet-проекта с одним админом.
  if (!env.ADMIN_PASSWORD || password !== env.ADMIN_PASSWORD) {
    return jsonResponse({ error: 'Неверный пароль' }, 401);
  }

  const token = await sign({ exp: Date.now() + THIRTY_DAYS_MS }, env.SESSION_SECRET);

  return jsonResponse(
    { ok: true },
    200,
    {
      'Set-Cookie':
        `cl_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${THIRTY_DAYS_MS / 1000}`,
    }
  );
}
