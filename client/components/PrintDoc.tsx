'use client';
import { Printer, X } from 'lucide-react';
import {
  FIELD_RU, PRIORITY_RU, TYPE_RU, fmtDate, fmtDateTime, lineDsu, lineSum, money, periodLabel,
} from '@/lib/format';
import { btnGhost, btnPrimary } from './ui';

function Head({ title, number, date }: { title: string; number: string; date: string }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4 border-b-2 border-black pb-2">
      <div>
        <div className="text-xs">ТОО «Интерстиль» · г. Актобе</div>
        <div className="mt-1 text-lg font-bold">{title} {number}</div>
        <div className="text-xs">от {fmtDateTime(date)}</div>
      </div>
    </div>
  );
}

function ChainBlock({ steps }: { steps: any[] }) {
  if (!steps?.length) return null;
  return (
    <table className="mt-4 w-full border-collapse text-xs">
      <thead>
        <tr>{['Этап', 'Согласующий', 'Решение', 'Дата', 'Подпись'].map((h) => (
          <th key={h} className="border border-black p-1 text-left">{h}</th>))}
        </tr>
      </thead>
      <tbody>
        {steps.map((s: any) => (
          <tr key={s.id}>
            <td className="border border-black p-1">{s.label}</td>
            <td className="border border-black p-1">{s.approverName}</td>
            <td className="border border-black p-1">{s.decision === 'APPROVED' ? 'Согласовано' : s.decision === 'REJECTED' ? 'Отклонено' : '—'}</td>
            <td className="border border-black p-1">{s.decidedAt ? fmtDateTime(s.decidedAt) : '—'}</td>
            <td className="border border-black p-1 w-24"></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function PrintDoc({ doc, boot, onClose }: { doc: { kind: 'request' | 'order'; data: any }; boot: any; onClose: () => void }) {
  const d = doc.data;
  return (
    <div className="min-h-screen bg-white p-6 text-black">
      <div className="no-print mb-4 flex justify-end gap-2">
        <button className={btnPrimary} onClick={() => window.print()}><Printer className="h-4 w-4" /> Печать</button>
        <button className={btnGhost} onClick={onClose}><X className="h-4 w-4" /> Закрыть</button>
      </div>
      <div className="mx-auto max-w-2xl">
        {doc.kind === 'request' ? (
          <>
            <Head title={`Заявка (${TYPE_RU[d.type]})`} number={d.number} date={d.createdAt} />
            <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-sm">
              <div>Отдел: {boot.departments.find((x: any) => x.id === d.departmentId)?.name || '—'}</div>
              <div>Объект: {boot.objects.find((x: any) => x.id === d.objectId)?.name || '—'}</div>
              <div>Заявитель: {boot.users.find((x: any) => x.id === d.requesterId)?.name || '—'}</div>
              <div>Приоритет: {PRIORITY_RU[d.priority]} · Срок: {fmtDate(d.due)}</div>
              {Object.entries(d.fields || {}).filter(([, v]) => v).map(([k, v]) => (
                <div key={k}>{FIELD_RU[k] || k}: {String(v)}</div>
              ))}
            </div>
            {d.items?.length > 0 && (
              <table className="mt-3 w-full border-collapse text-sm">
                <thead>
                  <tr>{['№', 'Наименование', 'Ед.', 'Кол-во', 'Наличие'].map((h) => (
                    <th key={h} className="border border-black p-1 text-left">{h}</th>))}
                  </tr>
                </thead>
                <tbody>
                  {d.items.map((it: any, i: number) => (
                    <tr key={it.id}>
                      <td className="border border-black p-1">{i + 1}</td>
                      <td className="border border-black p-1">{it.name}{it.note ? ` (${it.note})` : ''}</td>
                      <td className="border border-black p-1">{it.unit}</td>
                      <td className="border border-black p-1">{it.qty}</td>
                      <td className="border border-black p-1">{it.stockStatus === 'IN' ? 'есть' : it.stockStatus === 'OUT' ? 'нет' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {d.note && <p className="mt-2 text-sm">Примечание: {d.note}</p>}
            <ChainBlock steps={d.chainSteps} />
          </>
        ) : (
          <>
            <Head title="Наряд" number={d.number} date={d.createdAt} />
            <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-sm">
              <div>Период: {periodLabel(d.period)}</div>
              <div>Объект: {d.object?.name || '—'}</div>
              <div>Исполнитель: {d.ip?.name || '—'}{d.ip?.bin ? ` · БИН ${d.ip.bin}` : ''}{d.ip?.vat ? ' · плательщик НДС' : ''}</div>
              <div>Составил: {boot.users.find((x: any) => x.id === d.requesterId)?.name || '—'}</div>
            </div>
            <table className="mt-3 w-full border-collapse text-sm">
              <thead>
                <tr>{['№', 'Наименование работ', 'Ед.', 'Цена', 'Кол-во', 'Сумма', 'ДСУ'].map((h) => (
                  <th key={h} className="border border-black p-1 text-left">{h}</th>))}
                </tr>
              </thead>
              <tbody>
                {d.lines?.map((l: any, i: number) => (
                  <tr key={l.id}>
                    <td className="border border-black p-1">{i + 1}</td>
                    <td className="border border-black p-1">{l.name}</td>
                    <td className="border border-black p-1">{l.unit}</td>
                    <td className="border border-black p-1 text-right">{money(Number(l.price))}</td>
                    <td className="border border-black p-1 text-right">{l.qty}</td>
                    <td className="border border-black p-1 text-right">{money(lineSum(l))}</td>
                    <td className="border border-black p-1 text-right">{l.dsu ? `${money(lineDsu(l))} (${l.dsu}%)` : '—'}</td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td className="border border-black p-1" colSpan={5}>Итого</td>
                  <td className="border border-black p-1 text-right">
                    {money((d.lines || []).reduce((s: number, l: any) => s + lineSum(l), 0))}
                  </td>
                  <td className="border border-black p-1 text-right">
                    {money((d.lines || []).reduce((s: number, l: any) => s + lineDsu(l), 0))}
                  </td>
                </tr>
              </tbody>
            </table>
            {d.note && <p className="mt-2 text-sm">Примечание: {d.note}</p>}
            <ChainBlock steps={d.chainSteps} />
          </>
        )}
        <div className="mt-8 grid grid-cols-2 gap-8 text-sm">
          <div>Сдал: ____________________</div>
          <div>Принял: ____________________</div>
        </div>
      </div>
    </div>
  );
}
