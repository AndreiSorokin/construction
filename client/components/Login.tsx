'use client';
import { useEffect, useRef, useState } from 'react';
import { Building2, Check, Eye, EyeOff, KeyRound, RefreshCw, X } from 'lucide-react';
import { api, apiUrl } from '@/lib/api';
import { inputCls, labelCls, btnPrimary, ErrorBox } from './ui';

// та же транслитерация, что и на сервере (common/slug.util.ts) — для мгновенного превью,
// пока не пришёл ответ от /api/organizations/check-slug
const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
  й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
  э: 'e', ю: 'yu', я: 'ya',
};
function slugify(name: string) {
  return name.toLowerCase().split('').map((c) => (c in TRANSLIT ? TRANSLIT[c] : c)).join('')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
}

const SLUG_REASON: Record<string, string> = {
  empty: 'введите адрес',
  reserved: 'это имя зарезервировано',
  taken: 'уже занято другой организацией',
};

/** пароль с кнопкой-«глазом» для показа/скрытия введённого текста */
function PasswordField({ value, onChange, onKeyDown }: { value: string; onChange: (v: string) => void; onKeyDown?: (e: React.KeyboardEvent) => void }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input className={`${inputCls} pr-9 font-mono`} type={show ? 'text' : 'password'} value={value}
             onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown} />
      <button type="button" tabIndex={-1} onClick={() => setShow((s) => !s)}
              className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-stone-400 hover:text-stone-600">
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function Login({ onDone }: { onDone: (user: any) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
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

  const [orgName, setOrgName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugCheck, setSlugCheck] = useState<{ checking: boolean; available: boolean | null; reason?: string }>({ checking: false, available: null });
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPassword2, setAdminPassword2] = useState('');

  // проверка адреса «на лету» — с дебаунсом, чтобы не долбить сервер на каждое нажатие клавиши
  const slugCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (mode !== 'register') return;
    if (slugCheckTimer.current) clearTimeout(slugCheckTimer.current);
    if (!slug.trim()) { setSlugCheck({ checking: false, available: null }); return; }
    setSlugCheck((s) => ({ ...s, checking: true }));
    slugCheckTimer.current = setTimeout(() => {
      api.checkOrgSlug(slug).then((r) => setSlugCheck({ checking: false, available: r.available, reason: r.reason }))
        .catch(() => setSlugCheck({ checking: false, available: null }));
    }, 400);
    return () => { if (slugCheckTimer.current) clearTimeout(slugCheckTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, mode]);

  const submitRegister = async () => {
    if (!orgName.trim() || !slug.trim() || !adminEmail.trim() || !adminPassword) { setErr('Заполните все поля.'); return; }
    if (adminPassword.length < 6) { setErr('Пароль — минимум 6 символов.'); return; }
    if (adminPassword !== adminPassword2) { setErr('Пароли не совпадают.'); return; }
    if (slugCheck.available === false) { setErr('Выберите другой адрес организации.'); return; }
    setErr(''); setBusy(true);
    try {
      const { user } = await api.registerOrganization({
        orgName: orgName.trim(),
        slug: slug.trim(),
        adminEmail: adminEmail.trim(),
        adminPassword,
      });
      onDone(user);
    } catch (e: any) { setErr(e?.message || 'Ошибка регистрации'); }
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
                <div className="mt-1 text-xs text-stone-500">Снабжение и наряды — {mode === 'login' ? 'вход' : 'регистрация организации'}</div>
              </div>
            </div>
          )}
          {logoUrl && <div className="text-xs text-stone-500">Снабжение и наряды — {mode === 'login' ? 'вход' : 'регистрация организации'}</div>}
        </div>

        {mode === 'login' ? (
          <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm anim-fade-in">
            <label className={labelCls}>Логин</label>
            <input className={`${inputCls} font-mono`} value={login} onChange={(e) => setLogin(e.target.value)} autoFocus
                   onKeyDown={(e) => e.key === 'Enter' && submit()} />
            <label className={`${labelCls} mt-3`}>Пароль</label>
            <PasswordField value={password} onChange={setPassword} onKeyDown={(e) => e.key === 'Enter' && submit()} />
            <div className="mt-4">
              <ErrorBox msg={err} />
              <button onClick={submit} disabled={busy} className={`${btnPrimary} w-full justify-center`}>
                {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                {busy ? 'Вход…' : 'Войти'}
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm anim-fade-in">
            <label className={labelCls}>Название организации</label>
            <input className={inputCls} value={orgName}
                   onChange={(e) => { setOrgName(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)); }} autoFocus />
            <label className={`${labelCls} mt-3`}>Адрес</label>
            <div className="flex items-center gap-1.5">
              <div className="relative min-w-0 flex-1">
                <input className={`${inputCls} pr-7 font-mono`} value={slug}
                       onChange={(e) => { setSlugTouched(true); setSlug(slugify(e.target.value)); }}
                       placeholder="moya-firma" />
                <span className="absolute inset-y-0 right-2 flex items-center">
                  {slugCheck.checking
                    ? <RefreshCw className="h-3.5 w-3.5 animate-spin text-stone-400" />
                    : slugCheck.available === true
                      ? <Check className="h-3.5 w-3.5 text-emerald-600" />
                      : slugCheck.available === false
                        ? <X className="h-3.5 w-3.5 text-rose-600" />
                        : null}
                </span>
              </div>
              <span className="shrink-0 text-xs text-stone-400">.interstil.kz</span>
            </div>
            {!slugCheck.checking && slugCheck.available === false && (
              <p className="mt-1 text-xs text-rose-600">{SLUG_REASON[slugCheck.reason || ''] || 'этот адрес недоступен'}</p>
            )}
            <label className={`${labelCls} mt-3`}>Email администратора</label>
            <input className={inputCls} type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
            <label className={`${labelCls} mt-3`}>Пароль администратора</label>
            <PasswordField value={adminPassword} onChange={setAdminPassword} />
            <label className={`${labelCls} mt-3`}>Повторите пароль</label>
            <PasswordField value={adminPassword2} onChange={setAdminPassword2} onKeyDown={(e) => e.key === 'Enter' && submitRegister()} />
            <div className="mt-4">
              <ErrorBox msg={err} />
              <button onClick={submitRegister} disabled={busy} className={`${btnPrimary} w-full justify-center`}>
                {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
                {busy ? 'Регистрация…' : 'Зарегистрировать организацию'}
              </button>
            </div>
          </div>
        )}

        <p className="mt-4 text-center text-xs text-stone-400">
          {mode === 'login' ? (
            <>Доступ выдаёт администратор компании. Ещё нет организации?{' '}
              <button className="text-stone-600 underline hover:text-stone-900" onClick={() => { setMode('register'); setErr(''); }}>Зарегистрировать</button>
            </>
          ) : (
            <>Уже есть организация?{' '}
              <button className="text-stone-600 underline hover:text-stone-900" onClick={() => { setMode('login'); setErr(''); }}>Войти</button>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
