import { getAccessToken, setAccessToken, refresh, isAccessFresh, clearAuth } from './auth/refresh-client';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/** fetch с авто-обновлением access-токена и одним повтором на 401 */
export async function authFetch(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  if (!isAccessFresh()) await refresh(API);

  const isForm = typeof FormData !== 'undefined' && init.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isForm ? {} : { 'Content-Type': 'application/json' }),
    ...((init.headers as Record<string, string>) || {}),
  };
  const at = getAccessToken();
  if (at) headers.Authorization = 'Bearer ' + at;

  const res = await fetch(API + path, { ...init, credentials: 'include', headers });

  if (res.status === 401 && retry) {
    const t = await refresh(API);
    if (!t) {
      clearAuth();
      return res;
    }
    return authFetch(path, init, false);
  }
  return res;
}

async function UPLOAD(path: string, fd: FormData) {
  return json(await authFetch(path, { method: 'POST', body: fd }));
}

async function json<T = any>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const b = await res.json();
      msg = b.message || b.error || msg;
    } catch {}
    throw new Error(Array.isArray(msg) ? msg.join(', ') : String(msg));
  }
  return res.json();
}

const GET = (p: string) => authFetch(p).then(json);
const POST = (p: string, body?: any) => authFetch(p, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }).then(json);
const PATCH = (p: string, body: any) => authFetch(p, { method: 'PATCH', body: JSON.stringify(body) }).then(json);
const PUT = (p: string, body: any) => authFetch(p, { method: 'PUT', body: JSON.stringify(body) }).then(json);
const DEL = (p: string) => authFetch(p, { method: 'DELETE' }).then(json);

