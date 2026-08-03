/* Общие для «Снабжения», «Доски снабжения» и «Банка» вычисления над заявками,
   адаптированные под модель этого клиента (см. NewRequest.tsx: HAS_ITEMS/TITLE_KEY
   отличаются от прототипа — здесь позиции есть только у ТМЦ и Производства). */

export const HAS_ITEMS = new Set(['TMC', 'PRODUCTION']);
export const TITLE_KEY: Record<string, string> = {
  TRANSPORT: 'route', QUARRY: 'material', FUNDS: 'purpose', FUEL: 'vehicle', TRAVEL: 'destination',
};
export const TYPE_CLS: Record<string, string> = {
  TMC: 'bg-amber-50 text-amber-700 border-amber-200', TRANSPORT: 'bg-sky-50 text-sky-700 border-sky-200',
  QUARRY: 'bg-lime-50 text-lime-700 border-lime-200', FUNDS: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  FUEL: 'bg-orange-50 text-orange-700 border-orange-200', TRAVEL: 'bg-violet-50 text-violet-700 border-violet-200',
  PRODUCTION: 'bg-blue-50 text-blue-700 border-blue-200',
};
export const TYPE_BORDER: Record<string, string> = {
  TMC: 'border-l-amber-400', TRANSPORT: 'border-l-sky-400', QUARRY: 'border-l-lime-400', FUNDS: 'border-l-emerald-400',
  FUEL: 'border-l-orange-400', TRAVEL: 'border-l-violet-400', PRODUCTION: 'border-l-blue-400',
};
export const PRI_RANK: Record<string, number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
export const PRI_SELECT_CLS: Record<string, string> = {
  URGENT: 'border-rose-300 text-rose-700', HIGH: 'border-amber-300 text-amber-700',
  NORMAL: 'border-stone-300 text-stone-600', LOW: 'border-stone-200 text-stone-400',
};
/* статус согласования/снабжения → сортировочный ранг (для «Банка» и очередей) */
export const STATUS_RANK: Record<string, number> = { APPROVAL: 0, SUPPLY: 1, FULFILLED: 2, DONE: 3, REJECTED: 4 };

export function reqTitle(r: any, boot: any): string {
  const key = TITLE_KEY[r.type];
  if (key && r.fields?.[key]) return r.fields[key];
  const obj = boot.objects.find((o: any) => o.id === r.objectId);
  if (obj) return obj.name;
  if (r.items?.[0]?.name) return r.items[0].name;
  return r.number;
}

export function itemProgress(r: any) {
  const t = r.items || [];
  return { done: t.filter((i: any) => i.fulfilled).length, total: t.length };
}

export const inDateRange = (iso: string, from: string, to: string) => {
  if (!from && !to) return true;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (from && t < new Date(from + 'T00:00:00').getTime()) return false;
  if (to && t > new Date(to + 'T23:59:59.999').getTime()) return false;
  return true;
};

const csvCell = (v: any) => { const s = v == null ? '' : String(v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
export const toCSV = (rows: any[][]) => '﻿' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n');
export const downloadFile = (name: string, text: string, type: string) => {
  try {
    const blob = new Blob([text], { type: type + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  } catch {}
};

/** «У кого сейчас заявка»: этап согласования / исполнитель снабжения / заявитель. */
export function holderOf(r: any, boot: any): string {
  if (r.status === 'APPROVAL') {
    const step = r.chainSteps?.find((s: any) => s.order === r.currentStageIndex);
    return step ? step.approverName : '—';
  }
  if (r.status === 'SUPPLY') {
    if (!r.assigneeId) return 'пул снабжения';
    const u = boot.users.find((x: any) => x.id === r.assigneeId);
    return u ? u.name.split(/[\s—]+/)[0] : 'снабжение';
  }
  if (r.status === 'FULFILLED') return 'заявитель';
  return '—';
}
