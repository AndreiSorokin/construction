'use client';
import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { TYPE_RU } from '@/lib/format';
import { Card, ErrorBox, btnGhost, btnPrimary, inputCls } from './ui';

function StepsEditor({ steps, approvers, onSave }: {
  steps: { approverId: string; label: string }[];
  approvers: any[];
  onSave: (s: { approverId: string; label: string }[]) => void;
}) {
  const [local, setLocal] = useState(steps);
  const [dirty, setDirty] = useState(false);
  const upd = (next: typeof local) => { setLocal(next); setDirty(true); };
  const move = (i: number, d: number) => {
    const j = i + d; if (j < 0 || j >= local.length) return;
    const a = [...local]; const t = a[i]; a[i] = a[j]; a[j] = t; upd(a);
  };
  return (
    <div>
      {local.map((s, i) => (
        <div key={i} className="mb-1.5 flex items-center gap-1.5">
          <span className="w-5 text-center text-xs text-stone-400">{i + 1}</span>
          <select className={`${inputCls} flex-1`} value={s.approverId}
                  onChange={(e) => upd(local.map((x, j) => (j === i ? { ...x, approverId: e.target.value } : x)))}>
            {approvers.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <input className={`${inputCls} w-36`} value={s.label} placeholder="этап"
                 onChange={(e) => upd(local.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
          <button className="text-stone-400" onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></button>
          <button className="text-stone-400" onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></button>
          <button className="text-stone-300 hover:text-rose-600" onClick={() => upd(local.filter((_, j) => j !== i))}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <div className="mt-2 flex gap-2">
        <button className={btnGhost} onClick={() => approvers[0] && upd([...local, { approverId: approvers[0].id, label: 'Согласование' }])}>
          <Plus className="h-4 w-4" /> Этап
        </button>
        {dirty && <button className={btnPrimary} onClick={() => { onSave(local); setDirty(false); }}>Сохранить</button>}
      </div>
      {local.length === 0 && <p className="mt-1 text-xs text-stone-400">Маршрут пуст — документ утверждается сразу.</p>}
    </div>
  );
}

export function SettingsChains({ boot, reload }: { boot: any; reload: () => void }) {
  const [err, setErr] = useState('');
  const [deptId, setDeptId] = useState(boot.departments[0]?.id || '');
  const [type, setType] = useState('TMC');
  const approvers = useMemo(
    () => boot.users.filter((u: any) => u.isActive && (u.role === 'APPROVER' || u.role === 'ADMIN' || u.role === 'WAREHOUSE')),
    [boot],
  );
  const stroyDept = boot.departments.find((d: any) => /строит/i.test(d.name)) || boot.departments[0];

  const supplySteps = boot.supplySteps
    .filter((s: any) => s.departmentId === deptId && s.type === type)
    .sort((a: any, b: any) => a.order - b.order)
    .map((s: any) => ({ approverId: s.approverId, label: s.label }));

  const orderSteps = boot.orderSteps
    .filter((s: any) => s.departmentId === stroyDept?.id)
    .sort((a: any, b: any) => a.order - b.order)
    .map((s: any) => ({ approverId: s.approverId, label: s.label }));

  const save = async (fn: () => Promise<any>) => {
    setErr('');
    try { await fn(); await reload(); } catch (e: any) { setErr(e?.message || 'Ошибка'); }
  };

  return (
    <div>
      <ErrorBox msg={err} />
      <Card className="mb-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Маршруты согласования заявок (отдел × тип)</div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {boot.departments.map((d: any) => (
            <button key={d.id} onClick={() => setDeptId(d.id)}
                    className={`rounded-lg border px-3 py-1.5 text-sm ${deptId === d.id ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 bg-white'}`}>
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
        <StepsEditor key={`${deptId}:${type}:${supplySteps.length}`} steps={supplySteps} approvers={approvers}
                     onSave={(s) => save(() => api.chains.setSupply(deptId, type, s))} />
      </Card>

      <Card>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Маршрут согласования нарядов (строительные)</div>
        {stroyDept ? (
          <StepsEditor key={`ord:${orderSteps.length}`} steps={orderSteps} approvers={approvers}
                       onSave={(s) => save(() => api.chains.setOrder(stroyDept.id, s))} />
        ) : <p className="text-sm text-stone-400">Нет отделов.</p>}
      </Card>
    </div>
  );
}
