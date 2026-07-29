'use client';
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, ErrorBox, btnGhost, btnPrimary, inputCls, appConfirm } from './ui';

const COLORS = ['stone', 'sky', 'emerald', 'violet', 'amber', 'lime', 'rose'];

export function SettingsDicts({ boot, reload }: { boot: any; reload: () => void }) {
  const [err, setErr] = useState('');
  const [dName, setDName] = useState('');
  const [oName, setOName] = useState('');
  const [cNew, setCNew] = useState({ name: '', unit: 'шт', category: '' });
  const [ipNew, setIpNew] = useState({ name: '', bin: '', vat: true });
  const [openObj, setOpenObj] = useState<string | null>(null);

  const act = async (fn: () => Promise<any>) => {
    setErr('');
    try { await fn(); await reload(); } catch (e: any) { setErr(e?.message || 'Ошибка'); }
  };
  const requesters = boot.users.filter((u: any) => u.isActive);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="lg:col-span-2"><ErrorBox msg={err} /></div>

      <Card>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Отделы</div>
        {boot.departments.map((d: any) => (
          <div key={d.id} className="mb-1 flex items-center gap-2">
            <input className={inputCls} defaultValue={d.name}
                   onBlur={(e) => e.target.value !== d.name && act(() => api.departments.update(d.id, e.target.value))} />
            <button className="text-stone-300 hover:text-rose-600" onClick={async () => (await appConfirm('Удалить отдел «' + d.name + '»? Его маршруты согласования будут удалены.', { okText: 'Удалить', danger: true })) && act(() => api.departments.remove(d.id))}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <div className="mt-2 flex gap-2">
          <input className={inputCls} placeholder="Новый отдел" value={dName} onChange={(e) => setDName(e.target.value)} />
          <button className={btnPrimary} onClick={() => dName.trim() && act(async () => { await api.departments.create(dName.trim()); setDName(''); })}>
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </Card>

      <Card>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">ИП-подрядчики (для нарядов)</div>
        {boot.ips.map((i: any) => (
          <div key={i.id} className="mb-1 flex items-center gap-2 text-sm">
            <input className={`${inputCls} flex-1`} defaultValue={i.name}
                   onBlur={(e) => e.target.value !== i.name && act(() => api.ips.update(i.id, { name: e.target.value }))} />
            <input className={`${inputCls} w-32 font-mono`} defaultValue={i.bin || ''} placeholder="БИН/ИИН"
                   onBlur={(e) => e.target.value !== (i.bin || '') && act(() => api.ips.update(i.id, { bin: e.target.value }))} />
            <label className="flex items-center gap-1 text-xs text-stone-500">
              <input type="checkbox" checked={i.vat} onChange={(e) => act(() => api.ips.update(i.id, { vat: e.target.checked }))} /> НДС
            </label>
            <button className="text-stone-300 hover:text-rose-600" onClick={async () => (await appConfirm('Удалить ИП «' + i.name + '»? Уже созданные наряды сохранят его название.', { okText: 'Удалить', danger: true })) && act(() => api.ips.remove(i.id))}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <div className="mt-2 flex gap-2">
          <input className={inputCls} placeholder="ИП Фамилия И.О." value={ipNew.name} onChange={(e) => setIpNew({ ...ipNew, name: e.target.value })} />
          <input className={`${inputCls} w-32 font-mono`} placeholder="БИН" value={ipNew.bin} onChange={(e) => setIpNew({ ...ipNew, bin: e.target.value })} />
          <button className={btnPrimary} onClick={() => ipNew.name.trim() && act(async () => { await api.ips.create(ipNew); setIpNew({ name: '', bin: '', vat: true }); })}>
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </Card>

      <Card>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Объекты и доступ заявителей</div>
        {boot.objects.map((o: any) => (
          <div key={o.id} className="mb-2 rounded-lg border border-stone-100 p-2">
            <div className="flex items-center gap-2">
              <span className={`h-3 w-3 rounded-full bg-${o.color}-400`} />
              <input className={`${inputCls} flex-1`} defaultValue={o.name}
                     onBlur={(e) => e.target.value !== o.name && act(() => api.objects.update(o.id, { name: e.target.value }))} />
              <select className={`${inputCls} w-24`} value={o.color} onChange={(e) => act(() => api.objects.update(o.id, { color: e.target.value }))}>
                {COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <button className={`${btnGhost} !px-2 !py-1 text-xs`} onClick={() => setOpenObj(openObj === o.id ? null : o.id)}>
                Доступ · {o.userIds.length}
              </button>
              <button className="text-stone-300 hover:text-rose-600" onClick={async () => (await appConfirm('Удалить объект «' + o.name + '»? Заявки и наряды сохранят его название.', { okText: 'Удалить', danger: true })) && act(() => api.objects.remove(o.id))}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            {openObj === o.id && (
              <div className="mt-2 grid gap-1 sm:grid-cols-2">
                {requesters.map((u: any) => (
                  <label key={u.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={o.userIds.includes(u.id)}
                           onChange={(e) => {
                             const next = e.target.checked ? [...o.userIds, u.id] : o.userIds.filter((x: string) => x !== u.id);
                             act(() => api.objects.setAccess(o.id, next));
                           }} />
                    {u.name}
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
        <div className="mt-2 flex gap-2">
          <input className={inputCls} placeholder="Новый объект" value={oName} onChange={(e) => setOName(e.target.value)} />
          <button className={btnPrimary} onClick={() => oName.trim() && act(async () => { await api.objects.create({ name: oName.trim() }); setOName(''); })}>
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </Card>

      <Card>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Номенклатура снабжения (подсказки в заявках)</div>
        <div className="max-h-72 overflow-y-auto">
          {boot.catalogItems.map((c: any) => (
            <div key={c.id} className="mb-1 flex items-center gap-2">
              <input className={`${inputCls} flex-1`} defaultValue={c.name}
                     onBlur={(e) => e.target.value !== c.name && act(() => api.catalogItems.update(c.id, { name: e.target.value }))} />
              <input className={`${inputCls} w-20`} defaultValue={c.unit}
                     onBlur={(e) => e.target.value !== c.unit && act(() => api.catalogItems.update(c.id, { unit: e.target.value }))} />
              <input className={`${inputCls} w-32`} defaultValue={c.category} placeholder="категория"
                     onBlur={(e) => e.target.value !== c.category && act(() => api.catalogItems.update(c.id, { category: e.target.value }))} />
              <button className="text-stone-300 hover:text-rose-600" onClick={() => act(() => api.catalogItems.remove(c.id))}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input className={inputCls} placeholder="Наименование" value={cNew.name} onChange={(e) => setCNew({ ...cNew, name: e.target.value })} />
          <input className={`${inputCls} w-20`} placeholder="ед." value={cNew.unit} onChange={(e) => setCNew({ ...cNew, unit: e.target.value })} />
          <button className={btnPrimary} onClick={() => cNew.name.trim() && act(async () => { await api.catalogItems.create(cNew); setCNew({ name: '', unit: 'шт', category: '' }); })}>
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </Card>
    </div>
  );
}
