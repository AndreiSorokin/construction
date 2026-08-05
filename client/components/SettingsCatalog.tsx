'use client';
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, ErrorBox, btnPrimary, inputCls } from './ui';

/** «Номенклатура»: единый список названий и единиц — подсказки при заполнении позиций заявок.
 *  В текущей версии эталона отдельной вкладкой не выведена, но справочник используется
 *  в форме заявки (ItemsEditor) — оставляем управляемым, чтобы не разрывать эту связь. */
export function SettingsCatalog({ boot, reload }: { boot: any; reload: () => void }) {
  const [err, setErr] = useState('');
  const [nw, setNw] = useState({ name: '', unit: 'шт', category: '' });

  const act = async (fn: () => Promise<any>) => {
    setErr('');
    try { await fn(); await reload(); } catch (e: any) { setErr(e?.message || 'Ошибка'); }
  };

  return (
    <div>
      <ErrorBox msg={err} />
      <p className="mb-4 text-sm leading-relaxed text-stone-500">Единый список названий и единиц. Из него заявители выбирают позиции — без разнобоя в наименованиях.</p>
      <Card className="!p-0">
        <div className="max-h-[28rem] overflow-y-auto p-3">
          {boot.catalogItems.map((c: any) => (
            <div key={c.id} className="mb-1 flex items-center gap-2">
              <input className={`${inputCls} flex-1`} defaultValue={c.name}
                     onBlur={(e) => e.target.value !== c.name && act(() => api.catalogItems.update(c.id, { name: e.target.value }))} />
              <input className={`${inputCls} w-24`} defaultValue={c.unit}
                     onBlur={(e) => e.target.value !== c.unit && act(() => api.catalogItems.update(c.id, { unit: e.target.value }))} />
              <input className={`${inputCls} w-36`} defaultValue={c.category || ''} placeholder="категория"
                     onBlur={(e) => e.target.value !== (c.category || '') && act(() => api.catalogItems.update(c.id, { category: e.target.value }))} />
              <button className="text-stone-300 hover:text-rose-600" onClick={() => act(() => api.catalogItems.remove(c.id))}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {boot.catalogItems.length === 0 && <p className="py-6 text-center text-sm text-stone-400">Справочник пуст.</p>}
        </div>
      </Card>
      <div className="mt-3 flex flex-wrap gap-2">
        <input className={`${inputCls} flex-1`} placeholder="Наименование" value={nw.name} onChange={(e) => setNw({ ...nw, name: e.target.value })} />
        <input className={`${inputCls} w-24`} placeholder="ед." value={nw.unit} onChange={(e) => setNw({ ...nw, unit: e.target.value })} />
        <input className={`${inputCls} w-36`} placeholder="категория" value={nw.category} onChange={(e) => setNw({ ...nw, category: e.target.value })} />
        <button className={btnPrimary} onClick={() => nw.name.trim() && act(async () => { await api.catalogItems.create(nw); setNw({ name: '', unit: 'шт', category: '' }); })}>
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
