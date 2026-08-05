'use client';
import { useState } from 'react';
import { Plus, Trash2, Truck } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, ErrorBox, btnPrimary, inputCls, appConfirm } from './ui';

/** «Техника»: справочник — подставляется в заявках «Транспорт»/«Топливо» — как в эталоне (AdminVehicles). */
export function SettingsVehicles({ boot, reload }: { boot: any; reload: () => void }) {
  const [err, setErr] = useState('');
  const [name, setName] = useState('');
  const vehicles = boot.vehicles || [];

  const act = async (fn: () => Promise<any>) => {
    setErr('');
    try { await fn(); await reload(); } catch (e: any) { setErr(e?.message || 'Ошибка'); }
  };

  return (
    <div>
      <ErrorBox msg={err} />
      <p className="mb-4 text-sm leading-relaxed text-stone-500">Подставляется в заявках «Транспорт» и «Топливо».</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {vehicles.map((v: any) => (
          <Card key={v.id} className="!p-2.5 flex items-center gap-2">
            <Truck className="h-4 w-4 shrink-0 text-stone-400" />
            <input className={`${inputCls} flex-1`} defaultValue={v.name}
                   onBlur={(e) => e.target.value !== v.name && act(() => api.vehicles.update(v.id, e.target.value))} />
            <button className="shrink-0 rounded-md p-2 text-stone-400 hover:bg-stone-100 hover:text-rose-600"
              onClick={async () => (await appConfirm('Удалить технику «' + (v.name || '—') + '» из справочника?', { okText: 'Удалить', danger: true })) && act(() => api.vehicles.remove(v.id))}>
              <Trash2 className="h-4 w-4" />
            </button>
          </Card>
        ))}
        {vehicles.length === 0 && <p className="text-sm text-stone-400 sm:col-span-2">Список пуст — добавьте технику.</p>}
      </div>
      <div className="mt-3 flex gap-2">
        <input className={inputCls} placeholder="Новая техника" value={name} onChange={(e) => setName(e.target.value)} />
        <button className={btnPrimary} onClick={() => name.trim() && act(async () => { await api.vehicles.create(name.trim()); setName(''); })}>
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
