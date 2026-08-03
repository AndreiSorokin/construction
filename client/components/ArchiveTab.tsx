'use client';
import { useState } from 'react';
import { Filter, Search } from 'lucide-react';
import { Badge, ObjectDot, TypeBadge } from './ui';
import { STATUS_CLS, STATUS_RU, fmtDate } from '@/lib/format';
import { inDateRange, reqTitle } from '@/lib/requestHelpers';

const selectCls = 'rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-600 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-100';

/** Архив: закрытые и отклонённые заявки, видимость по роли — как в эталоне (ArchiveView). */
export function ArchiveTab({ me, boot, requests, onOpen }: { me: any; boot: any; requests: any[]; onOpen: (id: string) => void }) {
  const [f, setF] = useState<'all' | 'DONE' | 'REJECTED'>('all');
  const [q, setQ] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const visible = requests.filter((r) => {
    if (r.status !== 'DONE' && r.status !== 'REJECTED') return false;
    if (me.role === 'ADMIN' || me.role === 'SUPPLY') return true;
    if (me.role === 'REQUESTER') return r.requesterId === me.id;
    return (r.chainSteps || []).some((s: any) => s.approverId === me.id);
  });
  let list = visible.filter((r) => (f === 'all' || r.status === f) && inDateRange(r.createdAt, dateFrom, dateTo));
  if (q.trim()) { const x = q.trim().toLowerCase(); list = list.filter((r) => r.number.toLowerCase().includes(x) || reqTitle(r, boot).toLowerCase().includes(x)); }
  list = [...list].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  const active = (f !== 'all' ? 1 : 0) + ((dateFrom || dateTo) ? 1 : 0);

  const objOf = (r: any) => boot.objects.find((o: any) => o.id === r.objectId);
  const deptName = (r: any) => boot.departments.find((d: any) => d.id === r.departmentId)?.name || '';
  const requesterOf = (r: any) => boot.users.find((u: any) => u.id === r.requesterId)?.name || '—';

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="relative flex-1" style={{ minWidth: 170 }}>
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-stone-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по номеру или названию"
            className="w-full rounded-lg border border-stone-300 bg-white py-1.5 pl-8 pr-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-100" />
        </div>
        <button onClick={() => setFiltersOpen((v) => !v)}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition ${filtersOpen || active ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 bg-white text-stone-600 hover:bg-stone-50'}`}>
          <Filter className="h-4 w-4" /> Фильтры{active > 0 && <span className={`rounded-full px-1.5 text-xs font-bold ${filtersOpen ? 'bg-white text-stone-900' : 'bg-amber-400 text-stone-900'}`}>{active}</span>}
        </button>
      </div>
      <div className={`${filtersOpen ? 'flex' : 'hidden'} mb-4 flex-wrap items-center gap-2`}>
        <div className="flex gap-1.5">
          {([['all', 'Все'], ['DONE', 'Завершённые'], ['REJECTED', 'Отклонённые']] as const).map(([k, t]) => (
            <button key={k} onClick={() => setF(k)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${f === k ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 bg-white text-stone-600 hover:bg-stone-50'}`}>{t}</button>
          ))}
        </div>
        <input type="date" className={selectCls} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="С даты" />
        <span className="text-xs text-stone-400">–</span>
        <input type="date" className={selectCls} value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="По дату" />
        {active > 0 && <button onClick={() => { setF('all'); setDateFrom(''); setDateTo(''); }} className="shrink-0 text-xs font-medium text-stone-500 underline hover:text-stone-800">Сбросить</button>}
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white py-12 text-center text-sm text-stone-400">Архив пуст.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
          <table className="w-full text-sm" style={{ minWidth: 820 }}>
            <thead><tr className="border-b border-stone-200 bg-stone-50 text-left text-xs text-stone-500">
              {['№', 'Заявка', 'Тип', 'Отдел', 'Заявитель', 'Создана', 'Статус'].map((h) => <th key={h} className="px-3 py-2 font-semibold uppercase tracking-wide">{h}</th>)}
            </tr></thead>
            <tbody>{list.map((r) => {
              const obj = objOf(r); const title = reqTitle(r, boot); const dupObj = obj && title === obj.name;
              return (
                <tr key={r.id} onClick={() => onOpen(r.id)} className="cursor-pointer border-b border-stone-100 transition hover:bg-stone-50">
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs font-semibold text-stone-900">{r.number}</td>
                  <td className="px-3 py-2 text-stone-800">
                    <span className="flex items-center gap-1.5"><span className="block truncate" style={{ maxWidth: 240 }}>{title}</span>{obj && !dupObj && <ObjectDot color={obj.color} />}</span>
                  </td>
                  <td className="px-3 py-2"><TypeBadge type={r.type} /></td>
                  <td className="px-3 py-2 text-xs text-stone-500">{deptName(r) || '—'}</td>
                  <td className="px-3 py-2 text-xs text-stone-500">{requesterOf(r)}</td>
                  <td className="px-3 py-2 font-mono text-xs text-stone-500">{fmtDate(r.createdAt)}</td>
                  <td className="px-3 py-2"><Badge cls={STATUS_CLS[r.status]}>{STATUS_RU[r.status]}</Badge></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
