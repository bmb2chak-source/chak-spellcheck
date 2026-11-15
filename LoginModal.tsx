import React, { useState } from 'react';
import { X, ShieldCheck, Copy, AlertCircle } from 'lucide-react';
import { signInWithGoogle, isInAppBrowser } from '../lib/firebaseClient';

export default function LoginModal({ onClose, onOpenPrivacy, trialDays = 7 }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inApp = isInAppBrowser();

  const handleLogin = async () => {
    setBusy(true);
    setError('');
    try {
      await signInWithGoogle();
      onClose();
    } catch (e) {
      setError('Нэвтэрч чадсангүй. Дахин оролдоно уу.');
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setError('Холбоос хуулагдлаа. Chrome эсвэл Safari-д нааж нээнэ үү.');
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 flex items-center justify-center p-3">
      <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />
            <h2 className="text-sm font-extrabold">Нэвтрэх</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-center">
          <p className="text-sm text-slate-700 leading-relaxed">
            Google бүртгэлээрээ нэвтэрч <strong>{trialDays} хоног үнэгүй</strong> ашиглаарай.
            Таны эрх Google бүртгэлд хадгалагдах тул утас, компьютер аль алинаас нь ашиглана.
          </p>

          {inApp && (
            <div className="text-left p-3 rounded-xl bg-amber-50 border border-amber-200 text-[12px] text-amber-950 space-y-2">
              <div className="flex gap-1.5 font-bold">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Facebook/Messenger доторх хөтөч дээр Google нэвтрэлт ажилладаггүй.</span>
              </div>
              <p>Баруун дээд буланд байрлах <strong>⋯</strong> цэсээс <strong>"Open in browser"</strong> (Хөтөчөөр нээх)-ийг сонгоно уу.</p>
              <button type="button" onClick={copyLink} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-amber-300 font-semibold cursor-pointer">
                <Copy className="w-3.5 h-3.5" /> Холбоос хуулах
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleLogin}
            disabled={busy}
            className="w-full py-2.5 px-4 rounded-xl font-bold text-sm bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-800 border border-slate-300 shadow-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <svg viewBox="0 0 48 48" className="w-5 h-5" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z"/>
            </svg>
            <span>{busy ? 'Нэвтэрч байна…' : 'Google-ээр нэвтрэх'}</span>
          </button>

          {error && <p className="text-[12px] text-rose-600">{error}</p>}

          <p className="text-[11px] text-slate-500 leading-relaxed">
            Нэвтэрснээр та манай{' '}
            <button type="button" onClick={onOpenPrivacy} className="underline text-indigo-700 cursor-pointer">
              нууцлалын бодлого
            </button>
            -ыг зөвшөөрч, таны нэр, имэйл хаягийг үйлчилгээ үзүүлэх зорилгоор хадгалахыг зөвшөөрч байна.
          </p>
        </div>
      </div>
    </div>
  );
}
