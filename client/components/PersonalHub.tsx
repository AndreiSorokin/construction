'use client';
import { useRef, useState } from 'react';
import {
  Archive, AlertTriangle, BarChart3, BookOpen, Camera, CalendarDays, KeyRound, LayoutDashboard,
  MessageSquare, Moon, NotebookPen, Settings as SettingsIcon, Sun,
} from 'lucide-react';
import { api } from '@/lib/api';
import { pillCls, overdueDays, btnGhost, btnPrimary, inputCls, labelCls, ErrorBox } from './ui';
import { ROLE_RU, TYPE_RU } from '@/lib/format';
import { reqTitle } from '@/lib/requestHelpers';
import { useTheme } from './ThemeProvider';
import { Notebook } from './Notebook';
import { CalendarPane } from './CalendarPane';
import { CommsView } from './CommsView';
import { ReportsView } from './ReportsView';
import { ArchiveTab } from './ArchiveTab';
import { ActionLog } from './ActionLog';
import { SettingsView } from './SettingsView';

const card = 'rounded-2xl border border-stone-200 bg-white p-4 shadow-sm';

function Donut({ items, size = 130 }: { items: { label: string; v: number; hex: string }[]; size?: number }) {
  const total = items.reduce((s, x) => s + x.v, 0);
  const R = 44, C = 2 * Math.PI * R;
  let off = 0;
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
      <svg width={size} height={size} viewBox="0 0 110 110" className="shrink-0 -rotate-90">
        <circle cx="55" cy="55" r={R} fill="none" stroke="#e7e5e4" strokeWidth="16" />
        {total > 0 && items.filter((x) => x.v > 0).map((x, i) => {
          const frac = x.v / total, dash = frac * C, o = off; off += dash;
          return <circle key={i} cx="55" cy="55" r={R} fill="none" stroke={x.hex} strokeWidth="16" strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-o} />;
        })}
      </svg>
      <div className="w-full min-w-0 space-y-1 sm:w-auto">
        {items.map((x, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: x.hex }} />
            <span className="truncate text-stone-600">{x.label}</span>
            <span className="ml-auto pl-2 font-mono font-semibold text-stone-900">{x.v}</span>
            <span className="w-9 text-right font-mono text-stone-400">{total ? Math.round((x.v / total) * 100) : 0}%</span>
          </div>
        ))}
        {total === 0 && <div className="text-xs text-stone-400">Нет данных.</div>}
      </div>
    </div>
  );
}

const TYPE_HEX: Record<string, string> = {
  TMC: '#d97706', TRANSPORT: '#0284c7', QUARRY: '#57534e', FUNDS: '#059669',
  FUEL: '#dc2626', TRAVEL: '#7c3aed', PRODUCTION: '#db2777',
};
const LOAD_HEX = ['#0284c7', '#059669', '#d97706', '#7c3aed', '#dc2626', '#0891b2'];

