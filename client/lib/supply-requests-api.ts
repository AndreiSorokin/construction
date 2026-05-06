import { apiClient } from "./api";
import { getAccessToken } from "./auth-storage";
import { API_URL } from "./config";
import { SupplyRequest, SupplyRequestStatus, SupplyRequestType } from "./types";

export type CreateMaterialSupplyRequestPayload = {
  objectId: string;
  items: Array<{
    objectMaterialId: string;
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

export type CreateTransportSupplyRequestPayload = {
  objectId: string;
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

export function getSupplyRequests() {
  return apiClient<SupplyRequest[]>("/supply-requests");
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

export function updateSupplyRequestItem(
  requestId: string,
  itemId: string,
  payload: {
    quantity: string;
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

export function setSupplierPurchasePrices(
  requestId: string,
  payload: {
    comment?: string;
    items: Array<{
      requestItemId: string;
      supplierPurchasePrice: string;
    }>;
  },
) {
  return apiClient<SupplyRequest>(
    `/supply-requests/${requestId}/supplier-purchase-prices`,
    {
      method: "PATCH",
      body: payload,
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

export function completeSupplyRequest(requestId: string, comment?: string) {
  return apiClient<SupplyRequest>(`/supply-requests/${requestId}/complete`, {
    method: "PATCH",
    body: { comment },
  });
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
