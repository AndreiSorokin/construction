'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Paperclip, Plus, Save, Send, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { PRIORITY_RU, TYPE_RU } from '@/lib/format';
import { Card, ErrorBox, StageTrack, btnGhost, btnPrimary, inputCls, labelCls, PageHeader } from './ui';

const TYPE_DESC: Record<string, string> = {
  TMC: 'Материалы, инструмент, запчасти', TRANSPORT: 'Техника и перевозки', QUARRY: 'Инертные материалы',
  FUNDS: 'Оплаты и наличные', FUEL: 'Топливо и масла', TRAVEL: 'Командировочные', PRODUCTION: 'Заказ в цех',
};
const HAS_ITEMS = new Set(['TMC', 'PRODUCTION']);
const UNITS = ['шт', 'компл', 'упак', 'пара', 'мешок', 'рулон', 'лист', 'бухта', 'м', 'м²', 'м³', 'кг', 'т', 'л', 'рейс', 'смена', 'час'];
const TYPE_FIELDS: Record<string, { key: string; label: string; type?: string; options?: string[] }[]> = {
  TMC: [],
  TRANSPORT: [
    { key: 'vehicle', label: 'Транспорт / техника' }, { key: 'route', label: 'Маршрут' },
    { key: 'cargo', label: 'Груз' }, { key: 'date', label: 'Дата', type: 'date' },
  ],
  QUARRY: [{ key: 'material', label: 'Материал' }, { key: 'volume', label: 'Объём' }],
  FUNDS: [{ key: 'amount', label: 'Сумма, ₸', type: 'number' }, { key: 'purpose', label: 'Назначение платежа' }],
  FUEL: [
    { key: 'vehicle', label: 'Транспорт / техника' },
    { key: 'fuel', label: 'Топливо', options: ['ДТ', 'АИ-92', 'АИ-95', 'Масло'] },
    { key: 'liters', label: 'Литры', type: 'number' },
  ],
  TRAVEL: [
    { key: 'employee', label: 'Сотрудник' }, { key: 'destination', label: 'Куда' },
    { key: 'dateFrom', label: 'С', type: 'date' }, { key: 'dateTo', label: 'По', type: 'date' },
    { key: 'purpose', label: 'Цель' },
  ],
  PRODUCTION: [],
};

