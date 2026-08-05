'use client';
import { useState } from 'react';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, ErrorBox, btnPrimary, inputCls, appConfirm } from './ui';

/** «ИП»: подрядчики, на которых закрываются наряды — как в эталоне (IpAdmin). */
export function SettingsIps({ boot, reload }: { boot: any; reload: () => void }) {
  const [err, setErr] = useState('');
  const [nw, setNw] = useState({ name: '', bin: '', vat: true });

  const act = async (fn: () => Promise<any>) => {
    setErr('');
    try { await fn(); await reload(); } catch (e: any) { setErr(e?.message || 'Ошибка'); }
  };

  return (
    <div>
      <ErrorBox msg={err} />
      <p className="mb-3 text-sm leading-relaxed text-stone-500">На эти ИП закрываются наряды. В наряде можно выбрать только ИП на общеустановленном режиме (с НДС).</p>
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>Снимите галочку «Плательщик НДС», если ИП на упрощёнке — тогда он не появится в выборе при создании наряда.</div>
      </div>
      <div className="space-y-2.5">
        {boot.ips.map((x: any) => (
          <Card key={x.id} className="!p-3">
            <div className="flex flex-wrap items-center gap-2">
              <input className={`${inputCls} min-w-0 flex-1`} defaultValue={x.name} placeholder="Наименование ИП"
                     onBlur={(e) => e.target.value !== x.name && act(() => api.ips.update(x.id, { name: e.target.value }))} />
              <input className={`${inputCls} w-44 font-mono`} defaultValue={x.bin || ''} placeholder="ИИН/БИН"
                     onBlur={(e) => e.target.value !== (x.bin || '') && act(() => api.ips.update(x.id, { bin: e.target.value }))} />
              <button className="shrink-0 rounded-md p-2 text-stone-400 hover:bg-stone-100 hover:text-rose-600"
                onClick={async () => (await appConfirm('Удалить ИП «' + x.name + '»? Уже созданные наряды сохранят его название.', { okText: 'Удалить', danger: true })) && act(() => api.ips.remove(x.id))}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <label className="mt-2 flex flex-wrap items-center gap-2 text-sm text-stone-600">
              <input type="checkbox" checked={!!x.vat} onChange={(e) => act(() => api.ips.update(x.id, { vat: e.target.checked }))} className="accent-stone-900" />
              Плательщик НДС · общеустановленный режим
              {x.vat
                ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">доступен для нарядов</span>
                : <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">скрыт в нарядах</span>}
            </label>
          </Card>
        ))}
        {boot.ips.length === 0 && <p className="rounded-lg border border-dashed border-stone-300 bg-white py-8 text-center text-sm text-stone-400">ИП не добавлены.</p>}
      </div>
      <div className="mt-3 flex gap-2">
        <input className={inputCls} placeholder="ИП Фамилия И.О." value={nw.name} onChange={(e) => setNw({ ...nw, name: e.target.value })} />
        <input className={`${inputCls} w-40 font-mono`} placeholder="БИН" value={nw.bin} onChange={(e) => setNw({ ...nw, bin: e.target.value })} />
        <button className={btnPrimary} onClick={() => nw.name.trim() && act(async () => { await api.ips.create(nw); setNw({ name: '', bin: '', vat: true }); })}>
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
