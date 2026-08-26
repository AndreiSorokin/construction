export const TYPE_RU: Record<string, string> = {
  TMC: 'ТМЦ', TRANSPORT: 'Транспорт', QUARRY: 'Карьер', FUNDS: 'Ден. средства',
  FUEL: 'ГСМ', TRAVEL: 'Командировка', PRODUCTION: 'Производство',
};
export const STATUS_RU: Record<string, string> = {
  APPROVAL: 'Согласование', SUPPLY: 'В снабжении', FULFILLED: 'Выполнена', DONE: 'Закрыта', REJECTED: 'Отклонена',
};
export const STATUS_CLS: Record<string, string> = {
  APPROVAL: 'bg-amber-50 text-amber-700 border-amber-200',
  SUPPLY: 'bg-sky-50 text-sky-700 border-sky-200',
  FULFILLED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DONE: 'bg-stone-100 text-stone-500 border-stone-200',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
};
export const ORDER_STATUS_RU: Record<string, string> = {
  APPROVAL: 'Согласование', APPROVED: 'Согласован', REJECTED: 'Отклонён',
};
export const ORDER_STATUS_CLS: Record<string, string> = {
  APPROVAL: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
};
export const PRIORITY_RU: Record<string, string> = { URGENT: 'Срочно', HIGH: 'Высокий', NORMAL: 'Обычный', LOW: 'Низкий' };
export const ROLE_RU: Record<string, string> = {
  ADMIN: 'Администратор', REQUESTER: 'Заявитель', APPROVER: 'Согласующий', WAREHOUSE: 'Склад', SUPPLY: 'Снабжение',
};
export const STAGE_RU: Record<string, string> = { NEW: 'Новые', INWORK: 'В работе', ORDERED: 'Заказано', ARRIVED: 'Прибыло' };
export const FIELD_RU: Record<string, string> = {
  vehicle: 'Транспорт', route: 'Маршрут', cargo: 'Груз', date: 'Дата',
  amount: 'Сумма, ₸', purpose: 'Назначение', fuel: 'Топливо', liters: 'Литры',
  employee: 'Сотрудник', destination: 'Куда', dateFrom: 'С', dateTo: 'По',
  material: 'Материал', volume: 'Объём',
};
export const MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

export const money = (n: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(n);
export const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString('ru-RU') : '—');
export const fmtDateTime = (s?: string | null) =>
  s ? new Date(s).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
export const periodLabel = (p: string) => {
  const [y, m] = p.split('-').map(Number);
  return `${MONTHS_RU[(m || 1) - 1]} ${y}`;
};
export const qtyNum = (q: string) => {
  const n = parseFloat(String(q).replace(',', '.').replace(/[^\d.]/g, ''));
  return isNaN(n) ? 0 : n;
};
export const lineSum = (l: { price: any; qty: string }) => qtyNum(l.qty) * Number(l.price);
