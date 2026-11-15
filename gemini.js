// Vercel Serverless Function: /api/gemini
// Gemini API түлхүүрийг серверт нууцлан хадгалж, хөтчөөс ирсэн хүсэлтийг
// Google руу дамжуулна. Түлхүүр: Vercel → Settings → Environment Variables → GEMINI_API_KEY

import { readJsonBody, send } from './_lib/http.js';
import { isPaywallEnabled } from './_lib/qpay.js';
import { requireUser, getOrCreateUser, accessState, consumeAiUsage } from './_lib/account.js';

const MAX_PROMPT_CHARS = 8000;
const MAX_SYSTEM_CHARS = 4000;
const UPSTREAM_TIMEOUT_MS = 25000;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return send(res, 500, { error: 'GEMINI_API_KEY тохируулаагүй байна.' });
  }

  // Төлбөрийн систем асаалттай бол: нэвтэрсэн, эрх хүчинтэй, өдрийн хязгаар хэтрээгүй байх ёстой
  if (isPaywallEnabled()) {
    const decoded = await requireUser(req, res);
    if (!decoded) return;
    const access = accessState(await getOrCreateUser(decoded));
    if (!access.active) return send(res, 402, { error: 'Эрхийн хугацаа дууссан байна.' });
    const usage = await consumeAiUsage(decoded.uid, access.isPaid);
    if (!usage.ok) {
      return send(res, 429, { error: `Өнөөдрийн AI хязгаар (${usage.limit}) дууслаа.`, code: 'DAILY_LIMIT' });
    }
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return send(res, 400, { error: 'Буруу JSON.' });
  }

  const { prompt, systemInstruction, responseSchema } = body || {};
  if (typeof prompt !== 'string' || !prompt.trim()) {
    return send(res, 400, { error: 'prompt хоосон байна.' });
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    return send(res, 413, { error: `Текст хэт урт (${MAX_PROMPT_CHARS} тэмдэгтээс ихгүй).` });
  }
  if (typeof systemInstruction !== 'string' || systemInstruction.length > MAX_SYSTEM_CHARS) {
    return send(res, 400, { error: 'systemInstruction буруу.' });
  }

  const model = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      temperature: 0.1,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };
  if (responseSchema && typeof responseSchema === 'object') {
    payload.generationConfig.responseMimeType = 'application/json';
    payload.generationConfig.responseSchema = responseSchema;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      console.error('Gemini error', upstream.status, JSON.stringify(data).slice(0, 500));
      return send(res, upstream.status === 429 ? 429 : 502, { error: 'Gemini API алдаа өглөө.' });
    }

    const text = data?.candidates?.[0]?.content?.parts?.find((p) => typeof p.text === 'string')?.text;
    if (!text) return send(res, 502, { error: 'Gemini хоосон хариу буцаалаа.' });
    return send(res, 200, { text });
  } catch (err) {
    const aborted = err && err.name === 'AbortError';
    console.error('Gemini request failed', err);
    return send(res, aborted ? 504 : 502, { error: aborted ? 'Gemini хариу удаан байна.' : 'Gemini руу холбогдож чадсангүй.' });
  } finally {
    clearTimeout(timer);
  }
}
