import { API_URL } from "./config";
import {
  clearAuthSession,
  getAccessToken,
  getRefreshToken,
  saveAuthSession,
} from "./auth-storage";
import { ApiErrorBody, AuthResponse } from "./types";

type ApiOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  accessToken?: string;
};

export class ApiError extends Error {
  status: number;
  body: ApiErrorBody | null;

  constructor(status: number, body: ApiErrorBody | null) {
    const message = Array.isArray(body?.message)
      ? body.message.join(", ")
      : body?.message;

    super(message ?? body?.error ?? `HTTP ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

let refreshAuthSessionPromise: Promise<AuthResponse | null> | null = null;

export async function apiClient<T>(path: string, options: ApiOptions = {}) {
  return handleResponse<T>(await authorizedFetch(path, options));
}

export async function authorizedFetch(path: string, options: ApiOptions = {}) {
  const token = options.accessToken ?? getAccessToken();
  const response = await request(path, options, token);

  if (response.status === 401 && path !== "/auth/refresh") {
    const refreshed = await refreshAuthSession();

    if (refreshed) {
      return request(path, options, refreshed.accessToken);
    }
  }

  return response;
}

function request(path: string, options: ApiOptions, token?: string | null) {
  const body = options.body;
  const isFormData = body instanceof FormData;

  return fetch(`${API_URL}${path}`, {
    ...options,
    body:
      body === undefined
        ? undefined
        : isFormData
          ? body
          : JSON.stringify(body),
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
}

async function handleResponse<T>(response: Response) {
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(response.status, body);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function refreshAuthSession() {
  if (refreshAuthSessionPromise) {
    return refreshAuthSessionPromise;
  }

  refreshAuthSessionPromise = refreshAuthSessionOnce().finally(() => {
    refreshAuthSessionPromise = null;
  });

  return refreshAuthSessionPromise;
}

async function refreshAuthSessionOnce() {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    return null;
  }

  let response: Response;

  try {
    response = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    // Network hiccup - keep the existing session, the next request can retry.
    return null;
  }

  if (response.ok) {
    const auth = (await response.json()) as AuthResponse;
    saveAuthSession(auth);
    return auth;
  }

  // Only wipe the session on a confirmed invalid token, and only if no other
  // tab already rotated it while this request was in flight.
  if (response.status === 401 && getRefreshToken() === refreshToken) {
    clearAuthSession();
  }

  return null;
}
