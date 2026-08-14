'use client';
import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { btnGhost, btnPrimary, inputCls } from './ui';

/** Редактор шагов маршрута согласования (заявок или нарядов) — общий для нескольких вкладок настроек.
 *  Раскладка карточки шага — как в эталоне (AdminChains): название этапа и согласующий в сетке,
 *  на телефоне сетка в один столбец, поэтому у select всегда есть место показать выбранное имя. */
export function StepsEditor({ steps, approvers, labelOptions, onSave }: {
  steps: { approverId: string; label: string }[];
  approvers: any[];
  labelOptions?: string[];
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
      {labelOptions && labelOptions.length > 0 && (
        <datalist id="step-label-suggest">
          {labelOptions.map((l) => <option key={l} value={l} />)}
        </datalist>
      )}
      <div className="space-y-2">
        {local.map((s, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white p-3">
            <div className="flex shrink-0 flex-col">
              <button onClick={() => move(i, -1)} disabled={i === 0}
                className="rounded p-0.5 text-stone-400 hover:bg-stone-100 disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button>
              <button onClick={() => move(i, 1)} disabled={i === local.length - 1}
                className="rounded p-0.5 text-stone-400 hover:bg-stone-100 disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button>
            </div>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-900 font-mono text-xs font-bold text-white">{i + 1}</span>
            <div className="grid flex-1 gap-2 sm:grid-cols-2">
              <input className={inputCls} value={s.label} placeholder="Название этапа" list={labelOptions ? 'step-label-suggest' : undefined}
                     onChange={(e) => upd(local.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              <select className={inputCls} value={s.approverId}
                      onChange={(e) => upd(local.map((x, j) => (j === i ? { ...x, approverId: e.target.value } : x)))}>
                <option value="">— согласующий —</option>
                {approvers.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <button onClick={() => upd(local.filter((_, j) => j !== i))}
              className="shrink-0 rounded-md p-2 text-stone-400 hover:bg-stone-100 hover:text-rose-600">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button className={btnGhost} onClick={() => upd([...local, { approverId: '', label: '' }])}>
          <Plus className="h-4 w-4" /> Добавить этап
        </button>
        {dirty && <button className={btnPrimary} onClick={() => { onSave(local); setDirty(false); }}>Сохранить</button>}
      </div>
      {local.length === 0 && <p className="mt-1 text-xs text-stone-400">Маршрут пуст — документ утверждается сразу.</p>}
    </div>
  );
}
