'use client';
import { useState } from 'react';
import { KeyRound, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { ROLE_RU } from '@/lib/format';
import { Card, ErrorBox, btnGhost, btnPrimary, inputCls, labelCls, appConfirm, appPrompt } from './ui';

const ROLES = ['REQUESTER', 'APPROVER', 'WAREHOUSE', 'SUPPLY', 'ADMIN'];

/** «Люди»: карточки вместо широкой таблицы — как в эталоне (AdminUsers). На телефоне поля
 *  каждой карточки стоят в столбик, ничего не расползается и не прячется за узкими ячейками. */
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

  const resetPw = async (u: any) => {
    const p = await appPrompt(`Новый пароль для ${u.name}:`);
    if (p === null) return;
    if (p.length < 4) { setErr('Пароль — минимум 4 символа.'); return; }
    act(() => api.users.resetPassword(u.id, p));
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

      <div className="grid gap-2.5 lg:grid-cols-2">
        {boot.users.map((u: any) => {
          const isSelf = u.id === boot.me?.id;
          return (
            <Card key={u.id} className="!p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={labelCls}>Имя / должность</label>
                  <input className={inputCls} defaultValue={u.name}
                         onBlur={(e) => e.target.value !== u.name && act(() => api.users.update(u.id, { name: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Роль</label>
                  <select className={inputCls} value={u.role} disabled={isSelf}
                          title={isSelf ? 'Нельзя изменить собственную роль' : undefined}
                          onChange={(e) => act(() => api.users.update(u.id, { role: e.target.value }))}>
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_RU[r]}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Отдел</label>
                  <select className={inputCls} value={u.departmentId || ''}
                          onChange={(e) => act(() => api.users.update(u.id, { departmentId: e.target.value || null }))}>
                    <option value="">— не задан —</option>
                    {boot.departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Логин</label>
                  <div className="truncate rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 font-mono text-sm text-stone-600">
                    {u.login}{isSelf && <span className="text-stone-400"> · это вы</span>}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Пароль</label>
                  <button onClick={() => resetPw(u)} className={`${btnGhost} w-full`}>
                    <KeyRound className="h-3.5 w-3.5" /> Сбросить
                  </button>
                </div>
              </div>

              <div className="mt-2.5 space-y-1.5">
                <label className="flex items-center gap-2 text-sm text-stone-600">
                  <input type="checkbox" checked={u.ordersAccess} className="accent-stone-900"
                         onChange={(e) => act(() => api.users.update(u.id, { ordersAccess: e.target.checked }))} />
                  Доступ к разделу «Наряды»
                </label>
                {u.role === 'SUPPLY' && (
                  <label className="flex items-center gap-2 text-sm text-stone-600">
                    <input type="checkbox" checked={u.isLead} className="accent-stone-900"
                           onChange={(e) => act(() => api.users.update(u.id, { isLead: e.target.checked }))} />
                    Старший снабжения — может назначать исполнителей
                  </label>
                )}
                <label className="flex items-center gap-2 text-sm text-stone-600">
                  <input type="checkbox" checked={!!u.canPrice} className="accent-stone-900"
                         onChange={(e) => act(() => api.users.update(u.id, { canPrice: e.target.checked }))} />
                  Право менять цены в нарядах
                </label>
                <label className={`flex items-center gap-2 text-sm ${isSelf ? 'text-stone-300' : 'text-stone-600'}`}
                       title={isSelf ? 'Нельзя деактивировать самого себя' : undefined}>
                  <input type="checkbox" checked={u.isActive} disabled={isSelf} className="accent-stone-900"
                         onChange={(e) => act(() => api.users.update(u.id, { isActive: e.target.checked }))} />
                  Активен — вход разрешён
                </label>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-2">
                <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">{ROLE_RU[u.role] || u.role}</span>
                <button disabled={isSelf} title={isSelf ? 'Нельзя уволить самого себя' : 'Уволить: деактивация + вычистка из маршрутов; зависшие этапы перескочат'}
                  className="inline-flex items-center gap-1 text-xs text-stone-400 hover:text-rose-600 disabled:opacity-30"
                  onClick={async () => {
                    if (await appConfirm(`Уволить «${u.name}»? Он исчезнет из маршрутов согласования, назначенные заявки освободятся, зависшие на нём этапы перескочат дальше. Вход будет закрыт.`, { okText: 'Уволить', danger: true }))
                      act(() => api.users.remove(u.id));
                  }}>
                  <Trash2 className="h-3.5 w-3.5" /> {isSelf ? 'это вы' : 'уволить'}
                </button>
              </div>
            </Card>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-stone-400">Смена роли/пароля сбрасывает активные сессии пользователя. «Активен» выключен — вход запрещён.</p>
    </div>
  );
}
