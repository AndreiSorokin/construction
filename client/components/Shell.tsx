'use client';
import type { ReactNode } from 'react';
import {
  Boxes, ScrollText, CircleUser, Layers,
  LogOut, RefreshCw, Building2,
} from 'lucide-react';
import { apiUrl } from '@/lib/api';

export type ViewKey = 'requests' | 'bank' | 'orders' | 'personal';

/* Акценты модулей. Классы записаны статически: Tailwind собирается заранее
   и НЕ увидит строку вида `bg-${accent}-600`. */
const ACCENT = {
  amber: { on: 'bg-amber-600 text-white', dot: 'bg-amber-500', title: 'text-amber-400', chip: 'bg-amber-100 text-amber-700', border: 'border-amber-200' },
  sky: { on: 'bg-sky-600 text-white', dot: 'bg-sky-500', title: 'text-sky-400', chip: 'bg-sky-100 text-sky-700', border: 'border-sky-200' },
  violet: { on: 'bg-violet-600 text-white', dot: 'bg-violet-500', title: 'text-violet-400', chip: 'bg-violet-100 text-violet-700', border: 'border-violet-200' },
  stone: { on: 'bg-stone-600 text-white', dot: 'bg-stone-500', title: 'text-stone-400', chip: 'bg-stone-100 text-stone-700', border: 'border-stone-200' },
} as const;
type AccentKey = keyof typeof ACCENT;

