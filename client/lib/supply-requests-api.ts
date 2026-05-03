import { apiClient } from "./api";
import { SupplyRequest } from "./types";

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
