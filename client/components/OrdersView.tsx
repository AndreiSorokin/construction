'use client';
import { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { Badge, Empty, btnPrimary } from './ui';
import { ORDER_STATUS_CLS, ORDER_STATUS_RU, fmtDate, lineDsu, lineSum, money, periodLabel } from '@/lib/format';

export function OrdersView({ me, boot, orders, onOpen, onNew }: {
  me: any; boot: any; orders: any[]; onOpen: (id: string) => void; onNew: () => void;
}) {
  const canCreate = me.role === 'ADMIN' || me.ordersAccess;
  const byPeriod = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const o of orders) { if (!m.has(o.period)) m.set(o.period, []); m.get(o.period)!.push(o); }
    return [...m.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [orders]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Наряды</h1>
        {canCreate && <button onClick={onNew} className={btnPrimary}><Plus className="h-4 w-4" /> Новый наряд</button>}
      </div>
      {byPeriod.length === 0 && <Empty text="Нарядов пока нет." />}
      {byPeriod.map(([period, list]) => (
        <div key={period} className="mb-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">{periodLabel(period)}</h2>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {list.map((o: any) => {
              const total = (o.lines || []).reduce((s: number, l: any) => s + lineSum(l), 0);
              const dsu = (o.lines || []).reduce((s: number, l: any) => s + lineDsu(l), 0);
              const requester = boot.users.find((u: any) => u.id === o.requesterId);
              return (
                <button key={o.id} onClick={() => onOpen(o.id)}
                        className="block w-full overflow-hidden rounded-lg border border-l-4 border-stone-200 border-l-sky-400 bg-white p-2.5 text-left shadow-sm transition hover:border-stone-300">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-mono text-sm font-semibold">{o.number}</span>
                    <Badge cls={ORDER_STATUS_CLS[o.status]}>{ORDER_STATUS_RU[o.status]}</Badge>
                  </div>
                  <div className="text-sm text-stone-700">{o.ip?.name || 'ИП не указан'}{o.object ? ` · ${o.object.name}` : ''}</div>
                  <div className="mt-1 flex items-center justify-between text-xs text-stone-400">
                    <span>{requester?.name || '—'} · {fmtDate(o.createdAt)}</span>
                    <span className="font-medium text-stone-600">{money(total)} ₸{dsu ? ` · ДСУ ${money(dsu)}` : ''}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
