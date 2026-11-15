// Firebase Admin (сервер тал): нэвтрэлт шалгах, Firestore өгөгдлийн сан.
// Vercel хувьсагч: FIREBASE_SERVICE_ACCOUNT = Service account JSON файлын агуулга (бүтнээр нь)
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, AggregateField } from 'firebase-admin/firestore';

function parseServiceAccount() {
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT || '').trim();
  if (!raw) return null;
  const text = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  const sa = JSON.parse(text);
  if (typeof sa.private_key === 'string') sa.private_key = sa.private_key.replace(/\\n/g, '\n');
  return sa;
}

export function isFirebaseAdminConfigured() {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT ||
      (process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST)
  );
}

function app() {
  if (getApps().length) return getApps()[0];
  const sa = parseServiceAccount();
  if (sa) return initializeApp({ credential: cert(sa), projectId: sa.project_id });
  // Локал emulator-т зориулсан
  return initializeApp({ projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'demo-chak' });
}

export const adminAuth = () => getAuth(app());
export const db = () => getFirestore(app());
export { FieldValue, AggregateField };
