'use client';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, CalendarDays } from 'lucide-react';
import { api } from '@/lib/api';
import { periodLabel, fmtDate } from '@/lib/format';
import { appConfirm, btnPrimary, inputCls } from './ui';

const card = 'rounded-2xl border border-stone-200 bg-white shadow-sm';
const pad2 = (n: number) => String(n).padStart(2, '0');

/** Личный календарь — события видит только сам пользователь. Порт CalendarPane из эталона. */
export function CalendarPane({ me }: { me: any }) {
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const [cur, setCur] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [sel, setSel] = useState(todayKey);
  const [title, setTitle] = useState('');
  const [events, setEvents] = useState<any[]>([]);

  const load = () => { api.comms.events().then((es: any[]) => setEvents(es.filter((e) => e.byId === me.id))).catch(() => undefined); };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const byDate = new Map<string, any[]>();
  events.forEach((e) => { const k = String(e.date).slice(0, 10); if (!byDate.has(k)) byDate.set(k, []); byDate.get(k)!.push(e); });
  const first = new Date(cur.y, cur.m, 1);
  const off = (first.getDay() + 6) % 7;
  const dim = new Date(cur.y, cur.m + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < 42; i++) { const d = i - off + 1; cells.push(d >= 1 && d <= dim ? d : null); }
  const keyOf = (d: number) => `${cur.y}-${pad2(cur.m + 1)}-${pad2(d)}`;
  const nav = (dir: number) => setCur((p) => { const m2 = p.m + dir; return { y: p.y + Math.floor(m2 / 12), m: ((m2 % 12) + 12) % 12 }; });
  const add = async () => { const t = title.trim(); if (!t) return; await api.comms.addEvent(sel, t); setTitle(''); load(); };
  const selEvents = byDate.get(sel) || [];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className={`p-3 lg:col-span-2 ${card}`}>
        <div className="mb-2 flex items-center justify-between">
          <button onClick={() => nav(-1)} className="rounded p-1.5 text-stone-500 hover:bg-stone-100"><ChevronLeft className="h-4 w-4" /></button>
          <div className="text-sm font-semibold text-stone-800">{periodLabel(`${cur.y}-${pad2(cur.m + 1)}`)}</div>
          <button onClick={() => nav(1)} className="rounded p-1.5 text-stone-500 hover:bg-stone-100"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-stone-400">
          {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => <div key={d} className="py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <div key={i} className="h-16 rounded-lg bg-stone-100" />;
            const k = keyOf(d); const evs = byDate.get(k) || []; const isSel = sel === k; const isToday = todayKey === k;
            return (
              <button key={i} onClick={() => setSel(k)}
                className={`flex h-16 flex-col items-start gap-0.5 overflow-hidden rounded-lg border p-1 text-left transition ${isSel ? 'border-amber-400 bg-amber-50' : 'border-stone-200 bg-white hover:bg-stone-50'}`}>
                <span className={isToday ? 'flex h-5 w-5 items-center justify-center rounded-full bg-stone-900 text-xs font-semibold text-white' : 'text-xs font-semibold text-stone-600'}>{d}</span>
                {evs.slice(0, 2).map((e) => <span key={e.id} className="w-full truncate rounded bg-sky-100 px-1 text-xs leading-4 text-sky-800">{e.title}</span>)}
                {evs.length > 2 && <span className="text-xs text-stone-400">+{evs.length - 2}</span>}
              </button>
            );
          })}
        </div>
      </div>
      <div className={`p-4 ${card}`}>
        <div className="mb-2 text-sm font-semibold text-stone-800">{fmtDate(sel)}</div>
        <div className="mb-3 flex gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Новое событие…" className={inputCls} />
          <button onClick={add} disabled={!title.trim()} className={`${btnPrimary} disabled:opacity-40`}><Plus className="h-4 w-4" /></button>
        </div>
        {selEvents.length === 0 ? <p className="text-sm text-stone-400">Событий на этот день нет.</p> : (
          <div className="space-y-1.5">
            {selEvents.map((e) => (
              <div key={e.id} className="flex items-center gap-2 rounded-lg border border-stone-200 p-2 text-sm">
                <CalendarDays className="h-4 w-4 shrink-0 text-sky-500" />
                <span className="min-w-0 flex-1 truncate text-stone-700">{e.title}</span>
                <button onClick={async () => { if (await appConfirm(`Удалить событие «${e.title || '—'}» из календаря?`, { okText: 'Удалить', danger: true })) { await api.comms.delEvent(e.id); load(); } }}
                  className="shrink-0 rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-stone-400">Личный календарь — события видите только вы.</p>
      </div>
    </div>
  );
}
