import { apiClient } from "./api";
import { getAccessToken } from "./auth-storage";
import { API_URL } from "./config";
import {
  MoneyRequestPaymentType,
  SupplyRequest,
  SupplyRequestStatus,
  SupplyRequestType,
} from "./types";

export type CreateMaterialSupplyRequestPayload = {
  objectId: string;
  items: Array<{
    materialName: string;
    measurementUnit: string;
    quantity: string;
  }>;
};

export function createMaterialSupplyRequest(
  payload: CreateMaterialSupplyRequestPayload,
) {
  return apiClient<SupplyRequest>("/supply-requests/materials", {
    method: "POST",
    body: payload,
  });
}

export function createQuarrySupplyRequest(
  payload: CreateMaterialSupplyRequestPayload,
) {
  return apiClient<SupplyRequest>("/supply-requests/quarry", {
    method: "POST",
    body: payload,
  });
}

export type CreateExpressMaterialSupplyRequestPayload =
  CreateMaterialSupplyRequestPayload & {
    comment: string;
    files: File[];
  };

export function createExpressMaterialSupplyRequest(
  payload: CreateExpressMaterialSupplyRequestPayload,
) {
  const form = new FormData();

  form.append("objectId", payload.objectId);
  form.append("comment", payload.comment);
  form.append("items", JSON.stringify(payload.items));

  for (const file of payload.files) {
    form.append("files", file);
  }

  return apiClient<SupplyRequest>("/supply-requests/express-material", {
    method: "POST",
    body: form,
  });
}

export type CreateTransportSupplyRequestPayload = {
  objectId: string;
  transportObjectName: string;
  transportDate: string;
  transportTime: string;
  transportType: string;
  purpose: string;
};

export function createTransportSupplyRequest(
  payload: CreateTransportSupplyRequestPayload,
) {
  return apiClient<SupplyRequest>("/supply-requests/transport", {
    method: "POST",
    body: payload,
  });
}

export type CreateFuelSupplyRequestPayload = {
  fuelType: string;
  objectId: string;
  purpose: string;
};

export function createFuelSupplyRequest(payload: CreateFuelSupplyRequestPayload) {
  return apiClient<SupplyRequest>("/supply-requests/fuel", {
    method: "POST",
    body: payload,
  });
}

export type CreateBusinessTripSupplyRequestPayload = {
  amount: string;
  objectId: string;
  purpose: string;
};

export function createBusinessTripSupplyRequest(
  payload: CreateBusinessTripSupplyRequestPayload,
) {
  return apiClient<SupplyRequest>("/supply-requests/business-trip", {
    method: "POST",
    body: payload,
  });
}

export type CreateAppealSupplyRequestPayload = {
  objectId: string;
  text: string;
};

export function createAppealSupplyRequest(
  payload: CreateAppealSupplyRequestPayload,
) {
  return apiClient<SupplyRequest>("/supply-requests/appeal", {
    method: "POST",
    body: payload,
  });
}

export type CreateMoneySupplyRequestPayload = {
  objectId: string;
  amount: string;
  paymentType: MoneyRequestPaymentType;
  paymentPurpose: string;
};

export function createMoneySupplyRequest(
  payload: CreateMoneySupplyRequestPayload,
) {
  return apiClient<SupplyRequest>("/supply-requests/money", {
    method: "POST",
    body: payload,
  });
}

export type CreateProductionSupplyRequestPayload = {
  files?: File[];
  objectId: string;
  purpose: string;
};

export function createProductionSupplyRequest(
  payload: CreateProductionSupplyRequestPayload,
) {
  const form = new FormData();

  form.append("objectId", payload.objectId);
  form.append("purpose", payload.purpose);

  for (const file of payload.files ?? []) {
    form.append("files", file);
  }

  return apiClient<SupplyRequest>("/supply-requests/production", {
    method: "POST",
    body: form,
  });
}

export function getSupplyRequests() {
  return apiClient<SupplyRequest[]>("/supply-requests");
}

export function getSupplyRequest(id: string) {
  return apiClient<SupplyRequest>(`/supply-requests/${id}`);
}

export type SupplyRequestsPage = {
  items: SupplyRequest[];
  limit: number;
  page: number;
  total: number;
  totalPages: number;
};

export type GetSupplyRequestsPageParams = {
  objectSearch?: string;
  type?: SupplyRequestType | "ALL";
  status?: SupplyRequestStatus | "ALL";
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
};

