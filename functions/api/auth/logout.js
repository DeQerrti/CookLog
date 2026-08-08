import { jsonResponse } from '../_utils.js';

export async function onRequestPost() {
  return jsonResponse(
    { ok: true },
    200,
    { 'Set-Cookie': 'cl_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0' }
  );
}