function DashboardTab({ requests, boot, onOpen }: { requests: any[]; boot: any; onOpen: (id: string) => void }) {
  const now = Date.now();
  const rs = requests.filter((r) => !r.consolidatedIntoId);
  const active = rs.filter((r) => !['DONE', 'REJECTED'].includes(r.status));
  const supplyAll = rs.filter((r) => r.status === 'SUPPLY');
  const pool = supplyAll.filter((r) => !r.assigneeId);
  const overdueList = active.filter((r) => overdueDays(r.due, r.status) > 0).sort((a, b) => overdueDays(b.due, b.status) - overdueDays(a.due, a.status));
  const waiting = rs.filter((r) => r.status === 'FULFILLED');
  const pending = rs.filter((r) => r.status === 'APPROVAL');
  const stuck = pending.filter((r) => {
    const times = [+new Date(r.createdAt), ...((r.events || []).map((e: any) => +new Date(e.at)))];
    return now - Math.max(...times) > 86400000;
  });
  const overdueTotalDays = overdueList.reduce((s, r) => s + overdueDays(r.due, r.status), 0);
  const done7 = rs.filter((r) => (r.events || []).some((e: any) => ['FULFILLED', 'CONFIRMED'].includes(e.action) && now - +new Date(e.at) < 7 * 86400000)).length;
  const urgent = active.filter((r) => ['URGENT', 'HIGH'].includes(r.priority) && r.status !== 'FULFILLED');
  const supplyUsers = boot.users.filter((u: any) => u.role === 'SUPPLY');

  const attention: { r: any; why: string; cls: string }[] = [];
  const seen = new Set<string>();
  const push = (r: any, why: string, cls: string) => { if (!seen.has(r.id) && attention.length < 7) { seen.add(r.id); attention.push({ r, why, cls }); } };
  overdueList.forEach((r) => push(r, `просрочено ${overdueDays(r.due, r.status)} дн.`, 'text-rose-600'));
  urgent.filter((r) => r.status === 'SUPPLY' && !r.assigneeId).forEach((r) => push(r, 'срочная, не взята', 'text-amber-700'));
  stuck.forEach((r) => { const step = r.chainSteps?.find((s: any) => s.order === r.currentStageIndex); push(r, `ждёт: ${step ? step.approverName : '—'} > 1 дн.`, 'text-stone-500'); });

  const kpis = [
    { t: 'Просрочено', v: overdueList.length, c: overdueList.length ? 'text-rose-600' : 'text-stone-900', s: 'срок прошёл' },
    { t: 'Не взяты в работу', v: pool.length, c: pool.length ? 'text-amber-700' : 'text-stone-900', s: 'в пуле снабжения' },
    { t: 'Зависли на согласовании', v: stuck.length, c: stuck.length ? 'text-amber-700' : 'text-stone-900', s: 'больше суток без решения' },
    { t: 'Ждут подтверждения', v: waiting.length, c: waiting.length ? 'text-violet-700' : 'text-stone-900', s: 'выполнено, не принято' },
    { t: 'Закрыто за 7 дней', v: done7, c: done7 ? 'text-emerald-700' : 'text-stone-900', s: 'выполнено и принято' },
  ];

  const byStatus = [
    { label: 'Согласование', v: pending.length, hex: '#d97706' },
    { label: 'В снабжении', v: supplyAll.length, hex: '#0284c7' },
    { label: 'Ждут подтверждения', v: waiting.length, hex: '#7c3aed' },
  ];
  const byType = Object.keys(TYPE_RU)
    .map((k) => ({ label: TYPE_RU[k], v: active.filter((r) => r.type === k).length, hex: TYPE_HEX[k] || '#78716c' }))
    .filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
  const byLoad = [
    { label: 'Пул (не взяты)', v: pool.length, hex: '#a8a29e' },
    ...supplyUsers.map((u: any, i: number) => ({ label: (u.name || '').split(/[\s—]+/)[0], v: supplyAll.filter((r) => r.assigneeId === u.id).length, hex: LOAD_HEX[i % LOAD_HEX.length] })),
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {kpis.map((k, i) => (
          <div key={i} className={`p-3 ${card}`}>
            <div className={`text-2xl font-semibold tabular-nums ${k.c}`}>{k.v}</div>
            <div className="mt-0.5 text-xs font-medium text-stone-700">{k.t}</div>
            <div className="text-xs text-stone-400">{k.s}</div>
          </div>
        ))}
      </div>
      <div className={`p-4 ${card}`}>
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-400">Требуют внимания</div>
        {attention.length === 0 ? <p className="text-sm text-stone-400">Всё спокойно — проблемных заявок нет.</p> : (
          <div className="space-y-1">
            {attention.map(({ r, why, cls }) => (
              <button key={r.id} onClick={() => onOpen(r.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-stone-50">
                <span className="shrink-0 font-mono text-xs font-semibold text-stone-900">{r.number}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-stone-700">{reqTitle(r, boot)}</span>
                <span className={`shrink-0 text-xs font-medium ${cls}`}>{why}</span>
              </button>
            ))}
          </div>
        )}
        {overdueTotalDays > 0 && (
          <div className="mt-3 flex items-center justify-end gap-1.5 border-t border-stone-100 pt-2 text-xs text-stone-500">
            <AlertTriangle className="h-3.5 w-3.5 text-rose-500" /> Суммарная просрочка: <span className="font-semibold text-rose-600">{overdueTotalDays} дн.</span>
          </div>
        )}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className={`p-4 ${card}`}><div className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-400">Активные по статусу</div><Donut items={byStatus} /></div>
        <div className={`p-4 ${card}`}><div className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-400">Активные по типам</div><Donut items={byType.length ? byType : [{ label: 'Нет активных', v: 0, hex: '#e7e5e4' }]} /></div>
        <div className={`p-4 ${card}`}><div className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-400">Загрузка снабжения</div><Donut items={byLoad} /></div>
      </div>
    </div>
  );
}

/** Смена собственного пароля — доступна всем ролям (раньше пароль мог сбросить только админ). */
function ChangePasswordCard({ onClose }: { onClose: () => void }) {
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr(''); setMsg('');
    if (!oldPw) { setErr('Введите текущий пароль.'); return; }
    if (newPw.length < 4) { setErr('Новый пароль — минимум 4 символа.'); return; }
    if (newPw !== confirmPw) { setErr('Новый пароль и подтверждение не совпадают.'); return; }
    setBusy(true);
    try {
      await api.changePassword(oldPw, newPw);
      setOldPw(''); setNewPw(''); setConfirmPw('');
      setMsg('Пароль изменён.');
      setTimeout(onClose, 1200);
    } catch (e: any) { setErr(e?.message || 'Не удалось изменить пароль'); }
    finally { setBusy(false); }
  };

  return (
    <div className={`mb-4 p-4 ${card}`}>
      <div className="mb-2 text-sm font-semibold text-stone-700">Смена пароля</div>
      <ErrorBox msg={err} />
      {msg && <div className="mb-3 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</div>}
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={labelCls}>Текущий пароль</label>
          <input type="password" className={inputCls} value={oldPw} onChange={(e) => setOldPw(e.target.value)} autoComplete="current-password" />
        </div>
        <div>
          <label className={labelCls}>Новый пароль</label>
          <input type="password" className={inputCls} value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" />
        </div>
        <div>
          <label className={labelCls}>Повторите новый пароль</label>
          <input type="password" className={inputCls} value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={submit} disabled={busy} className={btnPrimary}>{busy ? 'Сохранение…' : 'Сохранить'}</button>
        <button onClick={onClose} className={btnGhost}>Отмена</button>
      </div>
    </div>
  );
}

type TabKey = 'notes' | 'calendar' | 'messenger' | 'dashboard' | 'reports' | 'archive' | 'log' | 'settings';

export function PersonalHub({ me, boot, requests, orders, notes, setNotes, avatarUrl, onAvatarChange, onOpenReq, onOpenReqInBank, onOpenOrder, reload }: {
  me: any; boot: any; requests: any[]; orders: any[]; notes: any[]; setNotes: (n: any[]) => void;
  avatarUrl: string | null; onAvatarChange: (url: string) => void;
  onOpenReq: (id: string) => void; onOpenReqInBank: (id: string) => void; onOpenOrder: (id: string) => void; reload: () => void;
}) {
  const isAdmin = me.role === 'ADMIN';
  const isSupplyOrAdmin = isAdmin || me.role === 'SUPPLY';
  const { dark, toggleTheme } = useTheme();
  const dept = boot.departments.find((d: any) => d.id === me.departmentId);
  const avaRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<TabKey>('notes');
  const [pwOpen, setPwOpen] = useState(false);

  const uploadAvatar = async (f: File | undefined) => {
    if (!f) return;
    const r: any = await api.settings.avatar(f);
    onAvatarChange(r.avatarUrl);
  };

  const tabs: { k: TabKey; t: string; icon: any }[] = [
    { k: 'notes', t: 'Заметки', icon: NotebookPen },
    { k: 'calendar', t: 'Календарь', icon: CalendarDays },
    { k: 'messenger', t: 'Мессенджер', icon: MessageSquare },
    ...(isSupplyOrAdmin ? [{ k: 'dashboard' as const, t: 'Дашборд', icon: LayoutDashboard }] : []),
    ...(isSupplyOrAdmin ? [{ k: 'reports' as const, t: 'Отчёты', icon: BarChart3 }] : []),
    { k: 'archive', t: 'Архив', icon: Archive },
    ...(isAdmin ? [{ k: 'log' as const, t: 'Журнал', icon: BookOpen }] : []),
    ...(isAdmin ? [{ k: 'settings' as const, t: 'Настройки', icon: SettingsIcon }] : []),
  ];

  return (
    <div>
      <div className={`mb-4 flex flex-wrap items-center gap-3 p-4 ${card}`}>
        <input ref={avaRef} type="file" accept="image/*" className="hidden" onChange={(e) => { uploadAvatar(e.target.files?.[0]); e.target.value = ''; }} />
        <button onClick={() => avaRef.current?.click()} className="group relative shrink-0 rounded-full" title="Изменить фото">
          {avatarUrl
            ? <img src={avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
            : <div className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-200 text-lg font-semibold text-stone-500">{(me.name || '?')[0]}</div>}
          <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 group-hover:text-stone-800"><Camera className="h-3 w-3" /></span>
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold leading-tight text-stone-900">{me.name}</div>
          {dept && <div className="mt-0.5 text-xs text-stone-500">{dept.name}</div>}
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">
          <button onClick={() => setPwOpen((v) => !v)} title="Сменить пароль"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50">
            <KeyRound className="h-4 w-4" /> Пароль
          </button>
          <button onClick={toggleTheme} title="Переключить тему"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}{dark ? 'День' : 'Ночь'}
          </button>
          <span className="shrink-0 rounded-md bg-stone-100 px-2 py-1 text-xs font-medium text-stone-600">{ROLE_RU[me.role] || me.role}</span>
        </div>
      </div>

      {pwOpen && <ChangePasswordCard onClose={() => setPwOpen(false)} />}

      <div className="mb-4 flex flex-wrap gap-1.5 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)} className={pillCls(tab === t.k)}>
            <t.icon className="h-4 w-4" /> {t.t}
          </button>
        ))}
      </div>

      <div key={tab} className="anim-tab-in">
        {tab === 'notes' && <Notebook notes={notes} setNotes={setNotes} />}
        {tab === 'calendar' && <CalendarPane me={me} />}
        {tab === 'messenger' && <CommsView me={me} />}
        {tab === 'dashboard' && isSupplyOrAdmin && <DashboardTab requests={requests} boot={boot} onOpen={onOpenReq} />}
        {tab === 'reports' && isSupplyOrAdmin && <ReportsView requests={requests} orders={orders} boot={boot} />}
        {tab === 'archive' && <ArchiveTab me={me} boot={boot} requests={requests} onOpen={onOpenReq} />}
        {tab === 'log' && isAdmin && <ActionLog requests={requests} orders={orders} boot={boot} onOpenReq={onOpenReqInBank} onOpenOrder={onOpenOrder} />}
        {tab === 'settings' && isAdmin && <SettingsView boot={boot} me={me} reload={reload} />}
      </div>
    </div>
  );
}
