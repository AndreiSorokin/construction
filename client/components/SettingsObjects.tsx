'use client';
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, ErrorBox, btnPrimary, btnGhost, inputCls, appConfirm } from './ui';

const COLORS = ['stone', 'sky', 'emerald', 'violet', 'amber', 'lime', 'rose'];

/** «Объекты»: объекты, на которые выписываются заявки, и доступ заявителей к каждому — как в эталоне (AdminObjects). */
export function SettingsObjects({ boot, reload }: { boot: any; reload: () => void }) {
  const [err, setErr] = useState('');
  const [oName, setOName] = useState('');
  const [openObj, setOpenObj] = useState<string | null>(null);

  const act = async (fn: () => Promise<any>) => {
    setErr('');
    try { await fn(); await reload(); } catch (e: any) { setErr(e?.message || 'Ошибка'); }
  };
  const requesters = boot.users.filter((u: any) => u.isActive);

  return (
    <div>
      <ErrorBox msg={err} />
      <p className="mb-4 text-sm leading-relaxed text-stone-500">Объекты, на которые выписываются заявки. Отметьте, кто из заявителей может выбирать каждый объект.</p>
      <div className="space-y-2.5">
        {boot.objects.map((o: any) => (
          <Card key={o.id} className="!p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`h-3 w-3 shrink-0 rounded-full bg-${o.color || 'stone'}-400`} />
              <input className={`${inputCls} min-w-0 flex-1`} defaultValue={o.name}
                     onBlur={(e) => e.target.value !== o.name && act(() => api.objects.update(o.id, { name: e.target.value }))} />
              <button className={`${btnGhost} !px-2 !py-1 text-xs`} onClick={() => setOpenObj(openObj === o.id ? null : o.id)}>
                Доступ · {(o.userIds || []).length}
              </button>
              <button className="shrink-0 rounded-md p-2 text-stone-400 hover:bg-stone-100 hover:text-rose-600"
                onClick={async () => (await appConfirm('Удалить объект «' + o.name + '»? Уже созданные заявки и наряды сохранят его название.', { okText: 'Удалить', danger: true })) && act(() => api.objects.remove(o.id))}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-stone-400">Цвет:</span>
              {COLORS.map((c) => (
                <button key={c} onClick={() => act(() => api.objects.update(o.id, { color: c }))} title={c}
                  className={`h-5 w-5 rounded-full bg-${c}-400 ${(o.color || 'stone') === c ? 'ring-2 ring-stone-900 ring-offset-1' : 'hover:scale-110'}`} />
              ))}
            </div>
            {openObj === o.id && (
              <div className="mt-2 border-t border-stone-100 pt-2">
                <div className="mb-1 text-xs text-stone-400">Доступ:</div>
                {requesters.length === 0 ? <span className="text-xs text-stone-400">Нет активных пользователей.</span> : (
                  <div className="flex flex-wrap gap-1.5">
                    {requesters.map((u: any) => {
                      const on = (o.userIds || []).includes(u.id);
                      return (
                        <button key={u.id} onClick={() => {
                          const next = on ? (o.userIds || []).filter((x: string) => x !== u.id) : [...(o.userIds || []), u.id];
                          act(() => api.objects.setAccess(o.id, next));
                        }} className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs transition ${on ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 bg-white text-stone-600 hover:bg-stone-50'}`}>
                          {u.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </Card>
        ))}
        {boot.objects.length === 0 && <p className="rounded-lg border border-dashed border-stone-300 bg-white py-8 text-center text-sm text-stone-400">Объектов нет.</p>}
      </div>
      <div className="mt-3 flex gap-2">
        <input className={inputCls} placeholder="Новый объект" value={oName} onChange={(e) => setOName(e.target.value)} />
        <button className={btnPrimary} onClick={() => oName.trim() && act(async () => { await api.objects.create({ name: oName.trim() }); setOName(''); })}>
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
