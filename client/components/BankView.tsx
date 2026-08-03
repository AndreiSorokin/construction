'use client';
import { useState } from 'react';
import {
  Search, Filter, ChevronUp, ChevronDown, AlertTriangle, Paperclip, ListChecks, ClipboardList,
} from 'lucide-react';
import { inputCls, ObjectDot, TypeBadge } from './ui';
import { STATUS_RU, TYPE_RU, fmtDate } from '@/lib/format';
import { STATUS_RANK, reqTitle, itemProgress, inDateRange, holderOf, HAS_ITEMS, TYPE_BORDER } from '@/lib/requestHelpers';

const overdueDaysOf = (r: any) => {
  if (!r.due || (r.status !== 'APPROVAL' && r.status !== 'SUPPLY')) return 0;
  const d = new Date(r.due); d.setHours(0, 0, 0, 0);
  const n = new Date(); n.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((n.getTime() - d.getTime()) / 86400000));
};

/** «Банк»: общий реестр всех активных заявок компании — виден всем, независимо от роли и отдела. */
export function BankView({ me, boot, requests, onOpen }: { me: any; boot: any; requests: any[]; onOpen: (id: string) => void }) {
  const [q, setQ] = useState(''); const [deptF, setDeptF] = useState('all'); const [typeF, setTypeF] = useState('all');
  const [dateFrom, setDateFrom] = useState(''); const [dateTo, setDateTo] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortK, setSortK] = useState('created'); const [dir, setDir] = useState(-1);
  const activeFilters = (deptF !== 'all' ? 1 : 0) + (typeF !== 'all' ? 1 : 0) + ((dateFrom || dateTo) ? 1 : 0);

  const objOf = (r: any) => boot.objects.find((o: any) => o.id === r.objectId);
  const deptName = (r: any) => boot.departments.find((d: any) => d.id === r.departmentId)?.name || '';
  const requesterOf = (r: any) => boot.users.find((u: any) => u.id === r.requesterId)?.name || '—';

  let list = requests.filter((r) => r.status !== 'DONE' && r.status !== 'REJECTED' && !r.consolidatedIntoId);
  if (deptF !== 'all') list = list.filter((r) => r.departmentId === deptF);
  if (typeF !== 'all') list = list.filter((r) => r.type === typeF);
  list = list.filter((r) => inDateRange(r.createdAt, dateFrom, dateTo));
  if (q.trim()) { const x = q.trim().toLowerCase(); list = list.filter((r) => r.number.toLowerCase().includes(x) || reqTitle(r, boot).toLowerCase().includes(x)); }

  const cols: { k: string; t: string; cmp: (a: any, b: any) => number }[] = [
    { k: 'number', t: '№', cmp: (a, b) => a.number.localeCompare(b.number, 'ru') },
    { k: 'title', t: 'Заявка', cmp: (a, b) => reqTitle(a, boot).localeCompare(reqTitle(b, boot), 'ru') },
    { k: 'type', t: 'Тип', cmp: (a, b) => String(a.type).localeCompare(String(b.type), 'ru') },
    { k: 'dept', t: 'Отдел', cmp: (a, b) => deptName(a).localeCompare(deptName(b), 'ru') },
    { k: 'req', t: 'Заявитель', cmp: (a, b) => requesterOf(a).localeCompare(requesterOf(b), 'ru') },
    { k: 'holder', t: 'У кого', cmp: (a, b) => holderOf(a, boot).localeCompare(holderOf(b, boot), 'ru') },
    { k: 'created', t: 'Дата', cmp: (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt) },
    { k: 'overdue', t: 'Просрочка', cmp: (a, b) => overdueDaysOf(a) - overdueDaysOf(b) },
    { k: 'status', t: 'Статус', cmp: (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] },
  ];
  const col = cols.find((c) => c.k === sortK) || cols[6];
  const rows = [...list].sort((a, b) => dir * col.cmp(a, b));
  const click = (k: string) => { if (k === sortK) setDir((d) => -d); else { setSortK(k); setDir(1); } };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Банк</h1>
        <span className="font-mono text-sm text-stone-400">{list.length} в работе</span>
      </div>
      <p className="mb-3 text-xs text-stone-500">Все активные заявки компании — по всем отделам и объектам, независимо от того, кто их подал или ведёт.</p>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-stone-400" />
          <input className={`${inputCls} w-56 pl-8`} placeholder="Поиск…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button onClick={() => setFiltersOpen((v) => !v)}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition ${filtersOpen || activeFilters ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 bg-white text-stone-600 hover:bg-stone-50'}`}>
          <Filter className="h-4 w-4" /> Фильтры
          {activeFilters > 0 && <span className={`rounded-full px-1.5 text-xs font-bold ${filtersOpen ? 'bg-white text-stone-900' : 'bg-amber-400 text-stone-900'}`}>{activeFilters}</span>}
        </button>
      </div>
      <div className={`${filtersOpen ? 'flex' : 'hidden'} mb-4 flex-wrap items-center gap-2`}>
        <select className={`${inputCls} w-44`} value={deptF} onChange={(e) => setDeptF(e.target.value)}>
          <option value="all">Все отделы</option>
          {boot.departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select className={`${inputCls} w-44`} value={typeF} onChange={(e) => setTypeF(e.target.value)}>
          <option value="all">Все типы</option>
          {Object.entries(TYPE_RU).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input type="date" className={`${inputCls} w-40`} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="С даты" />
        <input type="date" className={`${inputCls} w-40`} value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="По дату" />
        {activeFilters > 0 && (
          <button onClick={() => { setDeptF('all'); setTypeF('all'); setDateFrom(''); setDateTo(''); }}
            className="shrink-0 text-xs font-medium text-stone-500 underline hover:text-stone-800">Сбросить</button>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white py-12 text-center">
          <ClipboardList className="mx-auto h-7 w-7 text-stone-300" />
          <p className="mt-2 text-sm text-stone-500">Сейчас нет заявок в работе.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
          <table className="w-full text-sm" style={{ minWidth: 900 }}>
            <thead><tr className="border-b border-stone-200 bg-stone-50 text-left text-xs text-stone-500">
              {cols.map((c) => <th key={c.k} className="px-3 py-2.5 font-semibold uppercase tracking-wide">
                <button onClick={() => click(c.k)} className={`inline-flex items-center gap-0.5 hover:text-stone-900 ${sortK === c.k ? 'text-stone-900' : ''}`}>
                  {c.t}{sortK === c.k && (dir === 1 ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />)}
                </button>
              </th>)}
            </tr></thead>
            <tbody>{rows.map((r) => {
              const obj = objOf(r); const title = reqTitle(r, boot); const dupObj = obj && title === obj.name;
              const nAtt = (r.attachments || []).length;
              const prog = HAS_ITEMS.has(r.type) && r.status === 'SUPPLY' ? itemProgress(r) : null;
              const d = overdueDaysOf(r);
              return (
                <tr key={r.id} onClick={() => onOpen(r.id)}
                  className={`cursor-pointer border-b border-l-4 border-stone-100 transition hover:bg-stone-50 ${TYPE_BORDER[r.type] || 'border-l-stone-300'} ${r.postponed ? 'opacity-60' : ''}`}>
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs font-semibold text-stone-900">{r.number}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="block truncate text-stone-800" style={{ maxWidth: 240 }}>{title}</span>
                      {obj && !dupObj && <ObjectDot color={obj.color} />}
                      {nAtt > 0 && <span className="inline-flex shrink-0 items-center gap-0.5 text-xs text-stone-400"><Paperclip className="h-3 w-3" />{nAtt}</span>}
                      {prog && prog.total > 0 && <span className={`inline-flex shrink-0 items-center gap-0.5 text-xs ${prog.done === prog.total ? 'text-emerald-600' : 'text-stone-400'}`}><ListChecks className="h-3 w-3" />{prog.done}/{prog.total}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5"><TypeBadge type={r.type} /></td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs text-stone-500">{deptName(r) || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs text-stone-500">{requesterOf(r)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs text-stone-500">{holderOf(r, boot)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-stone-500">{fmtDate(r.createdAt)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs">
                    {d > 0 ? <span className="inline-flex items-center gap-1 font-semibold text-rose-600"><AlertTriangle className="h-3 w-3" />{d} дн.</span> : <span className="text-stone-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5"><span className="rounded-full border px-2.5 py-0.5 text-xs font-medium">{STATUS_RU[r.status] || r.status}</span></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