export function Shell({
  me, view, setView, badges, showOrders, onLogout, onReload, reloading, children, logoUrl, avatarUrl, notif,
}: {
  me: any; view: ViewKey; setView: (v: ViewKey) => void;
  badges: Partial<Record<ViewKey, number>>; showOrders: boolean;
  onLogout: () => void; onReload: () => void; reloading?: boolean; children: ReactNode;
  logoUrl?: string | null; avatarUrl?: string | null; notif?: ReactNode;
}) {
  const allGroups: { title: string; accent: AccentKey; items: { k: ViewKey; label: string; icon: any }[] }[] = [
    {
      title: 'Снабжение', accent: 'amber', items: [
        { k: 'requests', label: 'Снабжение', icon: Boxes },
        { k: 'bank', label: 'Банк', icon: Layers },
      ],
    },
    { title: 'Наряды', accent: 'sky', items: showOrders ? [{ k: 'orders', label: 'Наряды', icon: ScrollText }] : [] },
    {
      title: 'Личное', accent: 'violet', items: [
        { k: 'personal', label: 'Личный кабинет', icon: CircleUser },
      ],
    },
  ];
  const groups = allGroups.filter((g) => g.items.length > 0);

  const navBtn = (it: { k: ViewKey; label: string; icon: any }, accent: AccentKey, desktop: boolean) => {
    const on = view === it.k;
    const b = badges[it.k] || 0;
    const Icon = it.icon;
    const onCls = ACCENT[accent].on;
    if (desktop) {
      return (
        <button key={it.k} onClick={() => setView(it.k)}
          className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${on ? onCls : 'text-stone-400 hover:bg-stone-800 hover:text-stone-200'}`}>
          <Icon className="h-5 w-5" />
          <span className="flex-1 text-left">{it.label}</span>
          {b > 0 && <span className="rounded-full bg-amber-500 px-1.5 text-xs font-bold text-stone-900">{b}</span>}
        </button>
      );
    }
    return (
      <button key={it.k} onClick={() => setView(it.k)}
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${on ? onCls : 'text-stone-400 hover:bg-stone-800 hover:text-stone-200'}`}>
        <Icon className="h-4 w-4" /> {it.label}
        {b > 0 && <span className="ml-0.5 rounded-full bg-amber-500 px-1.5 text-xs font-bold text-stone-900">{b}</span>}
      </button>
    );
  };

  const logo = (h: number, maxW: number, iconBox: string, iconSize: string) => (
    logoUrl
      ? <img src={apiUrl(logoUrl)} alt="Логотип" className="shrink-0 object-contain" style={{ height: h, width: 'auto', maxWidth: maxW }} />
      : <div className={`flex shrink-0 items-center justify-center rounded-xl bg-amber-500 text-stone-900 ${iconBox}`}><Building2 className={iconSize} /></div>
  );

  return (
    <div className="min-h-screen bg-stone-100 font-sans text-stone-900">
      {/* мобильная шапка: тёмная, навигация прокручивается вбок — вкладки не сминаются */}
      <header className="no-print sticky top-0 z-20 border-b border-stone-800 bg-stone-900 text-stone-50 lg:hidden">
        <div className="px-4 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              {logo(30, 150, 'h-8 w-8', 'h-4 w-4')}
              <div className="min-w-0 truncate text-sm font-semibold leading-tight">{me.name}</div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {notif}
              <button onClick={onReload} disabled={reloading} title="Обновить"
                className="inline-flex items-center rounded-lg bg-stone-800 p-1.5 text-stone-300 hover:bg-stone-700 disabled:opacity-60"><RefreshCw className={`h-3.5 w-3.5 ${reloading ? 'animate-spin' : ''}`} /></button>
              <button onClick={onLogout}
                className="inline-flex items-center gap-1.5 rounded-lg bg-stone-800 px-2.5 py-1.5 text-xs text-stone-300 hover:bg-stone-700"><LogOut className="h-3.5 w-3.5" /> Выйти</button>
            </div>
          </div>
          <nav className="mt-2.5 flex items-center gap-1 overflow-x-auto pb-0.5">
            {groups.map((g, gi) => (
              <span key={g.title} className="flex items-center gap-1">
                {gi > 0 && <span className="mx-0.5 h-5 w-px shrink-0 bg-stone-700" />}
                {g.items.map((it) => navBtn(it, g.accent, false))}
              </span>
            ))}
          </nav>
        </div>
      </header>

      {/* боковая панель на большом экране */}
      <aside className="no-print fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-stone-800 bg-stone-900 text-stone-50 lg:flex">
        <div className="flex items-center gap-2.5 border-b border-stone-800 px-4 py-4">
          {logo(34, 175, 'h-9 w-9', 'h-6 w-6')}
          {!logoUrl && (
            <div>
              <div className="text-sm font-semibold leading-none">ТОО «Интерстиль»</div>
              <div className="mt-1 text-xs text-stone-400">Внутренняя система</div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 border-b border-stone-800 px-4 py-3">
          {avatarUrl
            ? <img src={avatarUrl} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
            : <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-700 text-xs font-semibold text-stone-200">{(me.name || '?')[0]}</div>}
          <div className="truncate text-sm font-medium">{me.name}</div>
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto p-3">
          {groups.map((g) => (
            <div key={g.title}>
              <div className={`mb-1 flex items-center gap-1.5 px-3 text-xs font-semibold uppercase tracking-wide ${ACCENT[g.accent].title}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${ACCENT[g.accent].dot}`} />{g.title}
              </div>
              <div className="space-y-1">{g.items.map((it) => navBtn(it, g.accent, true))}</div>
            </div>
          ))}
        </nav>
        <div className="space-y-1 border-t border-stone-800 p-3">
          {notif && <div className="mb-1 px-1">{notif}</div>}
          <button onClick={onReload} disabled={reloading} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-stone-400 hover:bg-stone-800 hover:text-stone-200 disabled:opacity-60">
            <RefreshCw className={`h-5 w-5 ${reloading ? 'animate-spin' : ''}`} /> {reloading ? 'Обновляем…' : 'Обновить'}
          </button>
          <button onClick={onLogout} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-stone-300 hover:bg-stone-800">
            <LogOut className="h-5 w-5" /> Выйти
          </button>
        </div>
      </aside>

      <main className="lg:pl-60">
        <div className="px-3 py-4 lg:px-6 lg:py-6">
          {children}
        </div>
      </main>
      <footer className="no-print mt-2 border-t border-stone-200 px-4 pb-8 pt-4 text-center text-xs text-stone-400 lg:pl-60">
        ТОО «Интерстиль» · внутренняя система снабжения и нарядов
      </footer>
    </div>
  );
}