export const api = {
  async login(login: string, password: string) {
    const r = await fetch(API + '/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password }),
    });
    const data = await json<{ accessToken: string; user: any }>(r);
    setAccessToken(data.accessToken);
    return data.user;
  },
  me: () => GET('/api/auth/me'),
  async logout() {
    await authFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    clearAuth();
  },
  changePassword: (oldPassword: string, newPassword: string) =>
    POST('/api/auth/change-password', { oldPassword, newPassword }),

  bootstrap: () => GET('/api/meta/bootstrap'),

  requests: {
    list: () => GET('/api/requests') as Promise<any[]>,
    get: (id: string) => GET(`/api/requests/${id}`),
    create: (dto: any) => POST('/api/requests', dto),
    decide: (id: string, action: 'approve' | 'reject', comment?: string) =>
      POST(`/api/requests/${id}/decide`, { action, comment }),
    claim: (id: string) => POST(`/api/requests/${id}/claim`),
    setStage: (id: string, stage: string) => PATCH(`/api/requests/${id}/supply-stage`, { stage }),
    fulfill: (id: string) => POST(`/api/requests/${id}/fulfill`),
    confirm: (id: string) => POST(`/api/requests/${id}/confirm`),
    return: (id: string) => POST(`/api/requests/${id}/return`),
    supplyNote: (id: string, text: string) => POST(`/api/requests/${id}/supply-notes`, { text }),
    stock: (id: string, itemId: string, status: 'IN' | 'OUT') =>
      PATCH(`/api/requests/${id}/items/${itemId}/stock`, { status }),
    fulfilled: (id: string, itemId: string, fulfilled: boolean) =>
      PATCH(`/api/requests/${id}/items/${itemId}/fulfilled`, { fulfilled }),
    assign: (id: string, assigneeId: string) => PATCH(`/api/requests/${id}/assign`, { assigneeId }),
    postpone: (id: string, postponed: boolean) => PATCH(`/api/requests/${id}/postpone`, { postponed }),
  },

  orders: {
    list: () => GET('/api/orders') as Promise<any[]>,
    get: (id: string) => GET(`/api/orders/${id}`),
    create: (dto: any) => POST('/api/orders', dto),
    decide: (id: string, action: 'approve' | 'reject', comment?: string) =>
      POST(`/api/orders/${id}/decide`, { action, comment }),
  },

  files: {
    upload: (requestId: string, file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return authFetch(`/api/files/request/${requestId}`, { method: 'POST', body: fd }).then(json);
    },
    url: (id: string) => GET(`/api/files/${id}/url`) as Promise<{ url: string }>,
    remove: (id: string) => DEL(`/api/files/${id}`),
    // файл через собственный домен (не прямая ссылка на S3-бакет — её блокируют некоторые антивирусы)
    async open(id: string) {
      const res = await authFetch(`/api/files/${id}/download`);
      if (!res.ok) throw new Error('Не удалось открыть файл');
      const blobUrl = URL.createObjectURL(await res.blob());
      window.open(blobUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    },
  },

  notes: {
    list: () => GET('/api/notes') as Promise<any[]>,
    create: () => POST('/api/notes'),
    update: (id: string, dto: { title?: string; body?: string }) => PATCH(`/api/notes/${id}`, dto),
    remove: (id: string) => DEL(`/api/notes/${id}`),
  },

  users: {
    create: (dto: any) => POST('/api/users', dto),
    update: (id: string, dto: any) => PATCH(`/api/users/${id}`, dto),
    resetPassword: (id: string, newPassword: string) => POST(`/api/users/${id}/password`, { newPassword }),
    remove: (id: string) => DEL(`/api/users/${id}`),
  },

  departments: {
    create: (name: string) => POST('/api/departments', { name }),
    update: (id: string, name: string) => PATCH(`/api/departments/${id}`, { name }),
    remove: (id: string) => DEL(`/api/departments/${id}`),
  },

  objects: {
    create: (dto: any) => POST('/api/objects', dto),
    update: (id: string, dto: any) => PATCH(`/api/objects/${id}`, dto),
    remove: (id: string) => DEL(`/api/objects/${id}`),
    setAccess: (id: string, userIds: string[]) => PUT(`/api/objects/${id}/access`, { userIds }),
  },

  catalogItems: {
    create: (dto: any) => POST('/api/catalog-items', dto),
    update: (id: string, dto: any) => PATCH(`/api/catalog-items/${id}`, dto),
    remove: (id: string) => DEL(`/api/catalog-items/${id}`),
  },

  ips: {
    create: (dto: any) => POST('/api/ips', dto),
    update: (id: string, dto: any) => PATCH(`/api/ips/${id}`, dto),
    remove: (id: string) => DEL(`/api/ips/${id}`),
  },

  vehicles: {
    create: (name: string) => POST('/api/vehicles', { name }),
    update: (id: string, name: string) => PATCH(`/api/vehicles/${id}`, { name }),
    remove: (id: string) => DEL(`/api/vehicles/${id}`),
  },

  workCatalogs: {
    create: (dto: any) => POST('/api/work-catalogs', dto),
    rename: (id: string, name: string) => PATCH(`/api/work-catalogs/${id}`, { name }),
    remove: (id: string) => DEL(`/api/work-catalogs/${id}`),
    addItem: (id: string, dto: any) => POST(`/api/work-catalogs/${id}/items`, dto),
    updateItem: (id: string, itemId: string, dto: any) => PATCH(`/api/work-catalogs/${id}/items/${itemId}`, dto),
    removeItem: (id: string, itemId: string) => DEL(`/api/work-catalogs/${id}/items/${itemId}`),
    import: (id: string, mode: 'replace' | 'append', items: any[]) =>
      POST(`/api/work-catalogs/${id}/import`, { mode, items }),
  },

  chains: {
    setSupply: (departmentId: string, type: string, steps: { approverId: string; label: string }[]) =>
      PUT(`/api/chains/supply/${departmentId}/${type}`, { steps }),
    setOrder: (departmentId: string, steps: { approverId: string; label: string }[]) =>
      PUT(`/api/chains/order/${departmentId}`, { steps }),
  },

  // ── дельта v59 ──
  requestsX: {
    edit: (id: string, dto: any) => PATCH(`/api/requests/${id}`, dto),
    resubmit: (id: string) => POST(`/api/requests/${id}/resubmit`, {}),
    withdraw: (id: string) => POST(`/api/requests/${id}/withdraw`, {}),
    priority: (id: string, priority: string) => PATCH(`/api/requests/${id}/priority`, { priority }),
    due: (id: string, due: string | null) => PATCH(`/api/requests/${id}/due`, { due }),
    release: (id: string) => POST(`/api/requests/${id}/release`, {}),
    item: (id: string, itemId: string, dto: any) => PATCH(`/api/requests/${id}/items/${itemId}`, dto),
    spent: (id: string, spent: number | null) => PATCH(`/api/requests/${id}/spent`, { spent }),
    consolidate: (ids: string[]) => POST('/api/requests/consolidate', { ids }),
    unconsolidate: (id: string) => POST(`/api/requests/${id}/unconsolidate`, {}),
  },
  ordersX: {
    line: (id: string, lineId: string, dto: any) => PATCH(`/api/orders/${id}/lines/${lineId}`, dto),
    removeLine: (id: string, lineId: string) => DEL(`/api/orders/${id}/lines/${lineId}`),
    resubmit: (id: string) => POST(`/api/orders/${id}/resubmit`, {}),
    upload: (orderId: string, file: File) => {
      const fd = new FormData(); fd.append('file', file);
      return UPLOAD(`/api/files/order/${orderId}`, fd);
    },
  },
  comms: {
    send: (text: string) => POST('/api/comms/messages', { text }),
    messages: () => GET('/api/comms/messages'),
    markRead: (id: string) => PATCH(`/api/comms/messages/${id}/read`, {}),
    anonSend: (text: string) => POST('/api/comms/anon', { text }),
    anonList: () => GET('/api/comms/anon'),
    announcements: () => GET('/api/comms/announcements'),
    addAnnouncement: (text: string) => POST('/api/comms/announcements', { text }),
    delAnnouncement: (id: string) => DEL(`/api/comms/announcements/${id}`),
    pinAnnouncement: (id: string) => PATCH(`/api/comms/announcements/${id}/pin`, {}),
    readAnnouncement: (id: string) => POST(`/api/comms/announcements/${id}/read`, {}),
    events: (from?: string, to?: string) => GET(`/api/comms/events${from ? `?from=${from}&to=${to || ''}` : ''}`),
    addEvent: (date: string, title: string) => POST('/api/comms/events', { date, title }),
    delEvent: (id: string) => DEL(`/api/comms/events/${id}`),
    getDraft: (type: string) => GET(`/api/comms/drafts/${type}`),
    saveDraft: (type: string, payload: any) => POST(`/api/comms/drafts/${type}`, { payload }),
    clearDraft: (type: string) => DEL(`/api/comms/drafts/${type}`),
  },
  settings: {
    get: () => GET('/api/settings'),
    urgentLimit: (n: number) => PATCH('/api/settings/urgent-limit', { urgentLimit: n }),
    logo: (file: File, w?: number, h?: number) => {
      const fd = new FormData(); fd.append('file', file);
      if (w) fd.append('w', String(w)); if (h) fd.append('h', String(h));
      return UPLOAD('/api/settings/logo', fd);
    },
    clearLogo: () => DEL('/api/settings/logo'),
    theme: (theme: string) => PATCH('/api/settings/theme', { theme }),
    avatar: (file: File) => { const fd = new FormData(); fd.append('file', file); return UPLOAD('/api/settings/avatar', fd); },
    avatarUrl: (userId: string) => GET(`/api/settings/avatar/${userId}`),
  },
};
