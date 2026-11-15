import { randomUUID } from 'node:crypto';
import { readJsonBody, send, requireMethod } from '../_lib/http.js';
import { requireUser, isAdmin } from '../_lib/account.js';
import { db, adminAuth } from '../_lib/firebase.js';
import { isPaywallEnabled } from '../_lib/qpay.js';
import { DAY_MS, TRIAL_DAYS } from '../_lib/plans.js';

// Админ: имэйлээр хэрэглэгчид гараар эрх нэмэх/хасах (бэлнээр төлсөн, буцаалт, урамшуулал г.м.)
export default async function handler(req, res) {
  if (!requireMethod(req, res, 'POST')) return;
  if (!isPaywallEnabled()) return send(res, 503, { error: 'Систем идэвхжээгүй.' });
  const decoded = await requireUser(req, res);
  if (!decoded) return;
  if (!isAdmin(decoded)) return send(res, 403, { error: 'Админ эрх шаардлагатай.' });

  const body = await readJsonBody(req).catch(() => ({}));
  const email = String(body?.email || '').trim().toLowerCase();
  const days = Math.trunc(Number(body?.days));
  const amount = Math.max(0, Math.trunc(Number(body?.amount) || 0));
  const note = String(body?.note || '').slice(0, 200);
  if (!email || !Number.isFinite(days) || days === 0 || Math.abs(days) > 3650) {
    return send(res, 400, { error: 'Имэйл болон хоног (−3650…3650, 0 биш) зөв оруулна уу.' });
  }

  let target;
  try {
    target = await adminAuth().getUserByEmail(email);
  } catch {
    return send(res, 404, { error: 'Энэ имэйлээр нэвтэрсэн хэрэглэгч олдсонгүй. Эхлээд сайтад нэг удаа нэвтрэх ёстой.' });
  }

  try {
    const userRef = db().collection('users').doc(target.uid);
    const paidUntil = await db().runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const now = Date.now();
      const current = snap.exists ? snap.data().paidUntil || 0 : 0;
      const next = days > 0 ? Math.max(now, current) + days * DAY_MS : Math.max(0, current + days * DAY_MS);
      const base = snap.exists ? {} : { uid: target.uid, email, name: target.displayName || '', createdAt: now, trialEndsAt: now + TRIAL_DAYS * DAY_MS };
      tx.set(userRef, { ...base, paidUntil: next, plan: next > now ? (snap.data()?.plan || 'manual') : null }, { merge: true });
      const ref = `MANUAL-${randomUUID().slice(0, 8)}`;
      tx.set(db().collection('payments').doc(ref), {
        ref, uid: target.uid, email, planId: 'manual', amount, paidAmount: amount, days, method: 'manual',
        status: 'PAID', createdAt: now, paidAt: now, note, grantedBy: decoded.email,
      });
      return next;
    });
    send(res, 200, { ok: true, email, paidUntil });
  } catch (err) {
    console.error(err);
    send(res, 500, { error: 'Эрх өгч чадсангүй.' });
  }
}
