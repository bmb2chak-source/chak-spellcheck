// QPay төлбөрийг шалгаж, төлөгдсөн бол хэрэглэгчийн эрхийг сунгана (давхар сунгахгүй).
import { db } from './firebase.js';
import { qpayRequest } from './qpay.js';
import { PLANS, DAY_MS } from './plans.js';

export async function applyPaymentIfPaid(ref) {
  const payRef = db().collection('payments').doc(ref);
  const snap = await payRef.get();
  if (!snap.exists) return { found: false, paid: false };
  const payment = snap.data();
  if (payment.status === 'PAID') return { found: true, paid: true, payment };

  // Төлбөрийг ҮРГЭЛЖ QPay-ээс шууд шалгана (callback-д итгэхгүй)
  const data = await qpayRequest('/payment/check', {
    object_type: 'INVOICE',
    object_id: payment.invoiceId,
    offset: { page_number: 1, page_limit: 100 },
  });
  const paidRows = (data.rows || []).filter((r) => r.payment_status === 'PAID');
  const paidAmount = paidRows.reduce((sum, r) => sum + Number(r.payment_amount || 0), 0);
  if (paidAmount < payment.amount) return { found: true, paid: false, payment };

  const plan = PLANS[payment.planId];
  const paidAt = Math.min(...paidRows.map((r) => Date.parse(r.payment_date)).filter(Number.isFinite), Date.now());
  const userRef = db().collection('users').doc(payment.uid);

  const result = await db().runTransaction(async (tx) => {
    const [p, u] = await Promise.all([tx.get(payRef), tx.get(userRef)]);
    if (p.data().status === 'PAID') return { alreadyApplied: true, paidUntil: u.data()?.paidUntil || 0 };
    const now = Date.now();
    const current = u.exists ? u.data().paidUntil || 0 : 0;
    const paidUntil = Math.max(now, current) + plan.days * DAY_MS; // Хуучин эрх дээр нэмж сунгана
    tx.set(userRef, { paidUntil, plan: plan.id, lastPaymentAt: now }, { merge: true });
    tx.update(payRef, {
      status: 'PAID',
      paidAt,
      paidAmount,
      qpayPaymentIds: paidRows.map((r) => r.payment_id),
    });
    return { alreadyApplied: false, paidUntil };
  });

  return { found: true, paid: true, payment: { ...payment, status: 'PAID' }, planName: plan.name, ...result };
}
