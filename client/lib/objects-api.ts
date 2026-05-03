import { apiClient } from "./api";
import { getAccessToken } from "./auth-storage";
import { API_URL } from "./config";
import {
  ObjectEntity,
  ObjectMaterial,
  UserObjectAccess,
  UserRole,
} from "./types";

export function getMyObjects() {
  return apiClient<UserObjectAccess[]>("/objects/access/mine");
}

export function getObject(id: string) {
  return apiClient<ObjectEntity>(`/objects/${id}`);
}

export type CreateObjectMaterialPayload = {
  name: string;
  type: string;
  measurementUnit: string;
  estimatedPrice: string;
};

export type UpdateObjectMaterialPayload =
  Partial<CreateObjectMaterialPayload>;

export function createObjectMaterial(
  objectId: string,
  payload: CreateObjectMaterialPayload,
) {
  return apiClient<ObjectMaterial>(`/objects/${objectId}/materials`, {
    method: "POST",
    body: payload,
  });
}

export function updateObjectMaterial(
  objectId: string,
  materialId: string,
  payload: UpdateObjectMaterialPayload,
) {
  return apiClient<ObjectMaterial>(
    `/objects/${objectId}/materials/${materialId}`,
    {
      method: "PATCH",
      body: payload,
    },
  );
}

export function deleteObjectMaterial(objectId: string, materialId: string) {
  return apiClient<{ deleted: boolean; message?: string }>(
    `/objects/${objectId}/materials/${materialId}`,
    {
      method: "DELETE",
    },
  );
}

export function deleteObject(id: string) {
  return apiClient<{ success: boolean }>(`/objects/${id}`, {
    method: "DELETE",
  });
}

export type InviteObjectUserPayload = {
  email: string;
  name: string;
  userRole: UserRole;
};

export function inviteObjectUser(
  objectId: string,
  payload: InviteObjectUserPayload,
) {
  return apiClient<{
    type?: string;
    inviteLink?: string;
    mail?: { sent?: boolean };
  }>(`/objects/${objectId}/invitations`, {
    method: "POST",
    body: payload,
  });
}

export async function downloadMaterialsTemplate() {
  const response = await fetch(`${API_URL}/objects/materials/template`, {
    headers: {
      ...(getAccessToken()
        ? { Authorization: `Bearer ${getAccessToken()}` }
        : {}),
    },
  });

  if (!response.ok) {
    throw new Error("Не удалось скачать шаблон");
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "materials-template.xlsx";
  link.click();
  window.URL.revokeObjectURL(url);
}

export async function importObjectMaterials(objectId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_URL}/objects/${objectId}/materials/import`, {
    method: "POST",
    headers: {
      ...(getAccessToken()
        ? { Authorization: `Bearer ${getAccessToken()}` }
        : {}),
    },
    body: formData,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join(", ")
      : body?.message;

    throw new Error(message ?? "Не удалось импортировать материалы");
  }

  return response.json() as Promise<{
    imported: number;
    skipped: number;
  }>;
}
