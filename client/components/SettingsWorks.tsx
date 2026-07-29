'use client';
import { useMemo, useState } from 'react';
import { Download, Plus, Trash2, Upload } from 'lucide-react';
import { api } from '@/lib/api';
import { money } from '@/lib/format';
import { Card, ErrorBox, btnGhost, btnPrimary, inputCls, appConfirm } from './ui';

function parseImport(text: string): { name: string; unit: string; price: number; dsu: number | null }[] {
  const t = text.trim();
  if (!t) return [];
  if (t.startsWith('[')) {
    const arr = JSON.parse(t);
    return arr.map((x: any) => ({
      name: String(x.name || x[0] || '').trim(),
      unit: String(x.unit || x[1] || 'шт').trim(),
      price: Number(x.price ?? x[2] ?? 0),
      dsu: x.dsu === null || x.dsu === undefined || x.dsu === '' ? (x[3] ?? null) : Number(x.dsu),
    })).filter((x: any) => x.name);
  }
  // CSV: name;unit;price;dsu
  return t.split(/\r?\n/).map((line) => {
    const [name, unit, price, dsu] = line.split(/[;\t]/).map((s) => (s || '').trim());
    return { name, unit: unit || 'шт', price: Number((price || '0').replace(',', '.')), dsu: dsu ? Number(dsu) : null };
  }).filter((x) => x.name);
}

export function SettingsWorks({ boot, reload }: { boot: any; reload: () => void }) {
  const [err, setErr] = useState('');
  const [catId, setCatId] = useState(boot.workCatalogs[0]?.id || '');
  const [q, setQ] = useState('');
  const [nw, setNw] = useState({ name: '', unit: '', price: '', dsu: '' });
  const [imp, setImp] = useState('');
  const [impOpen, setImpOpen] = useState(false);

  const cat = boot.workCatalogs.find((c: any) => c.id === catId);
  const items = useMemo(() => {
    const list = cat?.items || [];
    const s = q.trim().toLowerCase();
    return s ? list.filter((i: any) => i.name.toLowerCase().includes(s)) : list;
  }, [cat, q]);

  const act = async (fn: () => Promise<any>) => {
    setErr('');
    try { await fn(); await reload(); } catch (e: any) { setErr(e?.message || 'Ошибка'); }
  };

  const exportJson = () => {
    const data = (cat?.items || []).map((i: any) => ({ name: i.name, unit: i.unit, price: Number(i.price), dsu: i.dsu }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${cat?.name || 'works'}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const doImport = async (mode: 'replace' | 'append') => {
    try {
      const rows = parseImport(imp);
      if (!rows.length) { setErr('Не удалось разобрать данные. Формат: JSON-массив или CSV «наименование;ед;цена;дсу».'); return; }
      if (mode === 'replace' && !(await appConfirm(`Заменить весь список (${cat?.items?.length || 0} поз.) на ${rows.length} новых?`, { okText: 'Заменить', danger: true }))) return;
      act(async () => { await api.workCatalogs.import(catId, mode, rows); setImp(''); setImpOpen(false); });
    } catch { setErr('Ошибка разбора JSON.'); }
  };

  return (
    <div>
      <ErrorBox msg={err} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {boot.workCatalogs.map((c: any) => (
          <button key={c.id} onClick={() => setCatId(c.id)}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${catId === c.id ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 bg-white'}`}>
            {c.name} · {c.items.length}
          </button>
        ))}
        <span className="flex-1" />
        <button className={btnGhost} onClick={exportJson}><Download className="h-4 w-4" /> Экспорт</button>
        <button className={btnGhost} onClick={() => setImpOpen(!impOpen)}><Upload className="h-4 w-4" /> Импорт</button>
      </div>

      {impOpen && (
        <Card className="mb-3">
          <p className="mb-2 text-xs text-stone-500">JSON-массив [{'{'}name, unit, price, dsu{'}'}] или CSV построчно: наименование;ед;цена;дсу</p>
          <textarea className={`${inputCls} min-h-28 font-mono text-xs`} value={imp} onChange={(e) => setImp(e.target.value)} />
          <div className="mt-2 flex gap-2">
            <button className={btnPrimary} onClick={() => doImport('append')}>Добавить к списку</button>
            <button className={btnGhost} onClick={() => doImport('replace')}>Заменить список</button>
          </div>
        </Card>
      )}

      <Card className="mb-3">
        <div className="flex flex-wrap gap-2">
          <input className={`${inputCls} flex-1`} placeholder="Новая работа — наименование" value={nw.name} onChange={(e) => setNw({ ...nw, name: e.target.value })} />
          <input className={`${inputCls} w-24`} placeholder="ед." value={nw.unit} onChange={(e) => setNw({ ...nw, unit: e.target.value })} />
          <input className={`${inputCls} w-28`} placeholder="цена" value={nw.price} onChange={(e) => setNw({ ...nw, price: e.target.value })} />
          <input className={`${inputCls} w-20`} placeholder="ДСУ %" value={nw.dsu} onChange={(e) => setNw({ ...nw, dsu: e.target.value })} />
          <button className={btnPrimary}
                  onClick={() => nw.name.trim() && act(async () => {
                    await api.workCatalogs.addItem(catId, { name: nw.name.trim(), unit: nw.unit || 'шт', price: Number(nw.price.replace(',', '.')) || 0, dsu: nw.dsu ? Number(nw.dsu) : null });
                    setNw({ name: '', unit: '', price: '', dsu: '' });
                  })}>
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </Card>

      <input className={`${inputCls} mb-2 w-72`} placeholder="Поиск…" value={q} onChange={(e) => setQ(e.target.value)} />
      <Card className="!p-0">
        <div className="max-h-[28rem] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-stone-200 text-left text-xs text-stone-400">
                <th className="p-2 pl-3">Наименование</th><th className="p-2">Ед.</th>
                <th className="p-2 text-right">Цена</th><th className="p-2 text-right">ДСУ %</th><th className="p-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((i: any) => (
                <tr key={i.id} className="border-b border-stone-100 last:border-0">
                  <td className="p-2 pl-3">
                    <input className="w-full bg-transparent outline-none" defaultValue={i.name}
                           onBlur={(e) => e.target.value !== i.name && act(() => api.workCatalogs.updateItem(catId, i.id, { name: e.target.value }))} />
                  </td>
                  <td className="p-2">
                    <input className="w-16 bg-transparent outline-none" defaultValue={i.unit}
                           onBlur={(e) => e.target.value !== i.unit && act(() => api.workCatalogs.updateItem(catId, i.id, { unit: e.target.value }))} />
                  </td>
                  <td className="p-2 text-right">
                    <input className="w-24 bg-transparent text-right outline-none" defaultValue={money(Number(i.price))}
                           onBlur={(e) => {
                             const v = Number(e.target.value.replace(/\s/g, '').replace(',', '.'));
                             if (!isNaN(v) && v !== Number(i.price)) act(() => api.workCatalogs.updateItem(catId, i.id, { price: v }));
                           }} />
                  </td>
                  <td className="p-2 text-right">
                    <input className="w-14 bg-transparent text-right outline-none" defaultValue={i.dsu ?? ''}
                           onBlur={(e) => {
                             const v = e.target.value.trim() === '' ? null : Number(e.target.value);
                             if (v !== i.dsu) act(() => api.workCatalogs.updateItem(catId, i.id, { dsu: v }));
                           }} />
                  </td>
                  <td className="p-2 pr-3 text-right">
                    <button className="text-stone-300 hover:text-rose-600" onClick={() => act(() => api.workCatalogs.removeItem(catId, i.id))}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
