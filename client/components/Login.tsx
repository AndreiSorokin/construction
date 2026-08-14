'use client';
import { useEffect, useState } from 'react';
import { Building2, KeyRound, RefreshCw } from 'lucide-react';
import { api, apiUrl } from '@/lib/api';
import { inputCls, labelCls, btnPrimary, ErrorBox } from './ui';

export function Login({ onDone }: { onDone: (user: any) => void }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  useEffect(() => { api.settings.get().then((s: any) => setLogoUrl(s.logoUrl)).catch(() => undefined); }, []);

  const submit = async () => {
    if (!login.trim() || !password) { setErr('Введите логин и пароль.'); return; }
    setErr(''); setBusy(true);
    try { onDone(await api.login(login.trim(), password)); }
    catch (e: any) { setErr(e?.message || 'Ошибка входа'); }
    finally { setBusy(false); }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center justify-center gap-2.5">
          {logoUrl ? (
            <img src={apiUrl(logoUrl)} alt="Логотип" className="object-contain" style={{ height: 72, width: 'auto', maxWidth: 320 }} />
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500 text-stone-900">
                <Building2 className="h-7 w-7" />
              </div>
              <div>
                <div className="text-lg font-semibold leading-none">ТОО «Интерстиль»</div>
                <div className="mt-1 text-xs text-stone-500">Снабжение и наряды — вход</div>
              </div>
            </div>
          )}
          {logoUrl && <div className="text-xs text-stone-500">Снабжение и наряды — вход</div>}
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <label className={labelCls}>Логин</label>
          <input className={`${inputCls} font-mono`} value={login} onChange={(e) => setLogin(e.target.value)} autoFocus
                 onKeyDown={(e) => e.key === 'Enter' && submit()} />
          <label className={`${labelCls} mt-3`}>Пароль</label>
          <input className={`${inputCls} font-mono`} type="password" value={password}
                 onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
          <div className="mt-4">
            <ErrorBox msg={err} />
            <button onClick={submit} disabled={busy} className={`${btnPrimary} w-full justify-center`}>
              {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              {busy ? 'Вход…' : 'Войти'}
            </button>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-stone-400">Доступ выдаёт администратор компании.</p>
      </div>
    </main>
  );
}
