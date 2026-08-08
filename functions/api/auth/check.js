import { jsonResponse, verifyAuth } from '../_utils.js';

export async function onRequestGet({ request, env }) {
  const authed = await verifyAuth(request, env);
  return jsonResponse({ authed });
}
