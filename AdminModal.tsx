import React, { useEffect, useState } from 'react';
import { X, Users, Crown, Clock, RefreshCw, UserPlus } from 'lucide-react';
import { apiFetch } from '../lib/firebaseClient';

const fmtMoney = (n) => `${Number(n || 0).toLocaleString('en-US')}₮`;
const fmtDate = (ms) =>
  ms
    ? new Date(ms).toLocaleString('sv-SE', { timeZone: 'Asia/Ulaanbaatar', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '—';
const PLAN_LABELS = { '6months': '6 сар', '1year': '1 жил', manual: 'Гараар' };

const Stat = ({ icon: Icon, label, value, sub = '' }) => (
  <div className="p-3 rounded-xl bg-white border border-slate-200">
    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
      <Icon className="w-3.5 h-3.5 text-indigo-600" />
      {label}
    </div>
    <div className="text-lg font-black text-slate-900 mt-0.5">{value}</div>
    {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
  </div>
);

export default function AdminModal({ onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('payments');
  const [grant, setGrant] = useState({ email: '', days: 180, amount: 0, note: '' });
  const [grantMsg, setGrantMsg] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    const r = await apiFetch('/api/admin/stats');
    if (r.ok) setData(r.data);
    else setError(r.data?.error || 'Мэдээлэл татаж чадсангүй.');
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const submitGrant = async (e) => {
    e.preventDefault();
    setGrantMsg('');
    const r = await apiFetch('/api/admin/grant', { body: grant });
    if (r.ok) {
      setGrantMsg(`✅ ${r.data.email}: эрх ${fmtDate(r.data.paidUntil)} хүртэл.`);
      load();
    } else {
      setGrantMsg(`⚠️ ${r.data?.error || 'Алдаа гарлаа.'}`);
    }
  };

  const t = data?.totals;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 flex items-center justify-center p-3">
      <div className="bg-slate-50 rounded-2xl max-w-4xl w-full max-h-[92dvh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <h2 className="text-sm font-extrabold">Админ самбар</h2>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={load} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 cursor-pointer" title="Шинэчлэх">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4 overflow-y-auto space-y-4">
          {error && <p className="text-sm text-rose-600">{error}</p>}

          {t && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <Stat icon={Crown} label="Энэ сарын орлого" value={fmtMoney(t.revenueMonth)} sub={`${t.paymentsMonth} төлбөр`} />
              <Stat icon={Crown} label="Нийт орлого" value={fmtMoney(t.revenueAll)} sub={`${t.paymentsAll} төлбөр`} />
              <Stat icon={Users} label="Төлбөртэй (идэвхтэй)" value={t.activePaid} sub={`Нийт ${t.users} хэрэглэгч`} />
              <Stat icon={Clock} label="Сүүлийн 7 хоногт нэгдсэн" value={t.inTrial} />
            </div>
          )}

          <div className="flex gap-1.5 text-xs font-bold">
            {[['payments', 'Сүүлийн төлбөрүүд'], ['users', 'Шинэ хэрэглэгчид'], ['grant', 'Гараар эрх өгөх']].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setTab(k)}
                className={`px-3 py-1.5 rounded-lg border cursor-pointer ${tab === k ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200'}`}>
                {l}
              </button>
            ))}
          </div>

          {tab === 'payments' && data && (
            <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
              <table className="w-full text-[12px]">
                <thead className="bg-slate-100 text-slate-600 text-left">
                  <tr><th className="p-2">Огноо</th><th className="p-2">Имэйл</th><th className="p-2">Багц</th><th className="p-2 text-right">Дүн</th><th className="p-2">Төрөл</th></tr>
                </thead>
                <tbody>
                  {data.payments.length === 0 && <tr><td colSpan={5} className="p-3 text-center text-slate-400">Төлбөр алга</td></tr>}
                  {data.payments.map((p) => (
                    <tr key={p.ref} className="border-t border-slate-100">
                      <td className="p-2 whitespace-nowrap">{fmtDate(p.paidAt)}</td>
                      <td className="p-2">{p.email}</td>
                      <td className="p-2">{PLAN_LABELS[p.planId] || p.planId}</td>
                      <td className="p-2 text-right font-semibold">{fmtMoney(p.amount)}</td>
                      <td className="p-2 text-slate-500">{p.method === 'manual' ? `Гараар${p.note ? ` · ${p.note}` : ''}` : 'QPay'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'users' && data && (
            <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
              <table className="w-full text-[12px]">
                <thead className="bg-slate-100 text-slate-600 text-left">
                  <tr><th className="p-2">Бүртгүүлсэн</th><th className="p-2">Имэйл</th><th className="p-2">Төлөв</th></tr>
                </thead>
                <tbody>
                  {data.users.map((u) => {
                    const now = Date.now();
                    const status = u.paidUntil > now ? `💎 ${fmtDate(u.paidUntil)} хүртэл` : u.trialEndsAt > now ? '⏳ Туршилт' : '— Хугацаа дууссан';
                    return (
                      <tr key={u.email + u.createdAt} className="border-t border-slate-100">
                        <td className="p-2 whitespace-nowrap">{fmtDate(u.createdAt)}</td>
                        <td className="p-2">{u.email}</td>
                        <td className="p-2">{status}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'grant' && (
            <form onSubmit={submitGrant} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 max-w-md">
              <p className="text-[12px] text-slate-600">Бэлнээр/дансаар төлсөн, урамшуулал, буцаалт зэрэгт ашиглана. Хэрэглэгч сайтад нэг удаа нэвтэрсэн байх ёстой. Хасах бол хоногийг хасах тоогоор (жишээ нь −30) оруулна.</p>
              <input required type="email" placeholder="Хэрэглэгчийн Gmail" value={grant.email}
                onChange={(e) => setGrant({ ...grant, email: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300" />
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] text-slate-500">Хоног
                  <input required type="number" value={grant.days} onChange={(e) => setGrant({ ...grant, days: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900" />
                </label>
                <label className="text-[11px] text-slate-500">Төлсөн дүн (₮)
                  <input type="number" min={0} value={grant.amount} onChange={(e) => setGrant({ ...grant, amount: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900" />
                </label>
              </div>
              <input placeholder="Тэмдэглэл (заавал биш)" value={grant.note} onChange={(e) => setGrant({ ...grant, note: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300" />
              <button type="submit" className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer">
                <UserPlus className="w-4 h-4" /> Эрх өгөх
              </button>
              {grantMsg && <p className="text-[12px]">{grantMsg}</p>}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
