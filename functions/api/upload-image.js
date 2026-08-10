import { jsonResponse, verifyAuth } from './_utils.js';

// POST /api/upload-image
// multipart/form-data: file (image), filename (optional)
// Нужны секреты: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO
export async function onRequestPost({ request, env }) {
  const authed = await verifyAuth(request, env);
  if (!authed) return jsonResponse({ error: 'Unauthorized' }, 401);

  const missing = ['GITHUB_TOKEN','GITHUB_OWNER','GITHUB_REPO'].filter(k => !env[k]);
  if (missing.length) {
    return jsonResponse({ error: `Не заданы секреты: ${missing.join(', ')}` }, 500);
  }

  let formData;
  try { formData = await request.formData(); }
  catch { return jsonResponse({ error: 'Ожидался multipart/form-data' }, 400); }

  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return jsonResponse({ error: 'Файл не найден в запросе' }, 400);
  }

  // Сжимаем через Canvas API нет возможности в worker, поэтому просто проверяем размер
  const MAX_SIZE = 4 * 1024 * 1024; // 4 МБ — лимит GitHub API
  const arrayBuf = await file.arrayBuffer();
  if (arrayBuf.byteLength > MAX_SIZE) {
    return jsonResponse({ error: 'Файл слишком большой (максимум 4 МБ). Сожми фото перед загрузкой.' }, 413);
  }

  // base64
  const bytes   = new Uint8Array(arrayBuf);
  const base64  = btoa(String.fromCharCode(...bytes));

  // имя файла
  const ext = (file.name || 'photo.jpg').split('.').pop().toLowerCase();
  const safeName = `${Date.now()}.${ext}`;
  const path = `images/${safeName}`;

  // коммит через GitHub Contents API
  const apiUrl = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}`;
  const ghResp = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'CookLog/1.0',
    },
    body: JSON.stringify({
      message: `feat: add recipe photo ${safeName}`,
      content: base64,
    }),
  });

  if (!ghResp.ok) {
    const err = await ghResp.json().catch(() => ({}));
    return jsonResponse({ error: 'GitHub API error', detail: err.message || ghResp.status }, 502);
  }

  const ghData  = await ghResp.json();
  const rawUrl  = ghData.content?.download_url || '';

  // Заменяем raw.githubusercontent.com на jsDelivr для лучшей доступности
  const cdnUrl = rawUrl.replace(
    'https://raw.githubusercontent.com/',
    'https://cdn.jsdelivr.net/gh/'
  ).replace(`/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/`, `/${env.GITHUB_OWNER}/${env.GITHUB_REPO}@main/`);

  // jsDelivr не знает о только что закоммиченном файле, пока его не попросят
  // обновить кэш — без этого свежая картинка может не открываться некоторое время.
  // Просим jsDelivr сразу подтянуть новый файл (не блокируем ответ пользователю при ошибке).
  try {
    await fetch(`https://purge.jsdelivr.net/gh/${env.GITHUB_OWNER}/${env.GITHUB_REPO}@main/${path}`);
  } catch { /* не критично -- файл всё равно станет доступен по jsDelivr со временем */ }

  return jsonResponse({ url: cdnUrl || rawUrl, path });
}
