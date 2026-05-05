import { apiClient } from "./api";
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
