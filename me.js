import { send } from './_lib/http.js';
import { isPaywallEnabled } from './_lib/qpay.js';
import { db } from './_lib/firebase.js';
import { requireUser, getOrCreateUser, accessState, getTodayUsage, isAdmin } from './_lib/account.js';
import { dailyAiLimit } from './_lib/plans.js';

// Нэвтэрсэн хэрэглэгчийн эрх, өнөөдрийн хэрэглээ
export default async function handler(req, res) {
  if (!isPaywallEnabled()) return send(res, 200, { paywall: false });
  const decoded = await requireUser(req, res);
  if (!decoded) return;
  try {
    const user = await getOrCreateUser(decoded);
    db().collection('users').doc(decoded.uid).set({ lastLoginAt: Date.now() }, { merge: true }).catch(() => {});
    const access = accessState(user);
    send(res, 200, {
      paywall: true,
      user: { email: user.email, name: user.name },
      access,
      usage: { today: await getTodayUsage(decoded.uid), limit: dailyAiLimit(access.isPaid) },
      isAdmin: isAdmin(decoded),
    });
  } catch (err) {
    console.error(err);
    send(res, 500, { error: 'Серверийн алдаа.' });
  }
}