export async function getSupplyRequestsPage(
  params: GetSupplyRequestsPageParams,
) {
  const searchParams = new URLSearchParams();

  searchParams.set("page", String(params.page ?? 1));
  searchParams.set("limit", String(params.limit ?? 10));

  if (params.objectSearch?.trim()) {
    searchParams.set("objectSearch", params.objectSearch.trim());
  }

  if (params.type && params.type !== "ALL") {
    searchParams.set("type", params.type);
  }

  if (params.status && params.status !== "ALL") {
    searchParams.set("status", params.status);
  }

  if (params.dateFrom) {
    searchParams.set("dateFrom", params.dateFrom);
  }

  if (params.dateTo) {
    searchParams.set("dateTo", params.dateTo);
  }

  const response = await apiClient<SupplyRequestsPage | SupplyRequest[]>(
    `/supply-requests?${searchParams.toString()}`,
  );

  if (Array.isArray(response)) {
    const page = params.page ?? 1;
    const limit = params.limit ?? 10;
    const start = (page - 1) * limit;
    const items = response.slice(start, start + limit);

    return {
      items,
      limit,
      page,
      total: response.length,
      totalPages: Math.max(Math.ceil(response.length / limit), 1),
    };
  }

  return {
    items: Array.isArray(response.items) ? response.items : [],
    limit: response.limit,
    page: response.page,
    total: response.total,
    totalPages: response.totalPages,
  };
}

export function setPtoLimitPrices(
  requestId: string,
  payload: {
    comment?: string;
    items: Array<{
      requestItemId: string;
      ptoLimitPrice: string;
    }>;
  },
) {
  return apiClient<SupplyRequest>(
    `/supply-requests/${requestId}/pto-limit-prices`,
    {
      method: "PATCH",
      body: payload,
    },
  );
}

export function approveSupplyRequestByPto(
  requestId: string,
  comment?: string,
) {
  return apiClient<SupplyRequest>(`/supply-requests/${requestId}/pto/approve`, {
    method: "PATCH",
    body: { comment },
  });
}

export function updateSupplyRequestItem(
  requestId: string,
  itemId: string,
  payload: {
    quantity?: string;
    orderQuantity?: string;
    stockQuantity?: string;
    cashPaidAmount?: string;
    cashPaymentComment?: string;
    comment?: string;
  },
) {
  return apiClient<SupplyRequest>(
    `/supply-requests/${requestId}/items/${itemId}`,
    {
      method: "PATCH",
      body: payload,
    },
  );
}

export function deleteSupplyRequestItem(
  requestId: string,
  itemId: string,
  comment?: string,
) {
  return apiClient<SupplyRequest>(
    `/supply-requests/${requestId}/items/${itemId}/delete`,
    {
      method: "PATCH",
      body: { comment },
    },
  );
}

export function rejectSupplyRequestToPreviousStep(
  requestId: string,
  comment?: string,
) {
  return apiClient<SupplyRequest>(
    `/supply-requests/${requestId}/reject-to-previous`,
    {
      method: "PATCH",
      body: { comment },
    },
  );
}

export function approveSupplyRequestByChiefEngineer(
  requestId: string,
  comment?: string,
) {
  return apiClient<SupplyRequest>(
    `/supply-requests/${requestId}/chief-engineer/approve`,
    {
      method: "PATCH",
      body: { comment },
    },
  );
}

export function approveSupplyRequestByWarehouseManager(
  requestId: string,
  comment?: string,
) {
  return apiClient<SupplyRequest>(
    `/supply-requests/${requestId}/warehouse-manager/approve`,
    {
      method: "PATCH",
      body: { comment },
    },
  );
}

export function returnSupplyRequestToPtoByChiefEngineer(
  requestId: string,
  comment: string,
) {
  return apiClient<SupplyRequest>(
    `/supply-requests/${requestId}/chief-engineer/return-to-pto`,
    {
      method: "PATCH",
      body: { comment },
    },
  );
}

export function rejectSupplyRequestByChiefEngineer(
  requestId: string,
  comment: string,
) {
  return apiClient<SupplyRequest>(
    `/supply-requests/${requestId}/chief-engineer/reject`,
    {
      method: "PATCH",
      body: { comment },
    },
  );
}

export function approveSupplyRequestByDeputyProductionDirector(
  requestId: string,
  comment?: string,
) {
  return apiClient<SupplyRequest>(
    `/supply-requests/${requestId}/deputy-production-director/approve`,
    {
      method: "PATCH",
      body: { comment },
    },
  );
}

export function assignWorkshopManager(
  requestId: string,
  payload: {
    workshopManagerId: string;
    comment?: string;
  },
) {
  return apiClient<SupplyRequest>(
    `/supply-requests/${requestId}/deputy-production-director/assign-workshop`,
    {
      method: "PATCH",
      body: payload,
    },
  );
}

