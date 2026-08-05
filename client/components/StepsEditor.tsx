'use client';
import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { btnGhost, btnPrimary, inputCls } from './ui';

/** Редактор шагов маршрута согласования (заявок или нарядов) — общий для нескольких вкладок настроек. */
export function StepsEditor({ steps, approvers, onSave }: {
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
