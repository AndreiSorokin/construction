/**
 * Клиентская защита от ГОНКИ refresh-токенов (несколько вкладок / target=_blank).
 *
 * Три уровня single-flight:
 *   1) В рамках вкладки — общий promise `inflight` (параллельные вызовы ждут один запрос).
 *   2) Между вкладками — Web Locks API (`navigator.locks`): обновляет ровно ОДНА вкладка,
 *      остальные ждут; зайдя под лок, они видят уже свежий токен и в сеть не идут.
 *   3) BroadcastChannel — выигравшая вкладка рассылает новый access-токен остальным,
 *      поэтому им не нужен собственный запрос к /auth/refresh.
 *
 * Refresh-токен живёт в httpOnly-cookie (JS его не читает) и отправляется автоматически
 * с `credentials: 'include'`. В памяти держим только access-токен.
 *
 * На бэке дополнительно есть grace-окно ротации (см. token.service.ts), поэтому даже
 * если два запроса всё же уйдут одновременно — оба получат валидную пару, без разлогина.
 */

const CHANNEL = 'interstroy-auth';
const LOCK = 'interstroy-refresh';

let accessToken: string | null = null;
let inflight: Promise<string | null> | null = null;

const bc =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel(CHANNEL)
    : null;

bc?.addEventListener('message', (e: MessageEvent) => {
  if (e.data?.type === 'token') accessToken = e.data.accessToken;
  else if (e.data?.type === 'logout') accessToken = null;
});

export function getAccessToken(): string | null {
  return accessToken;
}
export function setAccessToken(t: string | null) {
  accessToken = t;
  if (t) bc?.postMessage({ type: 'token', accessToken: t });
}

function expOf(jwt: string | null): number {
  if (!jwt) return 0;
  try {
    const payload = JSON.parse(
      atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
    );
    return (payload.exp || 0) * 1000;
  } catch {
    return 0;
  }
}

/** свежий ли access-токен (с запасом по времени) */
export function isAccessFresh(skewMs = 30_000): boolean {
  return expOf(accessToken) - Date.now() > skewMs;
}

async function doRefresh(apiBase: string): Promise<string | null> {
  const r = await fetch(apiBase + '/api/auth/refresh', {
    method: 'POST',
    credentials: 'include',
  });
  if (!r.ok) {
    accessToken = null;
    bc?.postMessage({ type: 'logout' });
    return null;
  }
  const data = await r.json();
  setAccessToken(data.accessToken);
  return data.accessToken;
}

export function refresh(apiBase: string): Promise<string | null> {
  if (inflight) return inflight; // single-flight в этой вкладке
  inflight = (async () => {
    try {
      const locks = (typeof navigator !== 'undefined' && (navigator as any).locks) || null;
      if (locks?.request) {
        // single-flight между вкладками
        return await locks.request(LOCK, async () => {
          if (isAccessFresh()) return accessToken; // другая вкладка уже обновила
          return doRefresh(apiBase);
        });
      }
      // запасной путь (старые браузеры без Web Locks)
      if (isAccessFresh()) return accessToken;
      return await doRefresh(apiBase);
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function clearAuth() {
  accessToken = null;
  bc?.postMessage({ type: 'logout' });
}
