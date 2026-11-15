// Хэрэглэгчийн бүртгэл, эрх, өдрийн хэрэглээ
import { adminAuth, db } from './firebase.js';
import { bearerToken, send } from './http.js';
import { TRIAL_DAYS, DAY_MS, PLANS, dailyAiLimit, todayUB } from './plans.js';

const adminEmails = () =>
  (process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

export function isAdmin(decoded) {
  return Boolean(decoded?.email && decoded.email_verified && adminEmails().includes(decoded.email.toLowerCase()));
}

// Firebase ID token шалгана. Амжилтгүй бол 401 буцааж null өгнө.
export async function requireUser(req, res) {
  const token = bearerToken(req);
  if (!token) {
    send(res, 401, { error: 'Нэвтэрнэ үү.' });
    return null;
  }
  try {
    return await adminAuth().verifyIdToken(token);
  } catch {
    send(res, 401, { error: 'Нэвтрэлтийн хугацаа дууссан. Дахин нэвтэрнэ үү.' });
    return null;
  }
}

// Хэрэглэгчийн бичлэгийг авна; анх удаа бол 7 хоногийн туршилттай үүсгэнэ.
export async function getOrCreateUser(decoded) {
  const ref = db().collection('users').doc(decoded.uid);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) return snap.data();
    const now = Date.now();
    const data = {
      uid: decoded.uid,
      email: decoded.email || '',
      name: decoded.name || '',
      createdAt: now,
      lastLoginAt: now,
      trialEndsAt: now + TRIAL_DAYS * DAY_MS,
      paidUntil: 0,
      plan: null,
    };
    tx.set(ref, data);
    return data;
  });
}

export function accessState(user, now = Date.now()) {
  const isPaid = (user.paidUntil || 0) > now;
  const isTrial = !isPaid && (user.trialEndsAt || 0) > now;
  return {
    active: isPaid || isTrial,
    isPaid,
    isTrial,
    trialEndsAt: user.trialEndsAt || 0,
    paidUntil: user.paidUntil || 0,
    plan: isPaid ? user.plan : null,
    planName: isPaid && PLANS[user.plan] ? PLANS[user.plan].name : null,
  };
}

const usageRef = (uid) => db().collection('usage').doc(`${uid}_${todayUB()}`);

export async function getTodayUsage(uid) {
  const snap = await usageRef(uid).get();
  return snap.exists ? snap.data().count || 0 : 0;
}

// Өдрийн хязгаар хэтрээгүй бол 1 нэмнэ. { ok, count, limit }
export async function consumeAiUsage(uid, isPaid) {
  const limit = dailyAiLimit(isPaid);
  const ref = usageRef(uid);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = snap.exists ? snap.data().count || 0 : 0;
    if (count >= limit) return { ok: false, count, limit };
    tx.set(ref, { uid, date: todayUB(), count: count + 1, updatedAt: Date.now() }, { merge: true });
    return { ok: true, count: count + 1, limit };
  });
}
