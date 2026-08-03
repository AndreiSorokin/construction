'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import {
  Search, Filter, FileDown, Table, Columns, Inbox, User, AlertTriangle, Calendar, Layers, Pause,
  CheckCircle2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Check, Plus, Paperclip, ListChecks,
} from 'lucide-react';
import { btnGhost, DueBadge, ObjectDot, TypeBadge, appConfirm, appPrompt } from './ui';
import { TYPE_RU, PRIORITY_RU, STATUS_RU, fmtDate } from '@/lib/format';
import {
  HAS_ITEMS, TYPE_BORDER, PRI_RANK, PRI_SELECT_CLS, reqTitle, itemProgress, inDateRange, toCSV, downloadFile,
} from '@/lib/requestHelpers';

const selectCls = 'rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-600 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-100';

const BOARD_COLS = [
  { k: 'NEW', t: 'Входящие', dot: 'bg-stone-400' },
  { k: 'INWORK', t: 'В работе', dot: 'bg-sky-500' },
  { k: 'PAUSED', t: 'На паузе', dot: 'bg-violet-500' },
  { k: 'ORDERED', t: 'Заказано', dot: 'bg-amber-500' },
];
const colOf = (r: any) => (r.postponed ? 'PAUSED' : (r.supplyStage === 'ARRIVED' ? 'ORDERED' : (r.supplyStage || 'NEW')));

