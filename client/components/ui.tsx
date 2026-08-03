'use client';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { TYPE_CLS } from '@/lib/requestHelpers';
import { TYPE_RU } from '@/lib/format';

/* Единый визуальный язык — 1-в-1 с эталоном прототипа. */
export const inputCls =
  'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder-stone-400 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-100';
export const labelCls = 'mb-1 block text-xs font-medium text-stone-600';
export const btnPrimary =
  'inline-flex items-center justify-center gap-1.5 rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-stone-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 disabled:opacity-50';
export const btnGhost =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-50';
export const btnSm =
  'inline-flex items-center justify-center gap-1 rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-50';
export const btnDanger =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-50';
export const sectionLabelCls = 'mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400';
const pillActive = 'border-stone-900 bg-stone-900 text-white';
const pillIdle = 'border-stone-300 bg-white text-stone-600 hover:bg-stone-50';
export const pillCls = (on: boolean) =>
  `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${on ? pillActive : pillIdle}`;

export function Badge({ children, cls }: { children: ReactNode; cls?: string }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${cls || 'border-stone-200 bg-stone-100 text-stone-600'}`}>
      {children}
    </span>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-stone-200 bg-white p-4 shadow-sm ${className || ''}`}>{children}</div>;
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="mb-5">
      <div className="mb-2 flex items-center justify-between">
        <h3 className={sectionLabelCls + ' !mb-0'}>{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

export function ErrorBox({ msg }: { msg: string }) {
  if (!msg) return null;
  return <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{msg}</div>;
}

export function Empty({ text }: { text: string }) {
  return <p className="py-10 text-center text-sm text-stone-400">{text}</p>;
}

/** обёртка действий: показывает ошибку и блокирует кнопки */
export function useBusy() {
  return { wrap: async (fn: () => Promise<any>, setErr: (s: string) => void, setBusy: (b: boolean) => void) => {
    setErr(''); setBusy(true);
    try { await fn(); } catch (e: any) { setErr(e?.message || 'Ошибка'); } finally { setBusy(false); }
  } };
}

/* ──────────────────────────── DialogHost: замена window.confirm/prompt ──────────────────────────── */
// Использование: await appConfirm('Удалить?', { okText: 'Удалить', danger: true }) → boolean
//                await appPrompt('Сумма, ₸', { initial: '' }) → string | null
type DlgState = {
  kind: 'confirm' | 'prompt'; text: string; okText: string; danger?: boolean; initial?: string;
  resolve: (v: any) => void;
} | null;
let _setDlg: ((d: DlgState) => void) | null = null;

export function appConfirm(text: string, opts: { okText?: string; danger?: boolean } = {}): Promise<boolean> {
  return new Promise((resolve) => {
    if (!_setDlg) { resolve(window.confirm(text)); return; } // запасной путь, если хост не смонтирован
    _setDlg({ kind: 'confirm', text, okText: opts.okText || 'Да', danger: opts.danger, resolve });
  });
}
export function appPrompt(text: string, opts: { okText?: string; initial?: string } = {}): Promise<string | null> {
  return new Promise((resolve) => {
    if (!_setDlg) { resolve(window.prompt(text, opts.initial || '')); return; }
    _setDlg({ kind: 'prompt', text, okText: opts.okText || 'Сохранить', initial: opts.initial || '', resolve });
  });
}

export function DialogHost() {
  const [dlg, setDlg] = useState<DlgState>(null);
  const [val, setVal] = useState('');
  useEffect(() => { _setDlg = (d) => { setDlg(d); setVal(d && d.kind === 'prompt' ? d.initial || '' : ''); }; return () => { _setDlg = null; }; }, []);
  if (!dlg) return null;
  const close = (v: any) => { const r = dlg.resolve; setDlg(null); r(v); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }} onClick={() => close(dlg.kind === 'confirm' ? false : null)}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm leading-relaxed text-stone-800">{dlg.text}</div>
        {dlg.kind === 'prompt' && (
          <input autoFocus value={val} onChange={(e) => setVal(e.target.value)}
            className="mt-3 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded-lg px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100"
            onClick={() => close(dlg.kind === 'confirm' ? false : null)}>Отмена</button>
          <button className={`rounded-lg px-3 py-1.5 text-sm font-medium text-white ${dlg.danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-stone-900 hover:bg-stone-700'}`}
            onClick={() => close(dlg.kind === 'confirm' ? true : val)}>{dlg.okText}</button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────── История: кнопка + всплывающее окно ──────────────────────────── */
export const HIST_LABELS: Record<string, string> = {
  CREATED: 'создал(а)', APPROVED: 'согласовал(а)', REJECTED: 'отклонил(а)', RETURNED: 'вернул(а) в снабжение',
  STOCK: 'отметка склада', FULFILLED: 'выполнено', CONFIRMED: 'подтвердил(а) получение',
  EDITED: 'изменил(а)', RESUBMITTED: 'отправил(а) повторно', WITHDRAWN: 'отозвал(а)',
  CONSOLIDATED: 'включено в сводную', UNCONSOLIDATED: 'сводная расформирована',
};
export function HistoryModal({ title, items, onClose }: {
  title: string; items: { action: string; byName: string; stage?: string | null; comment?: string | null; at: string }[]; onClose: () => void;
}) {
  const list = [...(items || [])].reverse();
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }} onClick={onClose}>
      <div className="flex w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:max-w-lg sm:rounded-2xl" style={{ maxHeight: '85vh' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b border-stone-200 px-4 py-3">
          <div className="text-sm font-semibold text-stone-800">{title} <span className="font-normal text-stone-400">· {list.length}</span></div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {list.length === 0 ? <p className="py-6 text-center text-sm text-stone-400">Пока ничего не происходило.</p> : (
            <div className="space-y-3">{list.map((h, i) => (
              <div key={i} className="text-sm">
                <div className="text-stone-700"><span className="font-medium text-stone-900">{h.byName}</span> {HIST_LABELS[h.action] || h.action}{h.stage ? <span className="text-stone-500"> · «{h.stage}»</span> : null}</div>
                {h.comment && <div className="mt-0.5 text-stone-500">{h.comment}</div>}
                <div className="mt-0.5 font-mono text-xs text-stone-400">{new Date(h.at).toLocaleString('ru-RU')}</div>
              </div>
            ))}</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────── Общие элементы дизайна (по эталону) ──────────────────────── */

const HEAD_ACCENT: Record<string, string> = {
  amber: 'bg-amber-50 text-amber-600', sky: 'bg-sky-50 text-sky-600',
  violet: 'bg-violet-50 text-violet-600', emerald: 'bg-emerald-50 text-emerald-600',
  rose: 'bg-rose-50 text-rose-600', stone: 'bg-stone-100 text-stone-600',
};

/** Заголовок экрана: «Назад», иконка в цветном квадрате, название и пояснение. */
export function PageHeader({ title, sub, icon: Icon, accent = 'stone', onBack, right }: {
  title: string; sub?: string; icon?: any; accent?: string; onBack?: () => void; right?: ReactNode;
}) {
  return (
    <div className="mb-4">
      {onBack && (
        <button onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-sm text-stone-500 transition hover:text-stone-800">
          <span aria-hidden>←</span> Назад
        </button>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${HEAD_ACCENT[accent] || HEAD_ACCENT.stone}`}>
              <Icon className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-semibold leading-tight tracking-tight text-stone-900">{title}</h1>
            {sub && <p className="mt-0.5 text-xs text-stone-500">{sub}</p>}
          </div>
        </div>
        {right}
      </div>
    </div>
  );
}

const dayWord = (n: number) => {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return 'день';
  if (a >= 2 && a <= 4 && (b < 10 || b >= 20)) return 'дня';
  return 'дней';
};
const overdueStyle = (n: number) =>
  n >= 10 ? 'border-rose-700 bg-rose-600 text-white'
    : n >= 6 ? 'border-rose-400 bg-rose-200 text-rose-900'
      : n >= 3 ? 'border-rose-300 bg-rose-100 text-rose-800'
        : 'border-rose-200 bg-rose-50 text-rose-700';

export const overdueDays = (due?: string | null, status?: string) => {
  if (!due || (status !== 'APPROVAL' && status !== 'SUPPLY')) return 0;
  const d = new Date(due); d.setHours(0, 0, 0, 0);
  const n = new Date(); n.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((n.getTime() - d.getTime()) / 86400000));
};

/** Срок: «просрочено N дней» с усилением цвета, иначе спокойная плашка «до …». */
export function DueBadge({ due, status }: { due?: string | null; status?: string }) {
  if (!due) return null;
  const n = overdueDays(due, status);
  if (n > 0) {
    return (
      <span className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-semibold ${overdueStyle(n)}`}>
        ⚠ просрочено {n} {dayWord(n)}
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-500">
      до {new Date(due).toLocaleDateString('ru-RU')}
    </span>
  );
}

/** Цветная точка объекта (палитра объектов есть в safelist Tailwind). */
export function ObjectDot({ color }: { color?: string | null }) {
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full bg-${color || 'stone'}-400`} />;
}

/** Бейдж типа заявки (ТМЦ/Транспорт/…), единый для «Снабжения», доски и «Банка». */
export function TypeBadge({ type }: { type: string }) {
  return <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${TYPE_CLS[type] || TYPE_CLS.TMC}`}>{TYPE_RU[type]}</span>;
}

/** Нижняя панель массовых действий согласующего. */
export function BulkBar({ count, onApprove, onReject, onCancel, busy }: {
  count: number; onApprove: () => void; onReject: () => void; onCancel: () => void; busy?: boolean;
}) {
  return (
    <div className="no-print fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white p-3 shadow-lg lg:left-60">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm text-stone-600">Выбрано: <span className="font-semibold text-stone-900">{count}</span></span>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button onClick={onCancel} className={btnGhost}>Отмена</button>
          <button disabled={count === 0 || busy} onClick={onReject}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-40 sm:w-auto">
            Отклонить все
          </button>
          <button disabled={count === 0 || busy} onClick={onApprove}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-40 sm:w-auto">
            Согласовать все
          </button>
        </div>
      </div>
    </div>
  );
}

/** Колокольчик событий: что произошло по заявкам пользователя. */
export function NotifBell({ items, onOpen, dark }: {
  items: { id: string; reqId: string; number: string; text: string; at: string }[];
  onOpen: (reqId: string) => void; dark?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} title="События"
        className={dark
          ? 'relative inline-flex items-center justify-center rounded-lg bg-stone-800 p-2 text-stone-300 hover:bg-stone-700'
          : 'relative inline-flex items-center justify-center rounded-lg border border-stone-300 bg-white p-2 text-stone-600 hover:bg-stone-50'}>
        <span aria-hidden>🔔</span>
        {items.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-xs font-bold text-white">
            {items.length > 9 ? '9+' : items.length}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-xl border border-stone-200 bg-white text-stone-900 shadow-xl" style={{ maxWidth: 'calc(100vw - 2rem)' }}>
            <div className="border-b border-stone-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-stone-400">События по вашим заявкам</div>
            <div className="max-h-96 overflow-y-auto">
              {items.length === 0 ? (
                <div className="px-3 py-8 text-center text-sm text-stone-400">Пока событий нет.</div>
              ) : items.map((e) => (
                <button key={e.id} onClick={() => { setOpen(false); onOpen(e.reqId); }}
                  className="block w-full border-b border-stone-100 px-3 py-2 text-left last:border-0 hover:bg-stone-50">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-stone-900">{e.number}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-stone-700">{e.text}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-stone-400">{new Date(e.at).toLocaleString('ru-RU')}</div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
