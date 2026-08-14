'use client';
import { useEffect, useRef, useState } from 'react';
import { api, apiUrl } from '@/lib/api';
import { appConfirm } from './ui';

const card = 'rounded-2xl border border-stone-200 bg-white p-4 shadow-sm';
const btn = 'rounded-lg bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50';
const btnGhost = 'rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50';

/** Вкладка «Приложение» в настройках админа: логотип компании и лимит «Срочно». */
export function SettingsApp({ me }: { me: any }) {
  const [logo, setLogo] = useState<{ logoUrl: string | null; urgentLimit: number }>({ logoUrl: null, urgentLimit: 3 });
  const [limit, setLimit] = useState('3');
  const [msg, setMsg] = useState('');
  const logoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.settings.get().then((s: any) => { setLogo(s); setLimit(String(s.urgentLimit)); }).catch(() => undefined);
  }, [me.id]);

  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 3500); };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {msg && <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</div>}
      <div className={card}>
        <h2 className="mb-1 text-base font-semibold text-stone-900">Логотип компании</h2>
        <p className="mb-2 text-xs text-stone-500">PNG с прозрачным фоном, SVG или JPG — любой ширины: рендер по пропорциям, без подложки.</p>
        <div className="flex items-center gap-3">
          {logo.logoUrl
            ? <img src={apiUrl(logo.logoUrl)} alt="Логотип" className="object-contain" style={{ height: 56, width: 'auto', maxWidth: 280 }} />
            : <div className="text-sm text-stone-400">Логотип не загружен</div>}
          <button className={btnGhost} onClick={() => logoRef.current?.click()}>Загрузить</button>
          {logo.logoUrl && (
            <button className={btnGhost} onClick={async () => {
              if (await appConfirm('Удалить логотип?', { okText: 'Удалить', danger: true })) { await api.settings.clearLogo(); setLogo({ ...logo, logoUrl: null }); }
            }}>Удалить</button>
          )}
          <input ref={logoRef} type="file" accept="image/*" className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
              const dims = await new Promise<{ w: number; h: number }>((res) => {
                const img = new Image(); img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight }); img.onerror = () => res({ w: 0, h: 0 }); img.src = URL.createObjectURL(f);
              });
              const r: any = await api.settings.logo(f, dims.w || undefined, dims.h || undefined);
              setLogo(r); flash('Логотип обновлён.');
            }} />
        </div>
      </div>
      <div className={card}>
        <h2 className="mb-1 text-base font-semibold text-stone-900">Правила заявок</h2>
        <p className="mb-2 text-xs text-stone-500">Лимит заявок «Срочно» в день на всю компанию. 0 — без лимита. При исчерпании приоритет тихо понижается до «Высокий» с записью в историю.</p>
        <div className="flex items-center gap-2">
          <input type="number" min={0} max={99} value={limit} onChange={(e) => setLimit(e.target.value)}
            className="w-24 rounded-lg border border-stone-300 px-3 py-2 text-sm" />
          <button className={btn} onClick={async () => { const r: any = await api.settings.urgentLimit(Number(limit) || 0); setLimit(String(r.urgentLimit)); flash('Лимит сохранён: ' + (r.urgentLimit === 0 ? 'без лимита' : r.urgentLimit + ' в день')); }}>Сохранить</button>
        </div>
      </div>
    </div>
  );
}
