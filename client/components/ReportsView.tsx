'use client';
import { useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import { Card, btnGhost, PageHeader } from './ui';
import { TYPE_RU, money } from '@/lib/format';

const num = (v: any) => Number(String(v ?? '').replace(',', '.')) || 0;

/** Отчёт за месяц: заявки по типам и объектам (с суммами «потрачено»), наряды по ИП. Печать — window.print. */
export function ReportsView({ requests, orders, boot }: { requests: any[]; orders: any[]; boot: any }) {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);

  const { reqRows, objRows, ordRows, totals } = useMemo(() => {
    const inMonth = (d: string) => String(d || '').slice(0, 7) === month;
    const rs = requests.filter((r) => inMonth(r.createdAt));
    const os = orders.filter((o) => inMonth(o.createdAt));

    const byType = new Map<string, { count: number; done: number; spent: number }>();
    for (const r of rs) {
      const t = byType.get(r.type) || { count: 0, done: 0, spent: 0 };
      t.count++; if (r.status === 'DONE' || r.status === 'FULFILLED') t.done++;
      t.spent += num(r.spent);
      byType.set(r.type, t);
    }
    const byObj = new Map<string, { count: number; spent: number }>();
    for (const r of rs) {
      const name = boot.objects.find((o: any) => o.id === r.objectId)?.name || 'Без объекта';
      const t = byObj.get(name) || { count: 0, spent: 0 };
      t.count++; t.spent += num(r.spent);
      byObj.set(name, t);
    }
    const byIp = new Map<string, { count: number; sum: number }>();
    for (const o of os) {
      const name = o.ip?.name || '—';
      const t = byIp.get(name) || { count: 0, sum: 0 };
      t.count++;
      t.sum += (o.lines || []).reduce((s: number, l: any) => s + num(l.price) * num(l.qty), 0);
      byIp.set(name, t);
    }
    return {
      reqRows: [...byType.entries()].sort((a, b) => b[1].count - a[1].count),
      objRows: [...byObj.entries()].sort((a, b) => b[1].spent - a[1].spent),
      ordRows: [...byIp.entries()].sort((a, b) => b[1].sum - a[1].sum),
      totals: {
        req: rs.length, reqDone: rs.filter((r) => r.status === 'DONE').length,
        spent: rs.reduce((s, r) => s + num(r.spent), 0),
        ord: os.length, ordSum: os.reduce((s, o) => s + (o.lines || []).reduce((x: number, l: any) => x + num(l.price) * num(l.qty), 0), 0),
      },
    };
  }, [requests, orders, boot, month]);

  const monthLabel = new Date(month + '-01').toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

  return (
    <div className="mx-auto max-w-3xl">
      <style>{`@media print { body * { visibility: hidden; } #report-print, #report-print * { visibility: visible; } #report-print { position: absolute; left: 0; top: 0; width: 100%; } }`}</style>
      <PageHeader title="Отчёты за месяц" sub="Заявки по типам и объектам, наряды по подрядчикам." accent="amber"
        right={<div className="flex items-center gap-2">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm" />
          <button className={btnGhost} onClick={() => window.print()}><Printer className="h-4 w-4" /> Печать</button>
        </div>} />

      <div id="report-print" className="space-y-4">
        <div className="text-sm text-stone-500">ТОО «Интерстиль» · отчёт за {monthLabel}</div>
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-stone-800">Заявки по типам</h2>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-stone-200 text-left text-xs text-stone-400">
              <th className="p-1.5">Тип</th><th className="p-1.5 text-right">Всего</th><th className="p-1.5 text-right">Закрыто</th><th className="p-1.5 text-right">Потрачено, ₸</th></tr></thead>
            <tbody>
              {reqRows.map(([t, v]) => (
                <tr key={t} className="border-b border-stone-100 last:border-0">
                  <td className="p-1.5">{(TYPE_RU as any)[t] || t}</td>
                  <td className="p-1.5 text-right">{v.count}</td>
                  <td className="p-1.5 text-right">{v.done}</td>
                  <td className="p-1.5 text-right">{v.spent ? money(v.spent) : '—'}</td>
                </tr>
              ))}
              {reqRows.length === 0 && <tr><td colSpan={4} className="p-3 text-center text-stone-400">За месяц заявок нет.</td></tr>}
            </tbody>
            <tfoot><tr className="border-t border-stone-200 font-semibold">
              <td className="p-1.5">Итого</td><td className="p-1.5 text-right">{totals.req}</td>
              <td className="p-1.5 text-right">{totals.reqDone}</td><td className="p-1.5 text-right">{totals.spent ? money(totals.spent) : '—'}</td></tr></tfoot>
          </table>
        </Card>
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-stone-800">Заявки по объектам</h2>
          <table className="w-full text-sm"><tbody>
            {objRows.map(([name, v]) => (
              <tr key={name} className="border-b border-stone-100 last:border-0">
                <td className="p-1.5">{name}</td><td className="p-1.5 text-right">{v.count} шт.</td>
                <td className="p-1.5 text-right">{v.spent ? money(v.spent) + ' ₸' : '—'}</td>
              </tr>
            ))}
            {objRows.length === 0 && <tr><td className="p-3 text-center text-stone-400">Пусто.</td></tr>}
          </tbody></table>
        </Card>
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-stone-800">Наряды по подрядчикам</h2>
          <table className="w-full text-sm"><tbody>
            {ordRows.map(([name, v]) => (
              <tr key={name} className="border-b border-stone-100 last:border-0">
                <td className="p-1.5">{name}</td><td className="p-1.5 text-right">{v.count} шт.</td>
                <td className="p-1.5 text-right">{money(v.sum)} ₸</td>
              </tr>
            ))}
            {ordRows.length === 0 && <tr><td className="p-3 text-center text-stone-400">За месяц нарядов нет.</td></tr>}
          </tbody></table>
          <div className="mt-2 text-right text-sm font-semibold">Итого по нарядам: {money(totals.ordSum)} ₸ ({totals.ord} шт.)</div>
        </Card>
      </div>
    </div>
  );
}
