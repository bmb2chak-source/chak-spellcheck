// Үнэ, хугацааг ЗӨВХӨН серверт тодорхойлно (хөтчөөс үнэ өөрчлөх боломжгүй).
// src/App.tsx доторх SUBSCRIPTION_PLANS-тай ижил байх ёстой.
export const TRIAL_DAYS = 7;
export const DAY_MS = 24 * 60 * 60 * 1000;

export const PLANS = {
  '6months': { id: '6months', name: '6 сарын эрх', amount: 19000, days: 180 },
  '1year': { id: '1year', name: '1 жилийн эрх (VIP)', amount: 39000, days: 365 },
};

// Өдөрт хэдэн удаа AI (Gemini) ашиглахыг хязгаарлана. Vercel хувьсагчаар өөрчилж болно.
export const dailyAiLimit = (isPaid) =>
  isPaid
    ? Number(process.env.DAILY_AI_LIMIT_PAID) || 300
    : Number(process.env.DAILY_AI_LIMIT_TRIAL) || 20;

// Улаанбаатарын цагаар өнөөдрийн огноо (YYYY-MM-DD)
export const todayUB = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ulaanbaatar' });

// Улаанбаатарын цагаар энэ сарын эхлэл (ms)
export function monthStartUB() {
  const [y, m] = todayUB().split('-').map(Number);
  return Date.UTC(y, m - 1, 1) - 8 * 60 * 60 * 1000;
}