function ItemsEditor({ items, setItems, catalog }: { items: any[]; setItems: (v: any[]) => void; catalog: any[] }) {
  const upd = (i: number, patch: any) => setItems(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const pick = (i: number, name: string) => {
    const c = catalog.find((x) => x.name === name);
    upd(i, { name, ...(c ? { unit: c.unit } : {}) });
  };
  return (
    <div className="space-y-2">
      <datalist id="catalog-names">
        {catalog.map((c) => <option key={c.id} value={c.name} />)}
      </datalist>
      {items.map((it, i) => {
        const unitOptions = it.unit && !UNITS.includes(it.unit) ? [it.unit, ...UNITS] : UNITS;
        return (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-stone-50 p-2">
            <span className="w-5 shrink-0 text-center font-mono text-xs text-stone-400">{i + 1}</span>
            <input className={`${inputCls} flex-1`} placeholder="Наименование" list="catalog-names"
                   value={it.name} onChange={(e) => pick(i, e.target.value)} />
            <input className={`${inputCls} w-20 font-mono`} placeholder="кол-во" inputMode="decimal"
                   value={it.qty} onChange={(e) => upd(i, { qty: e.target.value })} />
            <select className={`${inputCls} w-24`} value={it.unit || 'шт'} onChange={(e) => upd(i, { unit: e.target.value })}>
              {unitOptions.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <button className="rounded-md p-2 text-stone-400 hover:bg-stone-200 hover:text-rose-600"
              onClick={() => setItems(items.length > 1 ? items.filter((_, j) => j !== i) : items)} title="Удалить позицию">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        );
      })}
      <button className="inline-flex items-center gap-1 text-xs font-medium text-stone-600 hover:text-stone-900"
        onClick={() => setItems([...items, { name: '', unit: 'шт', qty: '', note: '' }])}>
        <Plus className="h-3.5 w-3.5" /> Добавить позицию
      </button>
    </div>
  );
}

export function NewRequest({ me, boot, onBack, onCreated, initial, startType, settings }: {
  me: any; boot: any; onBack: () => void; onCreated: (r: any) => void; initial?: any; startType?: string; settings?: any;
}) {
  const [type, setType] = useState(initial?.type || startType || '');
  const [departmentId, setDepartmentId] = useState(me.departmentId || '');
  const [objectId, setObjectId] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [due, setDue] = useState('');
  const [note, setNote] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [items, setItems] = useState<any[]>([{ name: '', unit: 'шт', qty: '', note: '' }]);
  const [files, setFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── черновик: восстановление при выборе типа, автосохранение (0,8 с), очистка при создании ──
  const draftTimer = useRef<any>(null);
  const skipSave = useRef(true);
  useEffect(() => {
    if (!initial) return;
    if (initial.note !== undefined) setNote(initial.note);
    if (initial.objectId !== undefined) setObjectId(initial.objectId);
    if (initial.priority) setPriority(initial.priority);
    if (initial.fields) setFields(initial.fields);
    if (Array.isArray(initial.items) && initial.items.length) setItems(initial.items);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!type) return;
    skipSave.current = true;
    if (initial) { setTimeout(() => { skipSave.current = false; }, 400); return; }
    api.comms.getDraft(type).then((d: any) => {
      const p = d && d.payload;
      if (p) {
        if (p.note !== undefined) setNote(p.note);
        if (p.due !== undefined) setDue(p.due);
        if (p.priority) setPriority(p.priority);
        if (p.objectId !== undefined) setObjectId(p.objectId);
        if (p.departmentId) setDepartmentId(p.departmentId);
        if (Array.isArray(p.items) && p.items.length) setItems(p.items);
        if (p.fields) setFields(p.fields);
      }
      setTimeout(() => { skipSave.current = false; }, 400);
    }).catch(() => { skipSave.current = false; });
  }, [type]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!type || skipSave.current) return;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      api.comms.saveDraft(type, { note, due, priority, objectId, items, fields }).catch(() => undefined);
    }, 800);
    return () => draftTimer.current && clearTimeout(draftTimer.current);
  }, [type, note, due, priority, objectId, items, fields]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const saveAndExit = async () => {
    if (!type) return;
    setErr(''); setBusy(true);
    try {
      await api.comms.saveDraft(type, { note, due, priority, objectId, items, fields });
      onBack();
    } catch (e: any) { setErr(e?.message || 'Не удалось сохранить черновик'); } finally { setBusy(false); }
  };

  const myObjects = useMemo(
    () => boot.objects.filter((o: any) => me.role === 'ADMIN' || o.userIds.includes(me.id)),
    [boot, me],
  );

  const routeDeptId = departmentId || me.departmentId;
  const routeSteps = useMemo(
    () => (boot.supplySteps || [])
      .filter((s: any) => s.departmentId === routeDeptId && s.type === type)
      .sort((a: any, b: any) => a.order - b.order)
      .map((s: any) => ({ ...s, approverName: boot.users.find((u: any) => u.id === s.approverId)?.name || '—', decision: null })),
    [boot, routeDeptId, type],
  );

  const submit = async () => {
    if (!type) return;
    const dept = departmentId || me.departmentId;
    if (!dept) { setErr('У вас не указан отдел — обратитесь к администратору.'); return; }
    const clean = items.filter((i) => i.name.trim());
    if (HAS_ITEMS.has(type) && clean.length === 0) { setErr('Добавьте хотя бы одну позицию.'); return; }
    setErr(''); setBusy(true);
    try {
      let r = await api.requests.create({
        type, departmentId: dept, objectId: objectId || undefined, priority,
        note, due: due ? new Date(due).toISOString() : undefined, fields,
        items: HAS_ITEMS.has(type) ? clean : [],
      });
      if (files.length) {
        for (const f of files) await api.files.upload(r.id, f);
        r = await api.requests.get(r.id); // подтянуть только что прикреплённые вложения
      }
      api.comms.clearDraft(type).catch(() => undefined);
      onCreated(r);
    } catch (e: any) { setErr(e?.message || 'Ошибка'); } finally { setBusy(false); }
  };

  if (!type)
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Новая заявка" sub="Выберите тип — от него зависят поля формы и маршрут согласования." accent="amber" onBack={onBack} />
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(TYPE_RU).map(([k, v]) => (
            <button key={k} onClick={() => setType(k)}
                    className="rounded-xl border border-stone-200 bg-white p-4 text-left shadow-sm transition hover:border-amber-300 hover:shadow">
              <div className="font-semibold">{v}</div>
              <div className="text-sm text-stone-400">{TYPE_DESC[k]}</div>
            </button>
          ))}
        </div>
      </div>
    );

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={TYPE_RU[type]} sub="Заполните поля и отправьте — заявка уйдёт по маршруту согласования." accent="amber" onBack={() => setType('')} />
      {initial && <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">Форма заполнена по образцу прошлой заявки — проверьте данные и срок перед отправкой.</div>}
      <Card>
        <ErrorBox msg={err} />
        <div className="grid gap-3 sm:grid-cols-2">
          {(me.role === 'ADMIN' || !me.departmentId) && (
            <div className="min-w-0">
              <label className={labelCls}>Отдел</label>
              <select className={inputCls} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                <option value="">—</option>
                {boot.departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          )}
          <div className="min-w-0">
            <label className={labelCls}>Объект</label>
            <select className={inputCls} value={objectId} onChange={(e) => setObjectId(e.target.value)}>
              <option value="">—</option>
              {myObjects.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div className="min-w-0">
            <label className={labelCls}>Приоритет</label>
            <select className={inputCls} value={priority} onChange={(e) => setPriority(e.target.value)}>
              {Object.entries(PRIORITY_RU).map(([k, v]) => {
                const lim = settings?.urgentLimit ?? 0;
                const used = settings?.urgentToday ?? 0;
                const exhausted = k === 'URGENT' && lim > 0 && used >= lim;
                const label = k === 'URGENT' && lim > 0 ? `${v} · сегодня ${used} из ${lim}` : v;
                return <option key={k} value={k} disabled={exhausted}>{label}{exhausted ? ' — лимит исчерпан' : ''}</option>;
              })}
            </select>
            {priority === 'URGENT' && settings?.urgentLimit > 0 && (
              <p className="mt-1 text-xs text-stone-400">Лимит «Срочно»: {settings.urgentToday} из {settings.urgentLimit} за сегодня. При исчерпании приоритет автоматически понизится до «Высокий».</p>
            )}
          </div>
          <div className="min-w-0">
            <label className={labelCls}>Срок</label>
            <input type="date" className={`${inputCls} min-w-0`} value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
          {TYPE_FIELDS[type].map((f) => (
            <div key={f.key} className={`min-w-0 ${f.key === 'purpose' || f.key === 'route' ? 'sm:col-span-2' : ''}`}>
              <label className={labelCls}>{f.label}</label>
              {f.options ? (
                <select className={inputCls} value={fields[f.key] || ''} onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })}>
                  <option value="">—</option>
                  {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input type={f.type || 'text'} className={inputCls} value={fields[f.key] || ''}
                       onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })} />
              )}
            </div>
          ))}
        </div>

        {HAS_ITEMS.has(type) && (
          <div className="mt-4">
            <label className={labelCls}>Позиции</label>
            <ItemsEditor items={items} setItems={setItems} catalog={boot.catalogItems} />
          </div>
        )}

        <div className="mt-4">
          <label className={labelCls}>Примечание</label>
          <textarea className={`${inputCls} min-h-20`} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <div className="mt-4">
          <label className={labelCls}>Вложения</label>
          <input ref={fileRef} type="file" accept="image/*,.pdf" multiple className="hidden"
                 onChange={(e) => { const picked = Array.from(e.target.files || []); if (picked.length) setFiles((p) => [...p, ...picked]); if (fileRef.current) fileRef.current.value = ''; }} />
          {files.length > 0 && (
            <ul className="mb-2 space-y-1">
              {files.map((f, i) => (
                <li key={i} className="flex items-center gap-2 rounded-lg bg-stone-50 px-2.5 py-1.5 text-sm">
                  <Paperclip className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                  <span className="truncate">{f.name}</span>
                  <span className="shrink-0 text-xs text-stone-400">{Math.round(f.size / 1024)} КБ</span>
                  <button className="ml-auto text-stone-300 hover:text-rose-600" onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className={btnGhost} onClick={() => fileRef.current?.click()}>
            <Paperclip className="h-4 w-4" /> Прикрепить файл
          </button>
        </div>

        {type && (
          <div className="mt-4">
            <label className={labelCls}>Маршрут согласования</label>
            <Card className="!bg-stone-50">
              {routeSteps.length ? (
                <StageTrack steps={routeSteps} currentIndex={0} status="APPROVAL" />
              ) : (
                <p className="text-sm text-stone-400">
                  Маршрут для этого отдела и типа не настроен — заявка сразу уйдёт в снабжение, минуя согласование.
                </p>
              )}
            </Card>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button onClick={saveAndExit} disabled={busy} className={`${btnGhost} flex-1 justify-center`}>
            <Save className="h-4 w-4" /> Сохранить в черновик
          </button>
          <button onClick={submit} disabled={busy} className={`${btnPrimary} flex-[2] justify-center`}>
            <Send className="h-4 w-4" /> {busy ? 'Отправка…' : 'Подать заявку'}
          </button>
        </div>
      </Card>
    </div>
  );
}
