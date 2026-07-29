'use client';
import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Minus, Plus, Search, Send } from 'lucide-react';
import { api } from '@/lib/api';
import { lineSum, money, periodLabel, qtyNum } from '@/lib/format';
import { Card, ErrorBox, btnGhost, btnPrimary, inputCls, labelCls, PageHeader } from './ui';

function periods(): string[] {
  const now = new Date();
  return [-1, 0, 1].map((d) => {
    const dt = new Date(now.getFullYear(), now.getMonth() + d, 1);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
  });
}

export function NewOrder({ me, boot, onBack, onCreated }: {
  me: any; boot: any; onBack: () => void; onCreated: (o: any) => void;
}) {
  const opts = periods();
  const [period, setPeriod] = useState(opts[1]);
  const [ipId, setIpId] = useState('');
  const [objectId, setObjectId] = useState('');
  const [catalogId, setCatalogId] = useState(boot.workCatalogs[0]?.id || '');
  const [note, setNote] = useState('');
  const [q, setQ] = useState('');
  const [qty, setQty] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const ip = boot.ips.find((x: any) => x.id === ipId);
  const catalog = boot.workCatalogs.find((c: any) => c.id === catalogId);
  const items = useMemo(() => {
    const list = catalog?.items || [];
    const s = q.trim().toLowerCase();
    return s ? list.filter((i: any) => i.name.toLowerCase().includes(s)) : list;
  }, [catalog, q]);

  const myObjects = boot.objects.filter((o: any) => me.role === 'ADMIN' || o.userIds.includes(me.id));
  const selected = (catalog?.items || []).filter((i: any) => qtyNum(qty[i.id] || '') > 0);
  const total = selected.reduce((s: number, i: any) => s + lineSum({ price: i.price, qty: qty[i.id] }), 0);

  const bump = (id: string, d: number) => {
    const cur = qtyNum(qty[id] || '');
    const next = Math.max(0, cur + d);
    setQty({ ...qty, [id]: next ? String(next) : '' });
  };

  const submit = async () => {
    if (!ipId) { setErr('Выберите ИП.'); return; }
    if (selected.length === 0) { setErr('Укажите количество хотя бы по одной работе.'); return; }
    setErr(''); setBusy(true);
    try {
      const o = await api.orders.create({
        period, ipId, objectId: objectId || undefined, catalogId, note,
        lines: selected.map((i: any) => ({
          workId: i.id, name: i.name, unit: i.unit, price: Number(i.price), dsu: i.dsu, qty: qty[i.id],
        })),
      });
      onCreated(o);
    } catch (e: any) { setErr(e?.message || 'Ошибка'); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Новый наряд" sub="Работы, подрядчик и период. После создания наряд уходит на согласование." accent="sky" onBack={onBack} />
      <Card className="mb-4">
        <ErrorBox msg={err} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Месяц</label>
            <select className={inputCls} value={period} onChange={(e) => setPeriod(e.target.value)}>
              {opts.map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Объект</label>
            <select className={inputCls} value={objectId} onChange={(e) => setObjectId(e.target.value)}>
              <option value="">—</option>
              {myObjects.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>ИП (исполнитель)</label>
            <select className={inputCls} value={ipId} onChange={(e) => setIpId(e.target.value)}>
              <option value="">— выберите —</option>
              {boot.ips.map((i: any) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Справочник работ</label>
            <select className={inputCls} value={catalogId} onChange={(e) => setCatalogId(e.target.value)}>
              {boot.workCatalogs.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        {ip?.vat && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Этот ИП — на общеустановленном режиме (плательщик НДС). Проверьте корректность оформления наряда.</span>
          </div>
        )}
      </Card>

      <Card className="mb-4 !p-0">
        <div className="border-b border-stone-100 p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-stone-400" />
            <input className={`${inputCls} pl-8`} placeholder={`Поиск по «${catalog?.name || ''}»…`} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.map((i: any) => {
            const val = qty[i.id] || '';
            const active = qtyNum(val) > 0;
            return (
              <div key={i.id} className={`flex items-center gap-2 border-b border-stone-50 px-3 py-2 text-sm ${active ? 'bg-amber-50' : ''}`}>
                <div className="min-w-0 flex-1">
                  <div className="truncate">{i.name}</div>
                  <div className="text-xs text-stone-400">{money(Number(i.price))} ₸ / {i.unit}{i.dsu ? ` · ДСУ ${i.dsu}%` : ''}</div>
                </div>
                <button className="rounded border border-stone-300 p-1" onClick={() => bump(i.id, -1)}><Minus className="h-3.5 w-3.5" /></button>
                <input className="w-16 rounded-lg border border-stone-300 px-2 py-1 text-center text-sm"
                       value={val} onChange={(e) => setQty({ ...qty, [i.id]: e.target.value })} placeholder="0" />
                <button className="rounded border border-stone-300 p-1" onClick={() => bump(i.id, 1)}><Plus className="h-3.5 w-3.5" /></button>
              </div>
            );
          })}
          {items.length === 0 && <p className="p-4 text-center text-sm text-stone-400">Ничего не найдено.</p>}
        </div>
      </Card>

      <Card>
        <label className={labelCls}>Примечание</label>
        <textarea className={`${inputCls} min-h-16`} value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="mt-3 flex items-center justify-between">
          <div className="text-sm">
            Выбрано работ: <b>{selected.length}</b> · Итого: <b>{money(total)} ₸</b>
          </div>
          <button onClick={submit} disabled={busy} className={btnPrimary}>
            <Send className="h-4 w-4" /> {busy ? 'Отправка…' : 'Подать наряд'}
          </button>
        </div>
      </Card>
    </div>
  );
}