export function rejectSupplyRequestByDeputyProductionDirector(
  requestId: string,
  comment?: string,
) {
  return apiClient<SupplyRequest>(
    `/supply-requests/${requestId}/deputy-production-director/reject`,
    {
      method: "PATCH",
      body: { comment },
    },
  );
}

export function approveSupplyRequestByDeputyTransportDirector(
  requestId: string,
  comment?: string,
) {
  return apiClient<SupplyRequest>(
    `/supply-requests/${requestId}/deputy-transport-director/approve`,
    {
      method: "PATCH",
      body: { comment },
    },
  );
}

export function approveSupplyRequestByAccountant(
  requestId: string,
  comment?: string,
) {
  return apiClient<SupplyRequest>(
    `/supply-requests/${requestId}/accountant/approve`,
    {
      method: "PATCH",
      body: { comment },
    },
  );
}

export function rejectSupplyRequestByDeputyTransportDirector(
  requestId: string,
  comment?: string,
) {
  return apiClient<SupplyRequest>(
    `/supply-requests/${requestId}/deputy-transport-director/reject`,
    {
      method: "PATCH",
      body: { comment },
    },
  );
}

export function attachInvoicesAndSendToDirector(
  requestId: string,
  payload: {
    files: File[];
    comment?: string;
  },
) {
  const form = new FormData();

  for (const file of payload.files) {
    form.append("files", file);
  }

  if (payload.comment) {
    form.append("comment", payload.comment);
  }

  return apiClient<SupplyRequest>(
    `/supply-requests/${requestId}/invoices/send-to-director`,
    {
      method: "PATCH",
      body: form,
    },
  );
}

export function sendMoneyRequestToDirector(
  requestId: string,
  comment?: string,
) {
  return apiClient<SupplyRequest>(
    `/supply-requests/${requestId}/money/send-to-director`,
    {
      method: "PATCH",
      body: { comment },
    },
  );
}

export function approveSupplyRequestBySupply(
  requestId: string,
  comment?: string,
) {
  return apiClient<SupplyRequest>(`/supply-requests/${requestId}/supply/approve`, {
    method: "PATCH",
    body: { comment },
  });
}

export function assignSupplyRequest(
  requestId: string,
  payload: {
    supplyUserId: string;
    comment?: string;
  },
) {
  return apiClient<SupplyRequest>(
    `/supply-requests/${requestId}/supply-manager/assign`,
    {
      method: "PATCH",
      body: payload,
    },
  );
}

export function sendTransportToGarageManager(
  requestId: string,
  comment?: string,
) {
  return apiClient<SupplyRequest>(
    `/supply-requests/${requestId}/supply-manager/send-to-garage`,
    {
      method: "PATCH",
      body: { comment },
    },
  );
}

export function sendMaterialToDirectorBySupplyManager(
  requestId: string,
  comment?: string,
) {
  return apiClient<SupplyRequest>(
    `/supply-requests/${requestId}/supply-manager/send-to-director`,
    {
      method: "PATCH",
      body: { comment },
    },
  );
}

export function completeTransportByGarageManager(
  requestId: string,
  comment?: string,
) {
  return apiClient<SupplyRequest>(
    `/supply-requests/${requestId}/garage-manager/complete`,
    {
      method: "PATCH",
      body: { comment },
    },
  );
}

export function completeTransportByAuthor(
  requestId: string,
  comment?: string,
) {
  return apiClient<SupplyRequest>(
    `/supply-requests/${requestId}/transport/author/complete`,
    {
      method: "PATCH",
      body: { comment },
    },
  );
}

export function approveSupplyRequestByWorkshopManager(
  requestId: string,
  comment?: string,
) {
  return apiClient<SupplyRequest>(
    `/supply-requests/${requestId}/workshop-manager/approve`,
    {
      method: "PATCH",
      body: { comment },
    },
  );
}

export function completeProductionByAuthor(
  requestId: string,
  comment?: string,
) {
  return apiClient<SupplyRequest>(
    `/supply-requests/${requestId}/production/author/complete`,
    {
      method: "PATCH",
      body: { comment },
    },
  );
}

export function approveSupplyRequestByDirector(
  requestId: string,
  comment?: string,
) {
  return apiClient<SupplyRequest>(
    `/supply-requests/${requestId}/director/approve`,
    {
      method: "PATCH",
      body: { comment },
    },
  );
}

export function rejectSupplyRequestByDirector(
  requestId: string,
  comment?: string,
) {
  return apiClient<SupplyRequest>(
    `/supply-requests/${requestId}/director/reject`,
    {
      method: "PATCH",
      body: { comment },
    },
  );
}

