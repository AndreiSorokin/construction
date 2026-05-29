import { apiClient } from "./api";
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

export function updateObjectName(id: string, name: string) {
  return apiClient<ObjectEntity>(`/objects/${id}`, {
    method: "PATCH",
    body: { name },
  });
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

export function updateObjectUserRole(
  objectId: string,
  userId: string,
  role: UserRole,
) {
  return apiClient<UserObjectAccess>(`/objects/${objectId}/access/${userId}`, {
    method: "PATCH",
    body: { role },
  });
}

export function deleteObjectUserAccess(objectId: string, userId: string) {
  return apiClient<{ deleted: boolean }>(`/objects/${objectId}/access/${userId}`, {
    method: "DELETE",
  });
}

export type CopyObjectAccessMode = "OVERWRITE_ROLES" | "SKIP_EXISTING";

export function copyObjectAccesses(
  targetObjectId: string,
  payload: {
    mode: CopyObjectAccessMode;
    sourceObjectId: string;
  },
) {
  return apiClient<{
    created: number;
    skipped: number;
    updated: number;
    sourceObjectId: string;
    targetObjectId: string;
  }>(`/objects/${targetObjectId}/access/copy`, {
    method: "POST",
    body: payload,
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
    mail?: { sent?: boolean; error?: string };
  }>(`/objects/${objectId}/invitations`, {
    method: "POST",
    body: payload,
  });
}
