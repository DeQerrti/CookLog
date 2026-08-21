import { jsonResponse, sign, timingSafeEqual } from '../_utils.js';

const THIRTY_DAYS_MS = 1000 * 60 * 60 * 24 * 30;

// Защита от подбора пароля: не больше MAX_ATTEMPTS неудачных попыток за WINDOW_MS
// с одного IP, иначе блокируем этот IP на LOCK_MS.
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 1000 * 60 * 15;
const LOCK_MS   = 1000 * 60 * 15;

export async function onRequestPost({ request, env }) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const now = Date.now();

  const row = await env.DB.prepare('SELECT * FROM login_attempts WHERE ip = ?').bind(ip).first();

  if (row && row.locked_until && row.locked_until > now) {
    return jsonResponse({ error: 'Слишком много попыток. Попробуй позже.' }, 429);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Некорректный запрос' }, 400);
  }

  const password = body.password || '';
  const passwordOk = env.ADMIN_PASSWORD && timingSafeEqual(password, env.ADMIN_PASSWORD);

  if (!passwordOk) {
    // Сбрасываем окно, если оно уже истекло, иначе увеличиваем счётчик попыток.
    const windowExpired = !row || (now - row.first_attempt_at > WINDOW_MS);
    const attempts = windowExpired ? 1 : row.attempts + 1;
    const firstAttemptAt = windowExpired ? now : row.first_attempt_at;
    const lockedUntil = attempts >= MAX_ATTEMPTS ? now + LOCK_MS : null;

    await env.DB.prepare(
      `INSERT INTO login_attempts (ip, attempts, first_attempt_at, locked_until)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(ip) DO UPDATE SET
         attempts = excluded.attempts,
         first_attempt_at = excluded.first_attempt_at,
         locked_until = excluded.locked_until`
    ).bind(ip, attempts, firstAttemptAt, lockedUntil).run();

    return jsonResponse({ error: 'Неверный пароль' }, 401);
  }

  if (row) {
    await env.DB.prepare('DELETE FROM login_attempts WHERE ip = ?').bind(ip).run();
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
