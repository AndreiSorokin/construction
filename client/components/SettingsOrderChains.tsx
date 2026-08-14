'use client';
import { useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Card, ErrorBox } from './ui';
import { StepsEditor } from './StepsEditor';

/** «Маршруты нарядов»: единый маршрут согласования строительных нарядов — как в эталоне (OrderChainsAdmin). */
export function SettingsOrderChains({ boot, reload }: { boot: any; reload: () => void }) {
  const [err, setErr] = useState('');
  const stroyDept = boot.departments.find((d: any) => /строит/i.test(d.name)) || boot.departments[0];
  const approvers = useMemo(
    () => boot.users.filter((u: any) => u.isActive && (u.role === 'APPROVER' || u.role === 'ADMIN')),
    [boot],
  );
  const orderSteps = boot.orderSteps
    .filter((s: any) => s.departmentId === stroyDept?.id)
    .sort((a: any, b: any) => a.order - b.order)
    .map((s: any) => ({ approverId: s.approverId, label: s.label }));
  // подсказки для «Название этапа»: все должности, уже встречавшиеся в любых маршрутах (заявок и нарядов)
  const labelOptions = useMemo(() => Array.from(new Set(
    [...boot.supplySteps, ...boot.orderSteps].map((s: any) => s.label).filter(Boolean),
  )).sort((a, b) => a.localeCompare(b, 'ru')), [boot]);

  const act = async (fn: () => Promise<any>) => {
    setErr('');
    try { await fn(); await reload(); } catch (e: any) { setErr(e?.message || 'Ошибка'); }
  };

  return (
    <div>
      <ErrorBox msg={err} />
      <p className="mb-4 text-sm leading-relaxed text-stone-500">
        Единый маршрут для всех строительных нарядов{stroyDept ? ` (отдел «${stroyDept.name}»)` : ''}.
        Наряд проходит этапы по порядку, затем считается согласованным.
      </p>
      <Card>
        {stroyDept ? (
          <StepsEditor key={`ord:${orderSteps.length}`} steps={orderSteps} approvers={approvers} labelOptions={labelOptions}
                       onSave={(s) => act(() => api.chains.setOrder(stroyDept.id, s))} />
        ) : <p className="text-sm text-stone-400">Нет отделов.</p>}
      </Card>
    </div>
  );
}
