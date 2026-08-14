'use client';
import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { TYPE_RU } from '@/lib/format';
import { Card, ErrorBox, btnPrimary, inputCls, appConfirm } from './ui';
import { StepsEditor } from './StepsEditor';

/** «Отделы и маршруты»: отделы (создать/переименовать/удалить) + маршрут согласования
 *  заявок по связке отдел × тип — как в эталоне (AdminChains). */
export function SettingsDepartments({ boot, reload }: { boot: any; reload: () => void }) {
  const [err, setErr] = useState('');
  const [dName, setDName] = useState('');
  const [deptId, setDeptId] = useState(boot.departments[0]?.id || '');
  const [type, setType] = useState('TMC');

  const act = async (fn: () => Promise<any>) => {
    setErr('');
    try { await fn(); await reload(); } catch (e: any) { setErr(e?.message || 'Ошибка'); }
  };

  const approvers = useMemo(
    () => boot.users.filter((u: any) => u.isActive && (u.role === 'APPROVER' || u.role === 'ADMIN' || u.role === 'WAREHOUSE')),
    [boot],
  );
  const curDeptId = boot.departments.find((d: any) => d.id === deptId) ? deptId : boot.departments[0]?.id || '';
  const supplySteps = boot.supplySteps
    .filter((s: any) => s.departmentId === curDeptId && s.type === type)
    .sort((a: any, b: any) => a.order - b.order)
    .map((s: any) => ({ approverId: s.approverId, label: s.label }));
  // подсказки для «Название этапа»: все должности, уже встречавшиеся в любых маршрутах (заявок и нарядов)
  const labelOptions = useMemo(() => Array.from(new Set(
    [...boot.supplySteps, ...boot.orderSteps].map((s: any) => s.label).filter(Boolean),
  )).sort((a, b) => a.localeCompare(b, 'ru')), [boot]);

  return (
    <div>
      <ErrorBox msg={err} />
      <Card className="mb-4">
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
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Маршрут согласования заявок (отдел × тип)</div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {boot.departments.map((d: any) => (
            <button key={d.id} onClick={() => setDeptId(d.id)}
                    className={`rounded-lg border px-3 py-1.5 text-sm ${curDeptId === d.id ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 bg-white'}`}>
              {d.name}
            </button>
          ))}
        </div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {Object.entries(TYPE_RU).map(([k, v]) => (
            <button key={k} onClick={() => setType(k)}
                    className={`rounded-lg border px-2.5 py-1 text-xs ${type === k ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-stone-200 bg-white text-stone-500'}`}>
              {v}
            </button>
          ))}
        </div>
        <StepsEditor key={`${curDeptId}:${type}:${supplySteps.length}`} steps={supplySteps} approvers={approvers} labelOptions={labelOptions}
                     onSave={(s) => act(() => api.chains.setSupply(curDeptId, type, s))} />
        {approvers.length === 0 && <p className="mt-2 text-xs text-amber-700">Нет согласующих — добавьте их во вкладке «Люди».</p>}
      </Card>
    </div>
  );
}
