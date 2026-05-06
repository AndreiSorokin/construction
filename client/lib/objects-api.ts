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
