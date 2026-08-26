'use client';
import { useMemo, useState } from 'react';
import { AlertTriangle, Plus, Search, Send, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { lineSum, money, periodLabel, qtyNum } from '@/lib/format';
import { Card, ErrorBox, btnGhost, btnPrimary, inputCls, labelCls, PageHeader } from './ui';

function monthsRange(back: number, fwd: number): string[] {
  const now = new Date();
  const out: string[] = [];
  for (let d = -back; d <= fwd; d++) {
    const dt = new Date(now.getFullYear(), now.getMonth() + d, 1);
    out.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`);
  }
  return out.sort().reverse();
}
const curPeriod = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`; };

export function NewOrder({ me, boot, onBack, onCreated }: {
  me: any; boot: any; onBack: () => void; onCreated: (o: any) => void;
}) {
  const months = useMemo(() => monthsRange(18, 18), []);
  const stroyDept = boot.departments.find((d: any) => /строит/i.test(d.name)) || boot.departments[0] || null;
  const chainSteps = [...(boot.orderSteps || [])]
    .filter((s: any) => s.departmentId === stroyDept?.id)
    .sort((a: any, b: any) => a.order - b.order);
  const stroyCat = boot.workCatalogs.find((c: any) => c.kind === 'STROY') || boot.workCatalogs[0] || null;

  const [period, setPeriod] = useState(curPeriod());
  const [ipName, setIpName] = useState('');
  const [objectId, setObjectId] = useState('');
  const [catalogId, setCatalogId] = useState(stroyCat?.id || '');
  const [note, setNote] = useState('');
  const [q, setQ] = useState('');
  const [qty, setQty] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const catalog = boot.workCatalogs.find((c: any) => c.id === catalogId);
  const myObjects = boot.objects.filter((o: any) => me.role === 'ADMIN' || o.userIds.includes(me.id));
  const ipMatch = boot.ips.find((x: any) => x.name.trim().toLowerCase() === ipName.trim().toLowerCase());

  const items = useMemo(() => {
    const list = catalog?.items || [];
    const s = q.trim().toLowerCase();
    return s ? list.filter((i: any) => i.name.toLowerCase().includes(s)) : list;
  }, [catalog, q]);

  const selected = (catalog?.items || []).filter((i: any) => qtyNum(qty[i.id] || '') > 0);
  const total = selected.reduce((s: number, i: any) => s + lineSum({ price: i.price, qty: qty[i.id] }), 0);

  const removeLine = (id: string) => setQty((prev) => { const n = { ...prev }; delete n[id]; return n; });

  const submit = async () => {
    if (!stroyDept) { setErr('Не настроен строительный отдел.'); return; }
    if (!ipName.trim()) { setErr('Укажите ИП — выберите из списка или введите новое.'); return; }
    if (selected.length === 0) { setErr('Добавьте хотя бы одну работу с количеством.'); return; }
    setErr(''); setBusy(true);
    try {
      let ipId = ipMatch?.id || '';
      if (!ipId) {
        if (me.role !== 'ADMIN') {
          setErr('Такого ИП нет в справочнике. Выберите из подсказки или попросите администратора добавить новый ИП.');
          setBusy(false); return;
        }
        const created = await api.ips.create({ name: ipName.trim() });
        ipId = created.id;
      }
      const o = await api.orders.create({
        departmentId: stroyDept.id, period, ipId, objectId: objectId || undefined, catalogId, note,
        lines: selected.map((i: any) => ({
          workId: i.id, name: i.name, unit: i.unit, price: Number(i.price), qty: qty[i.id],
        })),
      });
      onCreated(o);
    } catch (e: any) { setErr(e?.message || 'Ошибка'); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Новый наряд" sub="Строительный наряд — работы из расценок, сумма считается автоматически." accent="sky" onBack={onBack} />

      <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>Работаем только с ИП на <span className="font-semibold">общеустановленном режиме</span> (плательщики НДС). На ИП по упрощёнке закрыть наряд нельзя.</div>
      </div>

      <Card className="mb-4">
        <ErrorBox msg={err} />
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className={labelCls}>За какой месяц</label>
            <select className={inputCls} value={period} onChange={(e) => setPeriod(e.target.value)}>
              {months.map((m) => <option key={m} value={m}>{periodLabel(m)}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>На какое ИП закрыть</label>
            <input list="ip-suggest" className={inputCls} value={ipName} onChange={(e) => setIpName(e.target.value)} placeholder="Начните вводить или выберите" />
            <datalist id="ip-suggest">{boot.ips.map((x: any) => <option key={x.id} value={x.name} />)}</datalist>
            <p className="mt-1 text-xs text-stone-400">
              {ipMatch && ipMatch.vat === false
                ? <span className="text-rose-600">Это ИП на упрощёнке — наряд на него закрыть нельзя.</span>
                : me.role === 'ADMIN' ? 'Новое ИП сохранится и появится в подсказках в следующий раз.' : 'Новое ИП в справочник может добавить только администратор.'}
            </p>
          </div>
          <div>
            <label className={labelCls}>Объект</label>
            <select className={inputCls} value={objectId} onChange={(e) => setObjectId(e.target.value)}>
              <option value="">— не указан —</option>
              {myObjects.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
        </div>
        {boot.workCatalogs.length > 1 && (
          <div className="mt-3 max-w-xs">
            <label className={labelCls}>Справочник работ</label>
            <select className={inputCls} value={catalogId} onChange={(e) => setCatalogId(e.target.value)}>
              {boot.workCatalogs.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        {chainSteps.length > 0 && (
          <p className="mt-3 text-xs text-stone-400">Маршрут: {chainSteps.map((s: any) => s.label).join(' → ')} → утверждён</p>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col !p-3">
          <div className="mb-2 flex items-center gap-1.5 rounded-lg border border-stone-300 px-2.5 py-1.5">
            <Search className="h-4 w-4 text-stone-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск работы…" className="w-full bg-transparent text-sm focus:outline-none" />
          </div>
          <div className="max-h-96 space-y-1 overflow-y-auto pr-1">
            {items.length === 0 ? (
              <p className="py-6 text-center text-sm text-stone-400">{catalog ? 'Ничего не найдено.' : 'Список работ не настроен.'}</p>
            ) : items.slice(0, 300).map((w: any) => {
              const on = qtyNum(qty[w.id] || '') > 0;
              return (
                <div key={w.id} className={`flex items-center gap-2 rounded-lg border p-2 transition ${on ? 'border-sky-300 bg-sky-50' : 'border-stone-200 bg-white'}`}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-stone-800">{w.name}</span>
                    <span className="text-xs text-stone-400">{money(Number(w.price))} ₸ / {w.unit}{on ? <span className="ml-1 font-medium text-sky-600">· в наряде</span> : ''}</span>
                  </span>
                  {on ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-sky-50 px-2.5 py-1.5 text-xs font-medium text-sky-700">В наряде</span>
                  ) : (
                    <button onClick={() => setQty({ ...qty, [w.id]: '1' })}
                      className="inline-flex shrink-0 items-center gap-1 rounded-md bg-stone-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-stone-700">
                      <Plus className="h-3.5 w-3.5" /> Добавить
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="flex flex-col !p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-stone-700">В наряде</span>
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">{selected.length} поз.</span>
          </div>
          {selected.length === 0 ? (
            <p className="flex-1 py-6 text-center text-sm text-stone-400">Добавляйте работы слева — выбранные подсветятся.</p>
          ) : (
            <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
              {selected.map((i: any) => (
                <div key={i.id} className="rounded-lg bg-stone-50 p-2">
                  <div className="flex items-start gap-2">
                    <span className="min-w-0 flex-1 text-sm leading-snug text-stone-800">{i.name}</span>
                    <button onClick={() => removeLine(i.id)} className="shrink-0 rounded p-1 text-stone-400 hover:bg-stone-200 hover:text-rose-600" title="Убрать позицию"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <input type="number" min="0" value={qty[i.id] || ''} onChange={(e) => setQty({ ...qty, [i.id]: e.target.value })}
                      className="w-20 shrink-0 rounded-md border border-stone-300 bg-white px-1 py-1 text-center text-sm" title="Количество" />
                    <span className="min-w-0 flex-1 truncate text-xs text-stone-400">{i.unit} × {money(Number(i.price))} ₸</span>
                    <span className="shrink-0 font-mono text-sm font-semibold text-stone-800">{money(lineSum({ price: i.price, qty: qty[i.id] }))} ₸</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 flex items-center justify-between border-t border-stone-200 pt-2">
            <span className="text-sm font-medium text-stone-600">Итого</span>
            <span className="font-mono text-lg font-bold text-stone-900">{money(total)} ₸</span>
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <label className={labelCls}>Примечание</label>
        <textarea className={`${inputCls} min-h-16`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Участок, объём, сроки…" />
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <button onClick={onBack} className={`${btnGhost} w-full sm:w-auto`}>Отмена</button>
          <button onClick={submit} disabled={busy} className={`${btnPrimary} w-full sm:w-auto`}>
            <Send className="h-4 w-4" /> {busy ? 'Отправка…' : 'Подать наряд'}
          </button>
        </div>
      </Card>
    </div>
  );
}
