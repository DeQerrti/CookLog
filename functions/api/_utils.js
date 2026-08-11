// ═══════════════════════════════════════════════════════════════════════
//  Общие хелперы для всех API-функций
// ═══════════════════════════════════════════════════════════════════════

export function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

function toBase64Url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function getKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

// Подписываем payload (например { exp: timestamp }) секретом из env.SESSION_SECRET
export async function sign(payload, secret) {
  const key = await getKey(secret);
  const payloadB64 = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
  return `${payloadB64}.${toBase64Url(sig)}`;
}

// Достаём cookie cl_session из запроса и проверяем подпись + срок годности
export async function verifyAuth(request, env) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const match = cookieHeader.match(/(?:^|;\s*)cl_session=([^;]+)/);
  if (!match) return false;

  const [payloadB64, sigB64] = match[1].split('.');
  if (!payloadB64 || !sigB64) return false;

  try {
    const key = await getKey(env.SESSION_SECRET);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      fromBase64Url(sigB64),
      new TextEncoder().encode(payloadB64)
    );
    if (!valid) return false;

    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(payloadB64)));
    return typeof payload.exp === 'number' && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export function safeParseArray(s) {
  try {
    const v = JSON.parse(s || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// Сравнение строк за постоянное время — чтобы длина времени ответа
// не давала подсказок о том, сколько символов пароля угадано верно.
export function timingSafeEqual(a, b) {
  const aBytes = new TextEncoder().encode(String(a ?? ''));
  const bBytes = new TextEncoder().encode(String(b ?? ''));
  const len = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < len; i++) {
    diff |= (aBytes[i] || 0) ^ (bBytes[i] || 0);
  }
  return diff === 0;
}

export function rowToRecipe(r) {
  return {
    ...r,
    ingredients: safeParseArray(r.ingredients),
    steps: safeParseArray(r.steps),
    tags: safeParseArray(r.tags),
  };
}