export function archiveSupplyRequestByDirector(
  requestId: string,
  comment?: string,
) {
  return apiClient<SupplyRequest>(
    `/supply-requests/${requestId}/director/archive`,
    {
      method: "PATCH",
      body: { comment },
    },
  );
}

export function deleteSupplyRequestByDirector(requestId: string) {
  return apiClient<{ success: boolean }>(
    `/supply-requests/${requestId}/director`,
    {
      method: "DELETE",
    },
  );
}

export function returnSupplyRequestToSupplyByDirector(
  requestId: string,
  comment?: string,
) {
  return apiClient<SupplyRequest>(
    `/supply-requests/${requestId}/director/return`,
    {
      method: "PATCH",
      body: { comment },
    },
  );
}

export function completeSupplyRequest(
  requestId: string,
  payload: {
    comment?: string;
    storekeeperUserId: string;
  },
) {
  return apiClient<SupplyRequest>(`/supply-requests/${requestId}/complete`, {
    method: "PATCH",
    body: payload,
  });
}

export function completeSupplyRequestByStorekeeper(
  requestId: string,
  payload: {
    comment?: string;
    completedItemIds: string[];
  },
) {
  return apiClient<SupplyRequest>(
    `/supply-requests/${requestId}/storekeeper/complete`,
    {
      method: "PATCH",
      body: payload,
    },
  );
}

export function approveTransportBySupply(requestId: string, comment?: string) {
  return apiClient<SupplyRequest>(
    `/supply-requests/${requestId}/transport/supply/approve`,
    {
      method: "PATCH",
      body: { comment },
    },
  );
}

export function approveQuarryBySupply(requestId: string, comment?: string) {
  return apiClient<SupplyRequest>(
    `/supply-requests/${requestId}/quarry/supply/approve`,
    {
      method: "PATCH",
      body: { comment },
    },
  );
}

export function completeQuarryByAuthor(requestId: string, comment?: string) {
  return apiClient<SupplyRequest>(
    `/supply-requests/${requestId}/quarry/author/complete`,
    {
      method: "PATCH",
      body: { comment },
    },
  );
}

export function completeExpressMaterialByAuthor(
  requestId: string,
  comment?: string,
) {
  return apiClient<SupplyRequest>(
    `/supply-requests/${requestId}/express-material/author/complete`,
    {
      method: "PATCH",
      body: { comment },
    },
  );
}

export function completeBusinessTripByAuthor(
  requestId: string,
  comment?: string,
) {
  return apiClient<SupplyRequest>(
    `/supply-requests/${requestId}/business-trip/author/complete`,
    {
      method: "PATCH",
      body: { comment },
    },
  );
}

export async function downloadSupplyRequestInvoice(
  requestId: string,
  invoiceId: string,
  fileName: string,
) {
  const token = getAccessToken();
  const response = await fetch(
    `${API_URL}/supply-requests/${requestId}/invoices/${invoiceId}/download`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  );

  if (!response.ok) {
    throw new Error("Не удалось скачать счет");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export async function getSupplyRequestInvoicePreview(
  requestId: string,
  invoiceId: string,
) {
  const token = getAccessToken();
  const response = await fetch(
    `${API_URL}/supply-requests/${requestId}/invoices/${invoiceId}/download`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  );

  if (!response.ok) {
    throw new Error("Не удалось открыть счет");
  }

  const blob = await response.blob();

  return {
    contentType: response.headers.get("Content-Type") ?? blob.type,
    url: URL.createObjectURL(blob),
  };
}

export async function downloadSupplyRequestAttachment(
  requestId: string,
  attachmentId: string,
  fileName: string,
) {
  const token = getAccessToken();
  const response = await fetch(
    `${API_URL}/supply-requests/${requestId}/attachments/${attachmentId}/download`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  );

  if (!response.ok) {
    throw new Error("Не удалось скачать файл");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export async function getSupplyRequestAttachmentPreview(
  requestId: string,
  attachmentId: string,
) {
  const token = getAccessToken();
  const response = await fetch(
    `${API_URL}/supply-requests/${requestId}/attachments/${attachmentId}/download`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  );

  if (!response.ok) {
    throw new Error("Не удалось открыть файл");
  }

  const blob = await response.blob();

  return {
    contentType: response.headers.get("Content-Type") ?? blob.type,
    url: URL.createObjectURL(blob),
  };
}

export function deleteSupplyRequestInvoice(
  requestId: string,
  invoiceId: string,
) {
  return apiClient<SupplyRequest>(
    `/supply-requests/${requestId}/invoices/${invoiceId}`,
    {
      method: "DELETE",
    },
  );
}
