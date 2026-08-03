'use client';
import { useMemo, useState } from 'react';
import { Calendar, ChevronDown, ChevronUp, Clock, FileDown, Plus, Printer } from 'lucide-react';
import { Badge, Empty, ObjectDot, btnPrimary } from './ui';
import { ORDER_STATUS_CLS, ORDER_STATUS_RU, fmtDate, lineSum, money, periodLabel } from '@/lib/format';
import { toCSV, downloadFile } from '@/lib/requestHelpers';

const orderTotal = (o: any) => (o.lines || []).reduce((s: number, l: any) => s + lineSum(l), 0);

/** Таблица нарядов: № · ИП · Объект · Позиций · Сумма · Создан · Статус — как в эталоне (OrderRows). */
function OrdersTable({ list, onOpen }: { list: any[]; onOpen: (id: string) => void }) {
  const [sortK, setSortK] = useState('created');
  const [dir, setDir] = useState(-1);
  const cols: { k: string; t: string; right?: boolean; cmp: (a: any, b: any) => number }[] = [
    { k: 'number', t: '№', cmp: (a, b) => a.number.localeCompare(b.number, 'ru') },
    { k: 'ip', t: 'ИП', cmp: (a, b) => (a.ip?.name || '').localeCompare(b.ip?.name || '', 'ru') },
    { k: 'object', t: 'Объект', cmp: (a, b) => (a.object?.name || '').localeCompare(b.object?.name || '', 'ru') },
    { k: 'lines', t: 'Позиций', right: true, cmp: (a, b) => (a.lines?.length || 0) - (b.lines?.length || 0) },
    { k: 'sum', t: 'Сумма', right: true, cmp: (a, b) => orderTotal(a) - orderTotal(b) },
    { k: 'created', t: 'Создан', cmp: (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt) },
    { k: 'status', t: 'Статус', cmp: (a, b) => (ORDER_STATUS_RU[a.status] || '').localeCompare(ORDER_STATUS_RU[b.status] || '', 'ru') },
  ];
  const col = cols.find((c) => c.k === sortK) || cols[5];
  const rows = [...list].sort((a, b) => dir * col.cmp(a, b));
  const click = (k: string) => { if (k === sortK) setDir((d) => -d); else { setSortK(k); setDir(1); } };

  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
      <table className="w-full text-sm" style={{ minWidth: 720 }}>
        <thead><tr className="border-b border-stone-200 bg-stone-50 text-left text-xs text-stone-500">
          {cols.map((c) => (
            <th key={c.k} className={`px-3 py-2 font-semibold uppercase tracking-wide ${c.right ? 'text-right' : ''}`}>
              <button onClick={() => click(c.k)} className={`inline-flex items-center gap-0.5 hover:text-stone-900 ${sortK === c.k ? 'text-stone-900' : ''}`}>
                {c.t}{sortK === c.k && (dir === 1 ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />)}
              </button>
            </th>
          ))}
        </tr></thead>
        <tbody>{rows.map((o) => (
          <tr key={o.id} onClick={() => onOpen(o.id)} className="cursor-pointer border-b border-stone-100 transition hover:bg-stone-50">
            <td className="whitespace-nowrap px-3 py-2 font-mono text-xs font-semibold text-stone-900">{o.number}</td>
            <td className="px-3 py-2 text-stone-800"><span className="block truncate" style={{ maxWidth: 220 }}>{o.ip?.name || '—'}</span></td>
            <td className="px-3 py-2 text-xs text-stone-500">
              <span className="inline-flex items-center gap-1">{o.object && <ObjectDot color={o.object.color} />}{o.object?.name || '—'}</span>
            </td>
            <td className="px-3 py-2 text-right font-mono text-xs text-stone-500">{(o.lines || []).length}</td>
            <td className="px-3 py-2 text-right font-mono">{money(orderTotal(o))} ₸</td>
            <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-stone-500">{fmtDate(o.createdAt)}</td>
            <td className="px-3 py-2"><Badge cls={ORDER_STATUS_CLS[o.status]}>{ORDER_STATUS_RU[o.status]}</Badge></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export function OrdersView({ me, orders, onOpen, onNew, onSummary }: {
  me: any; boot: any; orders: any[]; onOpen: (id: string) => void; onNew: () => void; onSummary: (period: string) => void;
}) {
  const canCreate = me.role === 'ADMIN' || me.ordersAccess;
  const pending = orders.filter((o) => o.status === 'APPROVAL' && o.chainSteps?.[o.currentStageIndex]?.approverId === me.id);

  const byPeriod = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const o of orders) { if (!m.has(o.period)) m.set(o.period, []); m.get(o.period)!.push(o); }
    return [...m.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [orders]);

  const exportPeriod = (period: string, list: any[]) => downloadFile(`naryady-${period}.csv`,
    toCSV([
      ['№', 'ИП', 'Объект', 'Статус', 'Позиций', 'Сумма', 'Создан'],
      ...list.map((o) => [o.number, o.ip?.name || '', o.object?.name || '', ORDER_STATUS_RU[o.status] || o.status, (o.lines || []).length, Math.round(orderTotal(o)), fmtDate(o.createdAt)]),
    ]), 'text/csv');

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Наряды</h1>
        {canCreate && <button onClick={onNew} className={btnPrimary}><Plus className="h-4 w-4" /> Новый наряд</button>}
      </div>

      {pending.length > 0 && (
        <div className="mb-5">
          <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-amber-700">
            <Clock className="h-4 w-4" /> Ждут вашего согласования · {pending.length}
          </div>
          <OrdersTable list={pending} onOpen={onOpen} />
        </div>
      )}

      {byPeriod.length === 0 && <Empty text="Нарядов пока нет." />}
      {byPeriod.map(([period, list]) => {
        const periodTotal = list.reduce((s, o) => s + orderTotal(o), 0);
        const byObj = new Map<string, any[]>();
        for (const o of list) { const k = o.objectId || '—'; if (!byObj.has(k)) byObj.set(k, []); byObj.get(k)!.push(o); }
        const objGroups = [...byObj.entries()].sort((a, b) => (a[1][0].object?.name || 'яя').localeCompare(b[1][0].object?.name || 'яя', 'ru'));
        return (
          <div key={period} className="mb-5">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Calendar className="h-4 w-4 text-sky-600" />
              <h2 className="text-sm font-semibold text-stone-800">{periodLabel(period)}</h2>
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">{list.length}</span>
              <span className="ml-auto font-mono text-xs text-stone-500">{money(periodTotal)} ₸</span>
              <button onClick={() => onSummary(period)} title="Свод по ИП за месяц (печать)"
                className="rounded-md border border-stone-200 bg-white p-1 text-stone-400 hover:text-stone-700"><Printer className="h-3.5 w-3.5" /></button>
              <button onClick={() => exportPeriod(period, list)} title="Выгрузить наряды месяца в CSV"
                className="rounded-md border border-stone-200 bg-white p-1 text-stone-400 hover:text-stone-700"><FileDown className="h-3.5 w-3.5" /></button>
            </div>
            {objGroups.map(([key, grp]) => {
              const first = grp[0];
              const label = first.object?.name || 'Без объекта';
              const groupSum = grp.reduce((s, o) => s + orderTotal(o), 0);
              return (
                <div key={key} className="mb-3">
                  <div className="mb-1.5 flex items-center gap-1.5 pl-0.5 text-xs font-semibold text-stone-500">
                    <ObjectDot color={first.object?.color} />
                    {label}<span className="font-normal text-stone-400">· {grp.length}</span>
                    <span className="ml-auto font-mono font-normal text-stone-400">{money(groupSum)} ₸</span>
                  </div>
                  <OrdersTable list={grp} onOpen={onOpen} />
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
