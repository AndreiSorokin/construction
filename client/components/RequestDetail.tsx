'use client';
import { useRef, useState } from 'react';
import {
  ArrowLeft, Check, CheckCircle2, Circle, CornerUpLeft, Paperclip, Printer, Send, Trash2, X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { appConfirm, appPrompt, HistoryModal, StageTrack } from './ui';
import {
  FIELD_RU, PRIORITY_RU, STAGE_RU, STATUS_CLS, STATUS_RU, TYPE_RU, fmtDate, fmtDateTime,
} from '@/lib/format';
import { Badge, Card, ErrorBox, Section, btnDanger, btnGhost, btnPrimary, inputCls } from './ui';

export function RequestDetail({ me, boot, r, onBack, onUpdated, onPrint, onRepeat, onOpenRequest, onReloadAll }: {
  me: any; boot: any; r: any; onBack: () => void; onUpdated: (r: any) => void; onPrint: () => void;
  onRepeat?: (r: any) => void; onOpenRequest?: (id: string) => void; onReloadAll?: () => void;
}) {
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState('');
  const [noteText, setNoteText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const obj = boot.objects.find((o: any) => o.id === r.objectId);
  const dept = boot.departments.find((d: any) => d.id === r.departmentId);
  const requester = boot.users.find((u: any) => u.id === r.requesterId);
  const assignee = boot.users.find((u: any) => u.id === r.assigneeId);
  const supplyUsers = boot.users.filter((u: any) => u.role === 'SUPPLY' && u.isActive);

  const curStep = r.status === 'APPROVAL' ? r.chainSteps?.find((s: any) => s.order === r.currentStageIndex) : null;
  const myTurn = !!curStep && curStep.approverId === me.id;
  const isSupplyRole = me.role === 'SUPPLY' || me.role === 'ADMIN';
  const isLead = me.role === 'ADMIN' || !!boot.users.find((u: any) => u.id === me.id)?.isLead;
  const canWorkSupply = r.status === 'SUPPLY' && isSupplyRole && (r.assigneeId === me.id || isLead);
  const isRequester = r.requesterId === me.id || me.role === 'ADMIN';

  const act = async (fn: () => Promise<any>) => {
    setErr(''); setBusy(true);
    try { onUpdated(await fn()); } catch (e: any) { setErr(e?.message || 'Ошибка'); } finally { setBusy(false); }
  };

  const upload = async (f: File | undefined) => {
    if (!f) return;
    setErr(''); setBusy(true);
    try { await api.files.upload(r.id, f); onUpdated(await api.requests.get(r.id)); }
    catch (e: any) { setErr(e?.message || 'Ошибка загрузки'); } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const openAtt = async (id: string) => {
    try { await api.files.open(id); }
    catch (e: any) { setErr(e?.message || 'Не удалось открыть'); }
  };

  const fields = Object.entries(r.fields || {}).filter(([, v]) => v !== '' && v != null);
  const [showHist, setShowHist] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [eItems, setEItems] = useState<any[]>([]);
  const [eNote, setENote] = useState('');
  const [eDue, setEDue] = useState('');
  const noDecisions = (r.chainSteps || []).every((st: any) => !st.decision);
  const canEdit = me.role === 'ADMIN' || (!!curStep && curStep.approverId === me.id)
    || (r.requesterId === me.id && r.status === 'APPROVAL' && noDecisions);
  const startEdit = () => {
    setEItems((r.items || []).map((i: any) => ({ id: i.id, name: i.name, unit: i.unit, qty: i.qty || '', note: i.note || '' })));
    setENote(r.note || ''); setEDue(r.due ? String(r.due).slice(0, 10) : ''); setEditMode(true);
  };
  const saveEdit = async () => {
    const items = eItems.filter((i) => i.name.trim());
    await act(() => api.requestsX.edit(r.id, { items, note: eNote, due: eDue || null }));
    setEditMode(false);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print sticky top-0 z-10 -mx-3 mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-white px-3 py-2.5 lg:-mx-6 lg:px-6">
        <button onClick={onBack} className={btnGhost}><ArrowLeft className="h-4 w-4" /> Назад</button>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setShowHist(true)} className={btnGhost}>История · {(r.events || []).length}</button>
          {canEdit && !editMode && <button className={btnGhost} onClick={startEdit}>Изменить</button>}
          {(r.status === 'DONE' || r.status === 'REJECTED') && (r.requesterId === me.id || me.role === 'ADMIN') && onRepeat && !r.isConsolidated && (
            <button className={btnGhost} onClick={() => onRepeat(r)}>Повторить</button>
          )}
          {r.status === 'APPROVAL' && r.requesterId === me.id && noDecisions && (
            <button disabled={busy} className={btnGhost} onClick={async () => {
              if (await appConfirm('Отозвать заявку? Она уйдёт в архив; позже её можно отправить повторно.', { okText: 'Отозвать', danger: true }))
                act(() => api.requestsX.withdraw(r.id));
            }}>Отозвать</button>
          )}
          {r.status === 'REJECTED' && (r.requesterId === me.id || me.role === 'ADMIN') && !r.isConsolidated && (
            <button disabled={busy} className={btnGhost} onClick={() => act(() => api.requestsX.resubmit(r.id))}>Отправить повторно</button>
          )}
          {r.isConsolidated && isSupplyRole && r.status === 'SUPPLY' && (
            <button disabled={busy} className={btnGhost} onClick={async () => {
              const n = (r.attachments || []).length;
              if (await appConfirm('Разъединить сводную? Исходные заявки вернутся в работу.' + (n ? ` Файлы сводной (${n}) будут перенесены в первую исходную — не потеряются.` : ''), { okText: 'Разъединить', danger: true }))
                { await api.requestsX.unconsolidate(r.id); onReloadAll?.(); onBack(); }
            }}>Разъединить</button>
          )}
          <button onClick={onPrint} className={btnGhost}><Printer className="h-4 w-4" /> Печать</button>
        </div>
      </div>
      <ErrorBox msg={err} />
      {r.consolidatedInto && (
        <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Заявка входит в сводную <b>{r.consolidatedInto.number}</b> — закупается вместе с другими.{' '}
          {onOpenRequest && <button className="underline" onClick={() => onOpenRequest(r.consolidatedInto.id)}>Открыть сводную</button>}
        </div>
      )}
      {r.wasConsolidated && (
        <div className="mb-3 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Закуплена в составе сводной <b>{r.wasConsolidated}</b>.
        </div>
      )}
      {editMode && (
        <Section title="Правка заявки">
          <Card>
            <datalist id="catalog-names-edit">
              {boot.catalogItems.map((c: any) => <option key={c.id} value={c.name} />)}
            </datalist>
            {eItems.map((it, i) => (
              <div key={it.id || i} className="mb-2 flex flex-wrap items-center gap-2">
                <input className={`${inputCls} min-w-40 flex-1`} placeholder="Наименование" list="catalog-names-edit" value={it.name}
                  onChange={(e) => {
                    const c = boot.catalogItems.find((x: any) => x.name === e.target.value);
                    setEItems(eItems.map((x, j) => (j === i ? { ...x, name: e.target.value, ...(c ? { unit: c.unit } : {}) } : x)));
                  }} />
                <input className={`${inputCls} w-20`} placeholder="Ед." value={it.unit}
                  onChange={(e) => setEItems(eItems.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))} />
                <input className={`${inputCls} w-24`} placeholder="Кол-во" value={it.qty}
                  onChange={(e) => setEItems(eItems.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} />
                <button className="text-stone-300 hover:text-rose-600" onClick={() => setEItems(eItems.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            <button className={btnGhost} onClick={() => setEItems([...eItems, { name: '', unit: 'шт', qty: '', note: '' }])}>+ Позиция</button>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="text-sm text-stone-500">Примечание
                <input className={`${inputCls} mt-1`} value={eNote} onChange={(e) => setENote(e.target.value)} />
              </label>
              <label className="text-sm text-stone-500">Срок
                <input type="date" className={`${inputCls} mt-1`} value={eDue} onChange={(e) => setEDue(e.target.value)} />
              </label>
            </div>
            <div className="mt-3 flex gap-2">
              <button className={btnPrimary} disabled={busy} onClick={saveEdit}>Сохранить изменения</button>
              <button className={btnGhost} onClick={() => setEditMode(false)}>Отмена</button>
            </div>
            <p className="mt-2 text-xs text-stone-400">«Получено N» у позиций сохраняется — правка её не затирает.</p>
          </Card>
        </Section>
      )}

      <Card className="mb-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg font-bold">{r.number}</span>
            <Badge cls={STATUS_CLS[r.status]}>{STATUS_RU[r.status]}</Badge>
            {r.postponed && <Badge>Отложена</Badge>}
          </div>
          <span className="text-sm text-stone-400">{fmtDateTime(r.createdAt)}</span>
        </div>
        <div className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <div><span className="text-stone-400">Тип: </span>{TYPE_RU[r.type]}</div>
          <div><span className="text-stone-400">Отдел: </span>{dept?.name || '—'}</div>
          <div><span className="text-stone-400">Заявитель: </span>{requester?.name || '—'}</div>
          <div><span className="text-stone-400">Объект: </span>{obj?.name || '—'}</div>
          <div><span className="text-stone-400">Приоритет: </span>{PRIORITY_RU[r.priority]}</div>
          <div><span className="text-stone-400">Срок: </span>{fmtDate(r.due)}</div>
          {fields.map(([k, v]) => (
            <div key={k}><span className="text-stone-400">{FIELD_RU[k] || k}: </span>{String(v)}</div>
          ))}
        </div>
        {r.isConsolidated && (r.consolidatedFrom || []).length > 0 ? (
          <p className="mt-2 rounded-lg bg-stone-50 p-2 text-sm">
            <span className="text-stone-400">Сводная из: </span>
            {r.consolidatedFrom.map((src: any, i: number) => (
              <span key={src.id}>
                {i > 0 && ', '}
                <a href={`?request=${src.id}`} target="_blank" rel="noopener noreferrer"
                   className="font-mono font-medium text-stone-900 underline decoration-stone-300 hover:decoration-stone-900">
                  {src.number}
                </a>
              </span>
            ))}
          </p>
        ) : r.note && <p className="mt-2 rounded-lg bg-stone-50 p-2 text-sm">{r.note}</p>}
      </Card>

      {r.items?.length > 0 && (
        <Section title={`Позиции · ${r.items.length}`}>
          <Card className="!p-0 overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 560 }}>
              <thead>
                <tr className="border-b border-stone-200 text-left text-xs text-stone-400">
                  <th className="p-2 pl-3">Наименование</th>
                  <th className="p-2">Кол-во</th>
                  <th className="p-2">Наличие</th>
                  {(r.status === 'SUPPLY' || r.status === 'FULFILLED') && <th className="p-2">Получено</th>}
                  {r.status === 'SUPPLY' && <th className="p-2">Срок пост.</th>}
                  <th className="p-2 pr-3 text-center">Вып.</th>
                </tr>
              </thead>
              <tbody>
                {r.items.map((it: any) => (
                  <tr key={it.id} className="border-b border-stone-100 last:border-0">
                    <td className={`p-2 pl-3 ${it.fulfilled ? 'text-stone-400 line-through' : ''}`}>
                      {it.name}
                      {it.note && <span className="text-stone-400"> · {it.note}</span>}
                    </td>
                    <td className="whitespace-nowrap p-2">{it.qty} {it.unit}</td>
                    <td className="p-2">
                      {myTurn && me.role === 'WAREHOUSE' ? (
                        <div className="flex gap-1">
                          <button disabled={busy} onClick={() => act(() => api.requests.stock(r.id, it.id, 'IN'))}
                            className={`rounded px-1.5 py-0.5 text-xs ${it.stockStatus === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>Есть</button>
                          <button disabled={busy} onClick={() => act(() => api.requests.stock(r.id, it.id, 'OUT'))}
                            className={`rounded px-1.5 py-0.5 text-xs ${it.stockStatus === 'OUT' ? 'bg-rose-100 text-rose-700' : 'bg-stone-100 text-stone-500'}`}>Нет</button>
                        </div>
                      ) : it.stockStatus ? (
                        <span className={it.stockStatus === 'IN' ? 'text-emerald-600' : 'text-rose-600'}>
                          {it.stockStatus === 'IN' ? 'есть' : 'нет'}
                          <span className="text-stone-400"> · {it.stockByName}</span>
                        </span>
                      ) : <span className="text-stone-300">—</span>}
                    </td>
                    {(r.status === 'SUPPLY' || r.status === 'FULFILLED') && (
                      <td className="whitespace-nowrap p-2">
                        {canWorkSupply ? (
                          <input className={`${inputCls} !w-20 !px-2 !py-1 text-xs`} defaultValue={it.deliveredQty || ''} disabled={busy}
                            placeholder="0" title="Сколько фактически получено"
                            onBlur={(e) => { if (e.target.value !== (it.deliveredQty || '')) act(() => api.requestsX.item(r.id, it.id, { deliveredQty: e.target.value })); }} />
                        ) : (it.deliveredQty ? <span>{it.deliveredQty}</span> : <span className="text-stone-300">—</span>)}
                      </td>
                    )}
                    {r.status === 'SUPPLY' && (
                      <td className="whitespace-nowrap p-2">
                        {canWorkSupply ? (
                          <input type="date" className={`${inputCls} !w-36 !px-2 !py-1 text-xs`} defaultValue={it.eta ? String(it.eta).slice(0, 10) : ''} disabled={busy}
                            title="Ожидаемый срок поставки"
                            onBlur={(e) => { const v = e.target.value || null; const cur = it.eta ? String(it.eta).slice(0, 10) : ''; if ((v || '') !== cur) act(() => api.requestsX.item(r.id, it.id, { eta: v })); }} />
                        ) : (it.eta ? <span>{String(it.eta).slice(0, 10)}</span> : <span className="text-stone-300">—</span>)}
                      </td>
                    )}
                    <td className="p-2 pr-3">
                      {canWorkSupply ? (
                        <button disabled={busy} title={it.fulfilled ? 'Снять отметку' : 'Отметить выполненной'}
                          onClick={() => act(() => api.requests.fulfilled(r.id, it.id, !it.fulfilled))} className="mx-auto flex">
                          {it.fulfilled ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Circle className="h-5 w-5 text-stone-300" />}
                        </button>
                      ) : (
                        <div className="mx-auto flex w-fit">
                          {it.fulfilled ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Circle className="h-5 w-5 text-stone-300" />}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </Section>
      )}

      <Section title="Маршрут согласования">
        <Card>
          {r.chainSteps?.length ? (
            <>
              <StageTrack steps={r.chainSteps} currentIndex={r.currentStageIndex} status={r.status} />
              {r.chainSteps.some((s: any) => s.comment) && (
                <ul className="mt-3 space-y-1 border-t border-stone-100 pt-3 text-xs text-stone-500">
                  {r.chainSteps.filter((s: any) => s.comment).map((s: any) => (
                    <li key={s.id}><span className="font-medium text-stone-700">{s.approverName}</span> · «{s.comment}»
                      {s.decidedAt && <span className="text-stone-400"> · {fmtDateTime(s.decidedAt)}</span>}</li>
                  ))}
                </ul>
              )}
            </>
          ) : <p className="text-sm text-stone-400">Маршрут пуст — заявка ушла в снабжение сразу.</p>}

          {myTurn && (
            <div className="mt-3 border-t border-stone-100 pt-3">
              <input className={inputCls} placeholder="Комментарий (необязательно)" value={comment}
                     onChange={(e) => setComment(e.target.value)} />
              <div className="mt-2 flex gap-2">
                <button disabled={busy} onClick={() => act(() => api.requests.decide(r.id, 'approve', comment || undefined))}
                        className={btnPrimary}><Check className="h-4 w-4" /> Согласовать</button>
                <button disabled={busy} onClick={() => act(() => api.requests.decide(r.id, 'reject', comment || undefined))}
                        className={btnDanger}><X className="h-4 w-4" /> Отклонить</button>
              </div>
            </div>
          )}
        </Card>
      </Section>

      {r.status === 'SUPPLY' && isSupplyRole && (
        <Section title="Снабжение">
          <Card>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-stone-400">Исполнитель:</span>
              {isLead ? (
                <select className={`${inputCls} w-52`} value={r.assigneeId || ''} disabled={busy}
                        onChange={(e) => e.target.value && act(() => api.requests.assign(r.id, e.target.value))}>
                  <option value="">— назначить —</option>
                  {supplyUsers.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              ) : (
                <span className="font-medium">{assignee?.name || 'не назначен'}</span>
              )}
              {!r.assigneeId && me.role === 'SUPPLY' && (
                <button disabled={busy} onClick={() => act(() => api.requests.claim(r.id))} className={btnGhost}>Взять в работу</button>
              )}
            </div>
            {canWorkSupply && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {(['INWORK', 'ORDERED', 'ARRIVED'] as const).map((st) => (
                  <button key={st} disabled={busy || r.supplyStage === st}
                          onClick={() => act(() => api.requests.setStage(r.id, st))}
                          className={`rounded-lg border px-3 py-1.5 text-sm ${r.supplyStage === st ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 bg-white hover:bg-stone-50'}`}>
                    {STAGE_RU[st]}
                  </button>
                ))}
                <button disabled={busy} onClick={() => act(() => api.requests.postpone(r.id, !r.postponed))} className={btnGhost}>
                  {r.postponed ? 'Вернуть в работу' : 'Отложить'}
                </button>
                <label className="flex items-center gap-1 text-sm text-stone-500">Приоритет:
                  <select className={inputCls} value={r.priority} disabled={busy}
                          onChange={(e) => act(() => api.requestsX.priority(r.id, e.target.value))}>
                    {Object.entries(PRIORITY_RU).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-1 text-sm text-stone-500">Срок:
                  <input type="date" className={inputCls} value={r.due ? String(r.due).slice(0, 10) : ''} disabled={busy}
                    onChange={(e) => act(() => api.requestsX.due(r.id, e.target.value || null))} />
                </label>
                {r.assigneeId === me.id && (
                  <button disabled={busy} className={btnGhost} onClick={() => act(() => api.requestsX.release(r.id))}>Снять с себя</button>
                )}
                <button disabled={busy} className={btnGhost} onClick={async () => {
                  const v = await appPrompt('Потрачено, ₸ (пусто — очистить):', { initial: r.spent != null ? String(r.spent) : '' });
                  if (v === null) return;
                  act(() => api.requestsX.spent(r.id, v.trim() === '' ? null : Number(String(v).replace(',', '.')) || 0));
                }}>Потрачено{r.spent != null ? ': ' + r.spent : ''}</button>
                <button disabled={busy} onClick={() => act(() => api.requests.fulfill(r.id))} className={btnPrimary}>
                  <CheckCircle2 className="h-4 w-4" /> Выполнено
                </button>
              </div>
            )}
          </Card>
        </Section>
      )}

      {r.status === 'FULFILLED' && isRequester && (
        <Section title="Подтверждение">
          <Card className="flex flex-wrap gap-2">
            <button disabled={busy} onClick={() => act(() => api.requests.confirm(r.id))} className={btnPrimary}>
              <CheckCircle2 className="h-4 w-4" /> Получено, закрыть заявку
            </button>
            <button disabled={busy} onClick={() => act(() => api.requests.return(r.id))} className={btnGhost}>
              <CornerUpLeft className="h-4 w-4" /> Вернуть в снабжение
            </button>
          </Card>
        </Section>
      )}

      <Section title={`Вложения · ${r.attachments?.length || 0}`}
               right={<button className={btnGhost} disabled={busy} onClick={() => fileRef.current?.click()}>
                        <Paperclip className="h-4 w-4" /> Прикрепить</button>}>
        <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden"
               onChange={(e) => upload(e.target.files?.[0])} />
        <Card>
          {r.attachments?.length ? (
            <ul className="space-y-1.5 text-sm">
              {r.attachments.map((a: any) => (
                <li key={a.id} className="flex items-center gap-2">
                  <button onClick={() => openAtt(a.id)} className="truncate text-sky-700 hover:underline">{a.filename}</button>
                  <span className="text-xs text-stone-400">{Math.round(a.size / 1024)} КБ · {a.byName}</span>
                  {(a.byId === me.id || me.role === 'ADMIN') && (
                    <button disabled={busy} className="ml-auto text-stone-300 hover:text-rose-600"
                            onClick={() => act(async () => { await api.files.remove(a.id); return api.requests.get(r.id); })}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-stone-400">Нет вложений.</p>}
        </Card>
      </Section>

      <Section title="Заметки снабжения">
        <Card>
          {r.supplyNotes?.length ? (
            <ul className="mb-2 space-y-1.5 text-sm">
              {r.supplyNotes.map((n: any) => (
                <li key={n.id}><span className="text-stone-400">{n.byName} · {fmtDateTime(n.at)}:</span> {n.text}</li>
              ))}
            </ul>
          ) : <p className="mb-2 text-sm text-stone-400">Заметок нет.</p>}
          {isSupplyRole && (
            <div className="flex gap-2">
              <input className={inputCls} placeholder="Новая заметка…" value={noteText}
                     onChange={(e) => setNoteText(e.target.value)}
                     onKeyDown={(e) => e.key === 'Enter' && noteText.trim() && act(async () => { const res = await api.requests.supplyNote(r.id, noteText.trim()); setNoteText(''); return res; })} />
              <button disabled={busy || !noteText.trim()} className={btnPrimary}
                      onClick={() => act(async () => { const res = await api.requests.supplyNote(r.id, noteText.trim()); setNoteText(''); return res; })}>
                <Send className="h-4 w-4" />
              </button>
            </div>
          )}
        </Card>
      </Section>

      {r.isConsolidated && (r.consolidatedFrom || []).length > 0 && (
        <Section title={`Из исходных заявок · ${r.consolidatedFrom.length}`}>
          <Card>
            {r.consolidatedFrom.map((src: any) => (
              <div key={src.id} className="mb-3 border-b border-stone-100 pb-3 last:mb-0 last:border-0 last:pb-0">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-mono font-semibold">{src.number}</span>
                  {onOpenRequest && <button className="text-xs text-stone-500 underline" onClick={() => onOpenRequest(src.id)}>открыть</button>}
                </div>
                {src.note && <p className="mt-1 text-sm text-stone-600">{src.note}</p>}
                {(src.supplyNotes || []).map((n: any) => (
                  <p key={n.id} className="mt-1 text-xs text-stone-500">💬 {n.byName}: {n.text}</p>
                ))}
                {(src.attachments || []).length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {src.attachments.map((a: any) => (
                      <button key={a.id} className="rounded-lg border border-stone-200 px-2 py-1 text-xs text-stone-700 hover:bg-stone-50"
                        onClick={() => api.files.open(a.id)}>
                        📎 {a.filename}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </Card>
        </Section>
      )}

      {showHist && <HistoryModal title={'История ' + r.number} items={r.events || []} onClose={() => setShowHist(false)} />}
    </div>
  );
}
