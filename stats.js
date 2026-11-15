import { send } from '../_lib/http.js';
import { requireUser, isAdmin } from '../_lib/account.js';
import { db, AggregateField } from '../_lib/firebase.js';
import { isPaywallEnabled } from '../_lib/qpay.js';
import { monthStartUB } from '../_lib/plans.js';

// Админ: хэрэглэгч, орлого, сүүлийн төлбөрүүд
export default async function handler(req, res) {
  if (!isPaywallEnabled()) return send(res, 503, { error: 'Систем идэвхжээгүй.' });
  const decoded = await requireUser(req, res);
  if (!decoded) return;
  if (!isAdmin(decoded)) return send(res, 403, { error: 'Админ эрх шаардлагатай.' });

  try {
    const now = Date.now();
    const users = db().collection('users');
    const payments = db().collection('payments');
    const sumPaid = (q) => q.aggregate({ total: AggregateField.sum('paidAmount'), n: AggregateField.count() }).get();

    const [usersCount, paidCount, trialCount, allRevenue, monthRevenue, recentPayments, recentUsers] = await Promise.all([
      users.count().get(),
      users.where('paidUntil', '>', now).count().get(),
      users.where('trialEndsAt', '>', now).count().get(),
      sumPaid(payments.where('status', '==', 'PAID')),
      sumPaid(payments.where('paidAt', '>=', monthStartUB())),
      payments.orderBy('paidAt', 'desc').limit(30).get(),
      users.orderBy('createdAt', 'desc').limit(30).get(),
    ]);

    send(res, 200, {
      totals: {
        users: usersCount.data().count,
        activePaid: paidCount.data().count,
        inTrial: trialCount.data().count,
        revenueAll: allRevenue.data().total || 0,
        paymentsAll: allRevenue.data().n || 0,
        revenueMonth: monthRevenue.data().total || 0,
        paymentsMonth: monthRevenue.data().n || 0,
      },
      payments: recentPayments.docs.map((d) => {
        const p = d.data();
        return { ref: p.ref, email: p.email, planId: p.planId, amount: p.paidAmount ?? p.amount, method: p.method, paidAt: p.paidAt, note: p.note || '' };
      }),
      users: recentUsers.docs.map((d) => {
        const u = d.data();
        return { email: u.email, name: u.name, createdAt: u.createdAt, trialEndsAt: u.trialEndsAt, paidUntil: u.paidUntil, plan: u.plan };
      }),
    });
  } catch (err) {
    console.error(err);
    send(res, 500, { error: 'Мэдээлэл татаж чадсангүй.' });
  }
}
