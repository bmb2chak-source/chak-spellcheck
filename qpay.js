// QPay Merchant API v2 холболт
import { isFirebaseAdminConfigured } from './firebase.js';

const DEFAULT_BASE = 'https://merchant.qpay.mn/v2';

export function isQpayConfigured() {
  return Boolean(process.env.QPAY_CLIENT_ID && process.env.QPAY_CLIENT_SECRET && process.env.QPAY_INVOICE_CODE);
}

// Төлбөрийн систем (нэвтрэлт + 7 хоног + төлбөр) нь Firebase болон QPay хоёулаа тохирсон үед л асна.
export function isPaywallEnabled() {
  return isQpayConfigured() && isFirebaseAdminConfigured();
}

const base = () => (process.env.QPAY_BASE_URL || DEFAULT_BASE).replace(/\/+$/, '');

let cached = { token: '', expiresAt: 0 };

async function getAccessToken() {
  if (cached.token && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const basic = Buffer.from(`${process.env.QPAY_CLIENT_ID}:${process.env.QPAY_CLIENT_SECRET}`).toString('base64');
  const r = await fetch(`${base()}/auth/token`, { method: 'POST', headers: { Authorization: `Basic ${basic}` } });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.access_token) throw new Error(`QPay auth failed (${r.status})`);
  const exp = Number(data.expires_in) || 0; // секунд эсвэл unix timestamp
  const expiresAt = exp > 1e9 ? exp * 1000 : Date.now() + (exp || 3600) * 1000;
  cached = { token: data.access_token, expiresAt };
  return cached.token;
}

export async function qpayRequest(path, body) {
  const doFetch = async () =>
    fetch(`${base()}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await getAccessToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  let r = await doFetch();
  if (r.status === 401) {
    cached = { token: '', expiresAt: 0 };
    r = await doFetch();
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error('QPay error', path, r.status, JSON.stringify(data).slice(0, 500));
    throw new Error(`QPay ${path} failed (${r.status})`);
  }
  return data;
}
