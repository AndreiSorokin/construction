import { apiClient } from "./api";
import { AuthResponse, User } from "./types";

export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterPayload = LoginPayload & {
  name: string;
};

export type AcceptInvitationPayload = {
  token: string;
  password: string;
};

export function login(payload: LoginPayload) {
  return apiClient<AuthResponse>("/auth/login", {
    method: "POST",
    body: payload,
  });
}

export function register(payload: RegisterPayload) {
  return apiClient<AuthResponse>("/auth/register", {
    method: "POST",
    body: payload,
  });
}

export function acceptInvitation(payload: AcceptInvitationPayload) {
  return apiClient<AuthResponse>("/auth/accept-invitation", {
    method: "POST",
    body: payload,
  });
}

export function getCurrentUser() {
  return apiClient<User>("/auth/me");
}

export function updateCurrentUserName(name: string) {
  return apiClient<User>("/auth/me", {
    method: "PATCH",
    body: { name },
  });
}

export function logout() {
  return apiClient<{ success: boolean }>("/auth/logout", {
    method: "POST",
    body: {},
  });
}
