'use client';
import { useState } from 'react';
import { ArrowLeft, Check, Printer, X } from 'lucide-react';
import { api } from '@/lib/api';
import { ORDER_STATUS_CLS, ORDER_STATUS_RU, fmtDateTime, lineSum, money, periodLabel } from '@/lib/format';
import { Badge, Card, ErrorBox, Section, StageTrack, btnDanger, btnGhost, btnPrimary, inputCls, appConfirm, appPrompt, HistoryModal } from './ui';
import { useRef } from 'react';

export function OrderDetail({ me, boot, o, onBack, onUpdated, onPrint }: {
  me: any; boot: any; o: any; onBack: () => void; onUpdated: (o: any) => void; onPrint: () => void;
}) {
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState('');

  const requester = boot.users.find((u: any) => u.id === o.requesterId);
  const curStep = o.status === 'APPROVAL' ? o.chainSteps?.find((s: any) => s.order_ === o.currentStageIndex) : null;
  const myTurn = !!curStep && curStep.approverId === me.id;
  const meFull = boot.users.find((u: any) => u.id === me.id) || me;
  const noDecisions = (o.chainSteps || []).every((s: any) => !s.decision);
  const canEditLines = me.role === 'ADMIN' || myTurn || (o.status === 'REJECTED' && o.requesterId === me.id)
    || (o.requesterId === me.id && o.status === 'APPROVAL' && noDecisions);
  const canPrice = me.role === 'ADMIN' || !!meFull.canPrice;
  const [showHist, setShowHist] = useState(false);
  const [editLines, setEditLines] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const total = (o.lines || []).reduce((s: number, l: any) => s + lineSum(l), 0);

  const act = async (fn: () => Promise<any>) => {
    setErr(''); setBusy(true);
    try { onUpdated(await fn()); } catch (e: any) { setErr(e?.message || 'Ошибка'); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print sticky top-0 z-10 -mx-3 mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-white px-3 py-2.5 lg:-mx-6 lg:px-6">
        <button onClick={onBack} className={btnGhost}><ArrowLeft className="h-4 w-4" /> Назад</button>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setShowHist(true)} className={btnGhost}>История · {(o.events || []).length}</button>
          {o.status === 'REJECTED' && (o.requesterId === me.id || me.role === 'ADMIN') && (
            <button disabled={busy} className={btnGhost} onClick={() => act(() => api.ordersX.resubmit(o.id))}>Отправить повторно</button>
          )}
          <button onClick={onPrint} className={btnGhost}><Printer className="h-4 w-4" /> Печать</button>
        </div>
      </div>
      <ErrorBox msg={err} />

      <Card className="mb-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg font-bold">{o.number}</span>
            <Badge cls={ORDER_STATUS_CLS[o.status]}>{ORDER_STATUS_RU[o.status]}</Badge>
          </div>
          <span className="text-sm text-stone-400">{fmtDateTime(o.createdAt)}</span>
        </div>
        <div className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <div><span className="text-stone-400">Период: </span>{periodLabel(o.period)}</div>
          <div><span className="text-stone-400">Заявитель: </span>{requester?.name || '—'}</div>
          <div><span className="text-stone-400">ИП: </span>{o.ip?.name || '—'}{o.ip?.vat ? ' (НДС)' : ''}</div>
          <div><span className="text-stone-400">Объект: </span>{o.object?.name || '—'}</div>
        </div>
        {o.note && <p className="mt-2 rounded-lg bg-stone-50 p-2 text-sm">{o.note}</p>}
      </Card>

      <Section title={`Работы · ${o.lines?.length || 0}`}
        right={canEditLines && (o.lines?.length || 0) > 0 && (
          <button className={editLines ? `${btnGhost} !border-stone-900 !text-stone-900` : btnGhost} onClick={() => setEditLines((v) => !v)}>
            {editLines ? 'Готово' : 'Редактировать'}
          </button>
        )}>
        <Card className="!p-0 overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 560 }}>
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs text-stone-400">
                <th className="p-2 pl-3">Наименование</th>
                <th className="p-2 text-right">Цена</th>
                <th className="p-2 text-right">Кол-во</th>
                <th className="p-2 pr-3 text-right">Сумма</th>
                {canEditLines && editLines && <th className="p-2 pr-3" />}
              </tr>
            </thead>
            <tbody>
              {o.lines?.map((l: any) => (
                <tr key={l.id} className="border-b border-stone-100 last:border-0">
                  <td className="p-2 pl-3">{l.name}</td>
                  <td className="whitespace-nowrap p-2 text-right">{money(Number(l.price))} / {l.unit}</td>
                  <td className="p-2 text-right">{l.qty}</td>
                  <td className="whitespace-nowrap p-2 pr-3 text-right font-medium">{money(lineSum(l))}</td>
                  {canEditLines && editLines && (
                    <td className="whitespace-nowrap p-2 pr-3 text-right text-xs">
                      <button className="text-stone-500 underline" disabled={busy} onClick={async () => {
                        const q = await appPrompt(`Кол-во для «${l.name}»:`, { initial: String(l.qty || '') });
                        if (q === null) return;
                        act(() => api.ordersX.line(o.id, l.id, { qty: q }));
                      }}>кол-во</button>
                      {canPrice && <button className="ml-2 text-stone-500 underline" disabled={busy} onClick={async () => {
                        const p = await appPrompt(`Цена для «${l.name}», ₸:`, { initial: String(l.price ?? '') });
                        if (p === null) return;
                        act(() => api.ordersX.line(o.id, l.id, { price: Number(String(p).replace(',', '.')) || 0 }));
                      }}>цена</button>}
                      <button className="ml-2 text-rose-600 underline" disabled={busy} onClick={async () => {
                        if (await appConfirm(`Удалить позицию «${l.name}» из наряда?`, { okText: 'Удалить', danger: true }))
                          act(() => api.ordersX.removeLine(o.id, l.id));
                      }}>✕</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-stone-200 font-semibold">
                <td className="p-2 pl-3" colSpan={3}>Итого</td>
                <td className="p-2 pr-3 text-right">{money(total)} ₸</td>
              </tr>
            </tfoot>
          </table>
        </Card>
      </Section>

      <Section title="Маршрут согласования">
        <Card>
          {o.chainSteps?.length ? (
            <>
              <StageTrack steps={o.chainSteps} currentIndex={o.currentStageIndex} status={o.status} />
              {o.chainSteps.some((s: any) => s.comment) && (
                <ul className="mt-3 space-y-1 border-t border-stone-100 pt-3 text-xs text-stone-500">
                  {o.chainSteps.filter((s: any) => s.comment).map((s: any) => (
                    <li key={s.id}><span className="font-medium text-stone-700">{s.approverName}</span> · «{s.comment}»
                      {s.decidedAt && <span className="text-stone-400"> · {fmtDateTime(s.decidedAt)}</span>}</li>
                  ))}
                </ul>
              )}
            </>
          ) : <p className="text-sm text-stone-400">Маршрут пуст — наряд утверждён сразу.</p>}

          {myTurn && (
            <div className="mt-3 border-t border-stone-100 pt-3">
              <input className={inputCls} placeholder="Комментарий (необязательно)" value={comment}
                     onChange={(e) => setComment(e.target.value)} />
              <div className="mt-2 flex gap-2">
                <button disabled={busy} onClick={() => act(() => api.orders.decide(o.id, 'approve', comment || undefined))} className={btnPrimary}>
                  <Check className="h-4 w-4" /> Согласовать
                </button>
                <button disabled={busy} onClick={() => act(() => api.orders.decide(o.id, 'reject', comment || undefined))} className={btnDanger}>
                  <X className="h-4 w-4" /> Отклонить
                </button>
              </div>
            </div>
          )}
        </Card>
      </Section>

      <Section title={`Файлы и фото · ${(o.attachments || []).length}`}>
        <Card>
          <div className="flex flex-wrap gap-2">
            {(o.attachments || []).map((a: any) => (
              <button key={a.id} className="rounded-lg border border-stone-200 px-2 py-1 text-xs text-stone-700 hover:bg-stone-50"
                onClick={() => api.files.open(a.id)}>
                {a.filename}{a.fromConsolidated ? ` · из ${a.fromConsolidated}` : ''}
              </button>
            ))}
            <button className={btnGhost} disabled={busy} onClick={() => fileRef.current?.click()}>+ Файл</button>
            <input ref={fileRef} type="file" className="hidden" onChange={async (e) => {
              const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
              setBusy(true); setErr('');
              try { await api.ordersX.upload(o.id, f); onUpdated(await api.orders.get(o.id)); }
              catch (er: any) { setErr(er?.message || 'Ошибка загрузки'); } finally { setBusy(false); }
            }} />
          </div>
        </Card>
      </Section>

      {showHist && <HistoryModal title={'История ' + o.number} items={o.events || []} onClose={() => setShowHist(false)} />}
    </div>
  );
}