function Avatar({ name }: { name?: string | null }) {
  const initials = (name || '?').split(/[\s—-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const palette = ['bg-sky-200 text-sky-800', 'bg-emerald-200 text-emerald-800', 'bg-violet-200 text-violet-800', 'bg-amber-200 text-amber-800', 'bg-rose-200 text-rose-800', 'bg-teal-200 text-teal-800'];
  let h = 0; for (const c of (name || 'x')) h = (h + c.charCodeAt(0)) % palette.length;
  return <span title={name || undefined} className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${palette[h]}`}>{initials || '?'}</span>;
}

const fail = (e: any, fallback: string) => appConfirm(e?.message || fallback, { okText: 'Понятно' });

export function SupplyBoard({ me, boot, requests, onOpen, onReplace, onReloadAll, selecting, selected, onToggleSel, selectableCheck }: {
  me: any; boot: any; requests: any[]; onOpen: (id: string) => void;
  onReplace: (r: any) => void; onReloadAll: () => void;
  selecting?: boolean; selected?: string[]; onToggleSel?: (id: string) => void; selectableCheck?: (r: any) => boolean;
}) {
  const [list, setList] = useState<'inbox' | 'mine' | 'urgent' | 'today' | 'all' | 'postponed' | 'done'>('inbox');
  const [view, setView] = useState<'table' | 'board'>('table');
  const [sort, setSort] = useState<'priority' | 'created' | 'due' | 'overdue' | 'object'>('priority');
  const [deptF, setDeptF] = useState('all'); const [typeF, setTypeF] = useState('all'); const [objF, setObjF] = useState('all');
  const [q, setQ] = useState(''); const [dateFrom, setDateFrom] = useState(''); const [dateTo, setDateTo] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [tsort, setTsort] = useState<{ k: string; d: number }>({ k: 'created', d: -1 });
  const [drag, setDrag] = useState<string | null>(null);
  const activeFilters = (deptF !== 'all' ? 1 : 0) + (typeF !== 'all' ? 1 : 0) + (objF !== 'all' ? 1 : 0) + ((dateFrom || dateTo) ? 1 : 0);

  const objOf = (r: any) => boot.objects.find((o: any) => o.id === r.objectId);
  const deptName = (r: any) => boot.departments.find((d: any) => d.id === r.departmentId)?.name || '';
  const supplyUsers = boot.users.filter((u: any) => u.role === 'SUPPLY');
  const canRelease = me.role === 'ADMIN' || me.isLead;

  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
  const supply = requests.filter((r) => r.status === 'SUPPLY' && !r.consolidatedIntoId);
  const fulfilled = requests.filter((r) => r.status === 'FULFILLED');
  const doneRecent = [...requests.filter((r) => r.status === 'DONE')].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 8);

  const lists = [
    { k: 'inbox', t: 'Входящие', icon: Inbox, items: supply.filter((r) => !r.assigneeId) },
    { k: 'mine', t: 'Мои', icon: User, items: supply.filter((r) => r.assigneeId === me.id) },
    { k: 'urgent', t: 'Срочные', icon: AlertTriangle, items: supply.filter((r) => ['URGENT', 'HIGH'].includes(r.priority)) },
    { k: 'today', t: 'Срок подошёл', icon: Calendar, items: supply.filter((r) => r.due && new Date(r.due) <= todayEnd) },
    { k: 'all', t: 'Все активные', icon: Layers, items: supply },
    { k: 'postponed', t: 'Отложенные', icon: Pause, items: supply.filter((r) => r.postponed) },
    { k: 'done', t: 'Выполнено', icon: CheckCircle2, items: [...fulfilled, ...doneRecent] },
  ] as const;
  const cur = lists.find((l) => l.k === list) || lists[0];
  const overdueDaysOf = (r: any) => {
    if (!r.due || (r.status !== 'APPROVAL' && r.status !== 'SUPPLY')) return 0;
    const d = new Date(r.due); d.setHours(0, 0, 0, 0);
    const n = new Date(); n.setHours(0, 0, 0, 0);
    return Math.max(0, Math.round((n.getTime() - d.getTime()) / 86400000));
  };
  const sorters: Record<string, (a: any, b: any) => number> = {
    priority: (a, b) => (PRI_RANK[a.priority] - PRI_RANK[b.priority]) || (+new Date(a.createdAt) - +new Date(b.createdAt)),
    created: (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
    due: (a, b) => (a.due ? +new Date(a.due) : 8.64e15) - (b.due ? +new Date(b.due) : 8.64e15),
    object: (a, b) => (objOf(a)?.name || 'яя').localeCompare(objOf(b)?.name || 'яя', 'ru') || (PRI_RANK[a.priority] - PRI_RANK[b.priority]),
    overdue: (a, b) => (overdueDaysOf(b) - overdueDaysOf(a)) || ((a.due ? +new Date(a.due) : 8.64e15) - (b.due ? +new Date(b.due) : 8.64e15)),
  };

  let rows = cur.items as any[];
  if (deptF !== 'all') rows = rows.filter((r) => r.departmentId === deptF);
  if (typeF !== 'all') rows = rows.filter((r) => r.type === typeF);
  if (objF !== 'all') rows = rows.filter((r) => r.objectId === objF);
  rows = rows.filter((r) => inDateRange(r.createdAt, dateFrom, dateTo));
  if (q.trim()) { const x = q.trim().toLowerCase(); rows = rows.filter((r) => r.number.toLowerCase().includes(x) || reqTitle(r, boot).toLowerCase().includes(x)); }
  rows = [...rows].sort(sorters[sort]);

  const TCOLS = [
    { k: 'number', t: '№', get: (r: any) => r.number },
    { k: 'title', t: 'Заявка', get: (r: any) => reqTitle(r, boot) },
    { k: 'type', t: 'Тип', get: (r: any) => TYPE_RU[r.type] },
    { k: 'dept', t: 'Отдел', get: deptName },
    { k: 'object', t: 'Объект', get: (r: any) => objOf(r)?.name || '' },
    { k: 'priority', t: 'Приоритет', get: (r: any) => PRIORITY_RU[r.priority], cmp: (a: any, b: any) => PRI_RANK[a.priority] - PRI_RANK[b.priority] },
    { k: 'due', t: 'Срок', get: (r: any) => (r.due ? fmtDate(r.due) : '—'), cmp: (a: any, b: any) => (a.due ? +new Date(a.due) : 8.64e15) - (b.due ? +new Date(b.due) : 8.64e15) },
    { k: 'status', t: 'Статус', get: (r: any) => STATUS_RU[r.status] || r.status },
    { k: 'created', t: 'Создана', get: (r: any) => fmtDate(r.createdAt), cmp: (a: any, b: any) => +new Date(a.createdAt) - +new Date(b.createdAt) },
    { k: 'spent', t: 'Потрачено', get: (r: any) => (r.spent != null ? r.spent : ''), cmp: (a: any, b: any) => (Number(a.spent) || 0) - (Number(b.spent) || 0) },
  ];
  const tcol = TCOLS.find((c) => c.k === tsort.k) || TCOLS[8];
  const tRows = [...rows].sort((a, b) => tsort.d * ((tcol as any).cmp ? (tcol as any).cmp(a, b) : String(tcol.get(a)).localeCompare(String(tcol.get(b)), 'ru')));
  const thClick = (k: string) => setTsort((p) => (p.k === k ? { k, d: -p.d } : { k, d: 1 }));
  const exportRows = () => downloadFile(`zayavki-${new Date().toISOString().slice(0, 10)}.csv`, toCSV([TCOLS.map((c) => c.t), ...(view === 'table' ? tRows : rows).map((r) => TCOLS.map((c) => c.get(r)))]), 'text/csv');

  const claim = async (id: string) => { try { onReplace(await api.requests.claim(id)); } catch (e: any) { fail(e, 'Не удалось взять заявку'); } };
  const completeReq = async (r: any) => {
    const p = itemProgress(r);
    const ask = async () => {
      const sIn = await appPrompt('Фактически потрачено по заявке, ₸ (можно оставить пустым):', { initial: r.spent != null ? String(r.spent) : '' });
      if (sIn === null) return;
      try {
        const updated = await api.requests.fulfill(r.id);
        const v = Number(String(sIn).replace(',', '.'));
        if (updated.isConsolidated) { onReloadAll(); return; }
        if (sIn.trim() !== '' && v > 0) onReplace(await api.requestsX.spent(r.id, v));
        else onReplace(updated);
      } catch (e: any) { fail(e, 'Не удалось отметить заявку выполненной'); }
    };
    if (p.total && p.done < p.total) { if (await appConfirm('Не все позиции закрыты. Отметить заявку выполненной?')) ask(); }
    else ask();
  };
  const moveToCol = async (r: any, colKey: string) => {
    try {
      if (colKey === 'PAUSED') { onReplace(await api.requests.postpone(r.id, true)); return; }
      if (colKey === 'NEW') {
        if (!canRelease) return;
        let updated = await api.requestsX.release(r.id);
        if (r.postponed) updated = await api.requests.postpone(r.id, false);
        onReplace(updated); return;
      }
      if (r.postponed) await api.requests.postpone(r.id, false);
      let updated = await api.requests.setStage(r.id, colKey);
      if (!updated.assigneeId) updated = await api.requests.claim(r.id);
      onReplace(updated);
    } catch (e: any) { fail(e, 'Не удалось переместить заявку'); }
  };
  const moveStage = (r: any, dir: number) => {
    const order = BOARD_COLS.map((c) => c.k);
    const i = order.indexOf(colOf(r));
    const j = Math.min(order.length - 1, Math.max(0, i + dir));
    moveToCol(r, order[j]);
  };
  const setPriority = async (id: string, priority: string) => { try { onReplace(await api.requestsX.priority(id, priority)); } catch (e: any) { fail(e, 'Не удалось изменить приоритет'); } };

  const progChip = (r: any) => { if (!HAS_ITEMS.has(r.type)) return null; const p = itemProgress(r); return p.total ? <span className="inline-flex items-center gap-1"><ListChecks className="h-3 w-3" />{p.done}/{p.total}</span> : null; };
  const priSelect = (r: any) => (
    <select value={r.priority} onChange={(e) => setPriority(r.id, e.target.value)} title="Приоритет"
      className={`rounded-md border bg-white px-1.5 py-1 text-xs font-medium focus:outline-none ${PRI_SELECT_CLS[r.priority]}`}>
      {Object.entries(PRIORITY_RU).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
    </select>
  );

  const renderRow = (r: any) => {
    if (selecting) {
      const ok = !selectableCheck || selectableCheck(r);
      const on = (selected || []).includes(r.id);
      return (
        <button key={r.id} disabled={!ok} onClick={() => onToggleSel && onToggleSel(r.id)}
          className={`flex w-full items-center gap-2 rounded-lg border p-2.5 text-left shadow-sm transition disabled:opacity-40 ${on ? 'border-amber-400 ring-2 ring-amber-200' : 'border-stone-200'}`}>
          <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${on ? 'border-amber-500 bg-amber-500 text-white' : 'border-stone-300'}`}>{on && <Check className="h-3 w-3" />}</span>
          <span className="shrink-0 font-mono text-xs font-semibold text-stone-900">{r.number}</span><TypeBadge type={r.type} />
          <span className="min-w-0 flex-1 truncate text-sm text-stone-700">{reqTitle(r, boot)}</span>
          {!ok && <span className="shrink-0 text-xs text-stone-400">нельзя объединить</span>}
        </button>
      );
    }
    const assignee = supplyUsers.find((u: any) => u.id === r.assigneeId);
    const obj = objOf(r);
    const title = reqTitle(r, boot);
    const dupObj = obj && title === obj.name;
    return (
      <div key={r.id} className={`overflow-hidden rounded-lg border border-l-4 border-stone-200 bg-white shadow-sm transition hover:border-stone-300 ${TYPE_BORDER[r.type] || 'border-l-stone-300'}`}>
        <div className="flex items-center gap-2 p-2">
          <button onClick={() => onOpen(r.id)} className="flex min-w-0 flex-1 flex-col text-left">
            <div className="flex items-center gap-2"><span className="shrink-0 font-mono text-xs font-semibold text-stone-900">{r.number}</span><span className="min-w-0 flex-1 truncate text-sm font-medium text-stone-800">{title}</span></div>
            <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-stone-500">
              <TypeBadge type={r.type} />
              {deptName(r) && <span className="rounded bg-stone-100 px-1.5 py-0.5">{deptName(r)}</span>}
              {obj && !dupObj && <span className="inline-flex min-w-0 items-center gap-1"><ObjectDot color={obj.color} /><span className="truncate">{obj.name}</span></span>}
              <DueBadge due={r.due} status={r.status} />
              {progChip(r)}
              {(r.attachments || []).length > 0 && <span className="inline-flex shrink-0 items-center gap-1"><Paperclip className="h-3 w-3" />{r.attachments.length}</span>}
              {r.postponed && <span className="inline-flex shrink-0 items-center gap-1 text-stone-400"><Pause className="h-3 w-3" />отлож.</span>}
            </div>
          </button>
          {r.status === 'SUPPLY' ? (
            <div className="flex shrink-0 items-center gap-1">
              {!r.assigneeId ? <button onClick={() => claim(r.id)} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-stone-900 px-2 py-1 text-xs font-medium text-white hover:bg-stone-800"><Plus className="h-3.5 w-3.5" />Взять</button>
                : <span className="shrink-0" title={assignee ? assignee.name : ''}><Avatar name={assignee ? assignee.name : '?'} /></span>}
              <button onClick={() => completeReq(r)} title="Отметить выполненной" className="shrink-0 rounded p-1 text-stone-300 hover:bg-emerald-50 hover:text-emerald-600"><CheckCircle2 className="h-5 w-5" /></button>
            </div>
          ) : <span className="shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium">{STATUS_RU[r.status] || r.status}</span>}
        </div>
      </div>
    );
  };

  const boardCard = (r: any) => {
    const assignee = supplyUsers.find((u: any) => u.id === r.assigneeId);
    const obj = objOf(r);
    return (
      <div key={r.id} draggable onDragStart={() => setDrag(r.id)} onDragEnd={() => setDrag(null)}
        className={`cursor-grab rounded-lg border border-l-4 border-stone-200 bg-white p-2 shadow-sm ${TYPE_BORDER[r.type] || 'border-l-stone-300'}`}>
        <div className="flex items-center gap-1.5">
          <button onClick={() => onOpen(r.id)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left"><span className="font-mono text-xs font-semibold text-stone-900">{r.number}</span><TypeBadge type={r.type} /></button>
          {r.assigneeId ? <Avatar name={assignee ? assignee.name : '?'} /> : <button onClick={() => claim(r.id)} className="shrink-0 rounded bg-stone-900 px-1.5 py-0.5 text-xs text-white hover:bg-stone-800">Взять</button>}
        </div>
        <button onClick={() => onOpen(r.id)} className="mt-1 block w-full truncate text-left text-xs font-medium text-stone-800">{reqTitle(r, boot)}</button>
        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-stone-500">{obj && <ObjectDot color={obj.color} />}<DueBadge due={r.due} status={r.status} />{progChip(r)}</div>
        <div className="mt-1.5 flex items-center gap-0.5 border-t border-stone-100 pt-1">
          {priSelect(r)}<span className="flex-1" />
          <button onClick={() => moveStage(r, -1)} className="rounded p-0.5 text-stone-400 hover:bg-stone-100" title="Назад"><ChevronLeft className="h-3.5 w-3.5" /></button>
          <button onClick={() => moveStage(r, 1)} className="rounded p-0.5 text-stone-400 hover:bg-stone-100" title="Дальше"><ChevronRight className="h-3.5 w-3.5" /></button>
          <button onClick={() => completeReq(r)} title="Выполнено" className="rounded p-0.5 text-stone-400 hover:bg-stone-100 hover:text-emerald-600"><Check className="h-3.5 w-3.5" /></button>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="mb-3 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex flex-1 items-center gap-1.5 rounded-lg border border-stone-300 px-2.5 py-1.5" style={{ minWidth: 170 }}>
            <Search className="h-4 w-4 shrink-0 text-stone-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск" className="w-full min-w-0 bg-transparent text-sm focus:outline-none" />
          </div>
          <button onClick={() => setFiltersOpen((v) => !v)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition ${filtersOpen || activeFilters ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 bg-white text-stone-600 hover:bg-stone-50'}`}>
            <Filter className="h-4 w-4" /> Фильтры{activeFilters > 0 && <span className={`rounded-full px-1.5 text-xs font-bold ${filtersOpen ? 'bg-white text-stone-900' : 'bg-amber-400 text-stone-900'}`}>{activeFilters}</span>}
          </button>
          {!selecting && <button onClick={exportRows} className={btnGhost} title="Выгрузить текущий список в Excel (CSV)"><FileDown className="h-4 w-4" /><span className="hidden sm:inline"> CSV</span></button>}
          {!selecting && <div className="flex shrink-0 rounded-lg border border-stone-300 p-0.5">
            <button onClick={() => setView('table')} className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm ${view === 'table' ? 'bg-stone-900 text-white' : 'text-stone-500 hover:text-stone-800'}`} title="Таблица"><Table className="h-4 w-4" /> Таблица</button>
            <button onClick={() => setView('board')} className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm ${view === 'board' ? 'bg-stone-900 text-white' : 'text-stone-500 hover:text-stone-800'}`} title="Доска"><Columns className="h-4 w-4" /> Доска</button>
          </div>}
        </div>
        <div className={`${filtersOpen ? 'block' : 'hidden'} space-y-1.5`}>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:flex lg:flex-wrap lg:items-center">
            <select value={sort} onChange={(e) => setSort(e.target.value as any)} className={`${selectCls} w-full lg:w-auto`}>
              <option value="priority">По приоритету</option><option value="created">По дате</option><option value="due">По сроку</option><option value="overdue">По просрочке</option><option value="object">По объекту</option>
            </select>
            <select value={deptF} onChange={(e) => setDeptF(e.target.value)} className={`${selectCls} w-full lg:w-auto`}><option value="all">Все отделы</option>{boot.departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
            <select value={typeF} onChange={(e) => setTypeF(e.target.value)} className={`${selectCls} w-full lg:w-auto`}><option value="all">Все типы</option>{Object.entries(TYPE_RU).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <select value={objF} onChange={(e) => setObjF(e.target.value)} className={`${selectCls} w-full lg:w-auto`}><option value="all">Все объекты</option>{boot.objects.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
          </div>
          <div className="flex items-center gap-2">
            <input type="date" className={selectCls} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="С даты" />
            <span className="text-xs text-stone-400">–</span>
            <input type="date" className={selectCls} value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="По дату" />
            {activeFilters > 0 && <button onClick={() => { setDeptF('all'); setTypeF('all'); setObjF('all'); setDateFrom(''); setDateTo(''); }} className="shrink-0 text-xs font-medium text-stone-500 underline hover:text-stone-800">Сбросить</button>}
          </div>
        </div>
      </div>

      {(view !== 'board' || selecting) && (
        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
          {lists.map((l) => { const Icon = l.icon; const on = list === l.k; return (
            <button key={l.k} onClick={() => setList(l.k as any)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${on ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'}`}>
              <Icon className="h-4 w-4" />{l.t}<span className={`ml-0.5 rounded-full px-1.5 text-xs ${on ? 'bg-stone-700 text-stone-200' : 'bg-stone-100 text-stone-500'}`}>{l.items.length}</span>
            </button>
          ); })}
        </div>
      )}

      {view === 'board' && !selecting ? (() => {
        let bs = requests.filter((r) => !r.consolidatedIntoId);
        if (deptF !== 'all') bs = bs.filter((r) => r.departmentId === deptF);
        if (typeF !== 'all') bs = bs.filter((r) => r.type === typeF);
        if (objF !== 'all') bs = bs.filter((r) => r.objectId === objF);
        bs = bs.filter((r) => inDateRange(r.createdAt, dateFrom, dateTo));
        if (q.trim()) { const x = q.trim().toLowerCase(); bs = bs.filter((r) => r.number.toLowerCase().includes(x) || reqTitle(r, boot).toLowerCase().includes(x)); }
        const sb = (arr: any[]) => [...arr].sort(sorters[sort]);
        const done = sb(bs.filter((r) => r.status === 'FULFILLED' || r.status === 'DONE'));
        return (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {BOARD_COLS.map((col) => {
              const items = sb(bs.filter((r) => r.status === 'SUPPLY' && colOf(r) === col.k));
              return (
                <div key={col.k} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag) { const dr = requests.find((r) => r.id === drag); if (dr) moveToCol(dr, col.k); setDrag(null); } }}
                  className="flex flex-1 flex-col rounded-xl border border-stone-200 bg-stone-50 p-2" style={{ minWidth: 230 }}>
                  <div className="mb-2 flex items-center justify-between px-1"><div className="flex items-center gap-1.5 text-sm font-semibold text-stone-700"><span className={`h-2 w-2 rounded-full ${col.dot}`} /> {col.t}</div><span className="font-mono text-xs text-stone-400">{items.length}</span></div>
                  <div className="space-y-2">{items.map(boardCard)}{items.length === 0 && <div className="rounded-lg border border-dashed border-stone-200 py-6 text-center text-xs text-stone-400">пусто</div>}</div>
                </div>
              );
            })}
            <div onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag) { const dr = requests.find((r) => r.id === drag); if (dr && dr.status === 'SUPPLY') completeReq(dr); setDrag(null); } }}
              className="flex flex-1 flex-col rounded-xl border border-stone-200 bg-stone-50 p-2" style={{ minWidth: 230 }}>
              <div className="mb-2 flex items-center justify-between px-1"><div className="flex items-center gap-1.5 text-sm font-semibold text-stone-700"><span className="h-2 w-2 rounded-full bg-emerald-600" /> Выполнено</div><span className="font-mono text-xs text-stone-400">{done.length}</span></div>
              <div className="space-y-2">{done.map((r) => (
                <button key={r.id} onClick={() => onOpen(r.id)} className="block w-full overflow-hidden rounded-lg border border-l-4 border-stone-200 border-l-emerald-400 bg-white p-2.5 text-left shadow-sm hover:border-stone-300">
                  <div className="flex items-center gap-2"><span className="shrink-0 font-mono text-xs font-semibold text-stone-900">{r.number}</span><span className="min-w-0 flex-1 truncate text-sm font-medium text-stone-800">{reqTitle(r, boot)}</span></div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-stone-500"><TypeBadge type={r.type} /><span className="rounded-full border px-2 py-0.5">{STATUS_RU[r.status] || r.status}</span></div>
                </button>
              ))}{done.length === 0 && <div className="rounded-lg border border-dashed border-stone-200 py-6 text-center text-xs text-stone-400">пусто</div>}</div>
            </div>
          </div>
        );
      })() : view === 'table' && !selecting ? (
        rows.length === 0 ? <div className="rounded-xl border border-dashed border-stone-300 bg-white py-12 text-center text-sm text-stone-400">Здесь пусто.</div> : (
          <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
            <table className="w-full text-sm" style={{ minWidth: 920 }}>
              <thead><tr className="border-b border-stone-200 bg-stone-50 text-left text-xs text-stone-500">
                {TCOLS.map((c) => <th key={c.k} className="px-3 py-2 font-semibold uppercase tracking-wide">
                  <button onClick={() => thClick(c.k)} className={`inline-flex items-center gap-0.5 hover:text-stone-900 ${tsort.k === c.k ? 'text-stone-900' : ''}`}>{c.t}{tsort.k === c.k && (tsort.d === 1 ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />)}</button>
                </th>)}
              </tr></thead>
              <tbody>{tRows.map((r) => (
                <tr key={r.id} onClick={() => onOpen(r.id)} className={`cursor-pointer border-b border-stone-100 transition hover:bg-stone-50 ${r.postponed ? 'opacity-60' : ''}`}>
                  <td className="px-3 py-2 font-mono text-xs font-semibold text-stone-900">{r.number}</td>
                  <td className="px-3 py-2 text-stone-800"><span className="block truncate" style={{ maxWidth: 260 }}>{reqTitle(r, boot)}</span></td>
                  <td className="px-3 py-2"><TypeBadge type={r.type} /></td>
                  <td className="px-3 py-2 text-xs text-stone-500">{deptName(r)}</td>
                  <td className="px-3 py-2 text-xs text-stone-500">{objOf(r)?.name || '—'}</td>
                  <td className="px-3 py-2"><span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${PRI_SELECT_CLS[r.priority]}`}>{PRIORITY_RU[r.priority]}</span></td>
                  <td className="px-3 py-2 font-mono text-xs">{r.due ? fmtDate(r.due) : '—'}</td>
                  <td className="px-3 py-2"><span className="rounded-full border px-2 py-0.5 text-xs">{STATUS_RU[r.status] || r.status}</span></td>
                  <td className="px-3 py-2 font-mono text-xs text-stone-500">{fmtDate(r.createdAt)}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{r.spent != null ? r.spent : '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )
      ) : (
        rows.length === 0
          ? <div className="rounded-xl border border-dashed border-stone-300 bg-white py-12 text-center text-sm text-stone-400">{list === 'inbox' ? 'Пул пуст — новых заявок нет.' : list === 'mine' ? 'Вы пока ничего не взяли в работу.' : 'Здесь пусто.'}</div>
          : <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">{rows.map(renderRow)}</div>
      )}
    </div>
  );
}
