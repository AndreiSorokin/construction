'use client';
import { useState } from 'react';
import { Search } from 'lucide-react';
import { HIST_LABELS } from './ui';
import { fmtDateTime } from '@/lib/format';
import { reqTitle } from '@/lib/requestHelpers';

const card = 'rounded-2xl border border-stone-200 bg-white shadow-sm';

/** Общий журнал действий по заявкам и нарядам — только для админа. Порт ActionLog из эталона. */
export function ActionLog({ requests, orders, boot, onOpenReq, onOpenOrder }: {
  requests: any[]; orders: any[]; boot: any; onOpenReq: (id: string) => void; onOpenOrder: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const evs: { kind: 'req' | 'order'; id: string; number: string; title: string; e: any }[] = [];
  requests.forEach((r) => (r.events || []).forEach((e: any) => evs.push({ kind: 'req', id: r.id, number: r.number, title: reqTitle(r, boot), e })));
  orders.forEach((o) => (o.events || []).forEach((e: any) => evs.push({ kind: 'order', id: o.id, number: o.number, title: o.ip?.name || '', e })));

  let list = [...evs].sort((a, b) => +new Date(b.e.at) - +new Date(a.e.at));
  if (q.trim()) {
    const x = q.trim().toLowerCase();
    list = list.filter((x2) =>
      x2.number.toLowerCase().includes(x) ||
      (x2.e.byName || '').toLowerCase().includes(x) ||
      (HIST_LABELS[x2.e.action] || x2.e.action || '').toLowerCase().includes(x));
  }
  list = list.slice(0, 300);

  return (
    <div>
      <div className="mb-3 flex items-center gap-1.5 rounded-lg border border-stone-300 px-2.5 py-1.5">
        <Search className="h-4 w-4 shrink-0 text-stone-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по номеру, человеку, действию"
          className="w-full min-w-0 bg-transparent text-sm focus:outline-none" />
      </div>
      <div className={`divide-y divide-stone-100 ${card}`}>
        {list.length === 0 ? <div className="py-10 text-center text-sm text-stone-400">Записей нет.</div> : list.map((x, i) => (
          <button key={i} onClick={() => (x.kind === 'req' ? onOpenReq(x.id) : onOpenOrder(x.id))}
            className="flex w-full flex-wrap items-center gap-x-2 gap-y-0.5 px-3 py-2 text-left text-sm transition hover:bg-stone-50">
            <span className="w-32 shrink-0 font-mono text-xs text-stone-400">{fmtDateTime(x.e.at)}</span>
            <span className="shrink-0 font-mono text-xs font-semibold text-stone-900">{x.number}</span>
            <span className="min-w-0 flex-1 truncate text-stone-700">
              <span className="font-medium">{x.e.byName || '—'}</span> {HIST_LABELS[x.e.action] || x.e.action}
              {x.e.comment ? <span className="text-stone-400"> · {x.e.comment}</span> : null}
            </span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-stone-400">Показываются последние 300 записей по заявкам и нарядам.</p>
    </div>
  );
}
