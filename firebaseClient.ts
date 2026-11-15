// Хөтөч тал: Firebase Google нэвтрэлт + серверийн API дуудах туслах функцууд
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  connectAuthEmulator
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const firebaseEnabled = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
export const auth = firebaseEnabled ? getAuth(initializeApp(firebaseConfig)) : null;

// Зөвхөн локал туршилтад (Firebase emulator)
if (auth && import.meta.env.VITE_FIREBASE_AUTH_EMULATOR) {
  connectAuthEmulator(auth, import.meta.env.VITE_FIREBASE_AUTH_EMULATOR, { disableWarnings: true });
}

export async function signInWithGoogle() {
  if (!auth) throw new Error('Нэвтрэлт тохируулаагүй байна.');
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provider);
  } catch (e: any) {
    const code = e?.code || '';
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider);
    } else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
      throw e;
    }
  }
}

export const logout = () => (auth ? signOut(auth) : Promise.resolve());

export async function authHeaders(): Promise<Record<string, string>> {
  const user = auth?.currentUser;
  if (!user) return {};
  return { Authorization: `Bearer ${await user.getIdToken()}` };
}

export async function apiFetch(path: string, opts: { method?: string; body?: unknown; signal?: AbortSignal } = {}) {
  const headers: Record<string, string> = { ...(await authHeaders()) };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const r = await fetch(path, {
    method: opts.method || (opts.body !== undefined ? 'POST' : 'GET'),
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal
  });
  const data: any = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

// Facebook, Messenger, Instagram зэрэг аппын доторх хөтөч дээр Google нэвтрэлт ажилладаггүй
export function isInAppBrowser() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  return /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Messenger|Line\/|KAKAOTALK|TikTok|musical_ly|Snapchat|; wv\)/i.test(ua);
}
