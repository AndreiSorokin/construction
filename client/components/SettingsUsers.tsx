'use client';
import { useState } from 'react';
import { KeyRound, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { ROLE_RU } from '@/lib/format';
import { Card, ErrorBox, btnGhost, btnPrimary, inputCls, labelCls, appConfirm } from './ui';

const ROLES = ['REQUESTER', 'APPROVER', 'WAREHOUSE', 'SUPPLY', 'ADMIN'];

export function SettingsUsers({ boot, reload }: { boot: any; reload: () => void }) {
  const [err, setErr] = useState('');
  const [nw, setNw] = useState({ name: '', login: '', password: '', role: 'REQUESTER', departmentId: '' });

  const act = async (fn: () => Promise<any>) => {
    setErr('');
    try { await fn(); await reload(); } catch (e: any) { setErr(e?.message || 'Ошибка'); }
  };

  const create = () => {
    if (!nw.name.trim() || !nw.login.trim() || nw.password.length < 4) { setErr('Имя, логин и пароль (мин. 4 символа) обязательны.'); return; }
    act(async () => {
      await api.users.create({ ...nw, departmentId: nw.departmentId || undefined });
      setNw({ name: '', login: '', password: '', role: 'REQUESTER', departmentId: '' });
    });
  };

  const resetPw = (u: any) => {
    const p = window.prompt(`Новый пароль для ${u.name}:`);
    if (p && p.length >= 4) act(() => api.users.resetPassword(u.id, p));
    else if (p !== null) setErr('Пароль — минимум 4 символа.');
  };

  return (
    <div>
      <ErrorBox msg={err} />
      <Card className="mb-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Новый сотрудник</div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <input className={inputCls} placeholder="Имя" value={nw.name} onChange={(e) => setNw({ ...nw, name: e.target.value })} />
          <input className={`${inputCls} font-mono`} placeholder="Логин" value={nw.login} onChange={(e) => setNw({ ...nw, login: e.target.value })} />
          <input className={`${inputCls} font-mono`} placeholder="Пароль" value={nw.password} onChange={(e) => setNw({ ...nw, password: e.target.value })} />
          <select className={inputCls} value={nw.role} onChange={(e) => setNw({ ...nw, role: e.target.value })}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_RU[r]}</option>)}
          </select>
          <select className={inputCls} value={nw.departmentId} onChange={(e) => setNw({ ...nw, departmentId: e.target.value })}>
            <option value="">Без отдела</option>
            {boot.departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <button onClick={create} className={`${btnPrimary} mt-2`}><Plus className="h-4 w-4" /> Добавить</button>
      </Card>

      <Card className="!p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-xs text-stone-400">
              <th className="p-2 pl-3">Имя / логин</th><th className="p-2">Роль</th><th className="p-2">Отдел</th>
              <th className="p-2 text-center">Наряды</th><th className="p-2 text-center">Старший</th>
              <th className="p-2 text-center">Активен</th><th className="p-2 pr-3"></th>
            </tr>
          </thead>
          <tbody>
            {boot.users.map((u: any) => (
              <tr key={u.id} className="border-b border-stone-100 last:border-0">
                <td className="p-2 pl-3">
                  <input className="w-full bg-transparent font-medium outline-none" defaultValue={u.name}
                         onBlur={(e) => e.target.value !== u.name && act(() => api.users.update(u.id, { name: e.target.value }))} />
                  <span className="font-mono text-xs text-stone-400">{u.login}</span>
                </td>
                <td className="p-2">
                  <select className="rounded border border-stone-200 px-1 py-0.5 text-xs" value={u.role}
                          onChange={(e) => act(() => api.users.update(u.id, { role: e.target.value }))}>
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_RU[r]}</option>)}
                  </select>
                </td>
                <td className="p-2">
                  <select className="rounded border border-stone-200 px-1 py-0.5 text-xs" value={u.departmentId || ''}
                          onChange={(e) => act(() => api.users.update(u.id, { departmentId: e.target.value || null }))}>
                    <option value="">—</option>
                    {boot.departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </td>
                <td className="p-2 text-center">
                  <input type="checkbox" checked={u.ordersAccess} onChange={(e) => act(() => api.users.update(u.id, { ordersAccess: e.target.checked }))} />
                </td>
                <td className="p-2 text-center">
                  {u.role === 'SUPPLY' && <input type="checkbox" checked={u.isLead} onChange={(e) => act(() => api.users.update(u.id, { isLead: e.target.checked }))} />}
                </td>
                <td className="p-2 text-center">
                  <input type="checkbox" checked={u.isActive} onChange={(e) => act(() => api.users.update(u.id, { isActive: e.target.checked }))} />
                  <label className="ml-3 inline-flex items-center gap-1 text-xs text-stone-500" title="Право менять ЦЕНЫ в нарядах">
                    <input type="checkbox" checked={!!u.canPrice} onChange={(e) => act(() => api.users.update(u.id, { canPrice: e.target.checked }))} /> цены
                  </label>
                </td>
                <td className="p-2 pr-3 text-right">
                  <button onClick={() => resetPw(u)} className={`${btnGhost} !px-2 !py-1 text-xs`} title="Сбросить пароль">
                    <KeyRound className="h-3.5 w-3.5" />
                  </button>
                  <button className={`${btnGhost} !px-2 !py-1 text-xs text-rose-600`} title="Уволить: деактивация + вычистка из маршрутов; зависшие этапы перескочат"
                    onClick={async () => {
                      if (await appConfirm(`Уволить «${u.name}»? Он исчезнет из маршрутов согласования, назначенные заявки освободятся, зависшие на нём этапы перескочат дальше. Вход будет закрыт.`, { okText: 'Уволить', danger: true }))
                        act(() => api.users.remove(u.id));
                    }}>Уволить</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="mt-2 text-xs text-stone-400">Смена роли/пароля сбрасывает активные сессии пользователя. «Активен» выключен — вход запрещён.</p>
    </div>
  );
}
