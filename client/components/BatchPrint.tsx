'use client';
import { ArrowLeft, Printer } from 'lucide-react';
import { btnGhost, btnPrimary, PageHeader } from './ui';
import { TYPE_RU, PRIORITY_RU, STATUS_RU, fmtDate } from '@/lib/format';

/** Пакетная печать: выбранные заявки одним документом, каждая с новой страницы. */
export function BatchPrint({ requests, boot, onBack }: { requests: any[]; boot: any; onBack: () => void }) {
  return (
    <div className="mx-auto max-w-3xl">
      <style>{`@media print { body * { visibility: hidden; } #batch-print, #batch-print * { visibility: visible; } #batch-print { position: absolute; left: 0; top: 0; width: 100%; } .page-break { page-break-after: always; } }`}</style>
      <div className="print:hidden">
        <PageHeader title="Пакетная печать" sub={`Выбрано заявок: ${requests.length}. Каждая печатается с новой страницы.`} accent="stone" onBack={onBack}
          right={<button onClick={() => window.print()} className={btnPrimary}><Printer className="h-4 w-4" /> Печать · {requests.length}</button>} />
      </div>
      <div id="batch-print" className="space-y-6">
        {requests.map((r) => {
          const obj = boot.objects.find((o: any) => o.id === r.objectId);
          const requester = boot.users.find((u: any) => u.id === r.requesterId);
          return (
            <div key={r.id} className="page-break rounded-xl border border-stone-300 p-4">
              <div className="mb-2 flex items-baseline justify-between">
                <div className="text-lg font-bold">{r.number} · {(TYPE_RU as any)[r.type] || r.type}</div>
                <div className="text-sm text-stone-500">{fmtDate(r.createdAt)}</div>
              </div>
              <div className="mb-2 grid gap-x-6 gap-y-0.5 text-sm sm:grid-cols-2">
                <div>Заявитель: {requester?.name || '—'}</div>
                <div>Объект: {obj?.name || '—'}</div>
                <div>Приоритет: {(PRIORITY_RU as any)[r.priority] || r.priority}</div>
                <div>Статус: {(STATUS_RU as any)[r.status] || r.status}{r.due ? ` · срок ${fmtDate(r.due)}` : ''}</div>
              </div>
              {(r.items || []).length > 0 && (
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-stone-300 text-left text-xs text-stone-500">
                    <th className="p-1">№</th><th className="p-1">Наименование</th><th className="p-1">Ед.</th><th className="p-1 text-right">Кол-во</th><th className="p-1 text-right">Получено</th></tr></thead>
                  <tbody>{r.items.map((it: any, i: number) => (
                    <tr key={it.id} className="border-b border-stone-100 last:border-0">
                      <td className="p-1 text-stone-400">{i + 1}</td><td className="p-1">{it.name}</td>
                      <td className="p-1">{it.unit}</td><td className="p-1 text-right">{it.qty}</td>
                      <td className="p-1 text-right">{it.deliveredQty || '—'}</td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
              {r.note && <p className="mt-2 text-sm text-stone-600">Примечание: {r.note}</p>}
              <div className="mt-4 grid grid-cols-2 gap-6 text-xs text-stone-500">
                <div>Выдал: ____________________</div>
                <div>Получил: ____________________</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
