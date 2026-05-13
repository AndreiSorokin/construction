"use client";

import { RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { MaterialItemsStatusList } from "@/components/dashboard/material-items-status-list";
import { RequestSummaryCard } from "@/components/dashboard/request-summary-card";
import {
  ObjectApprovalGroup,
  ObjectRequestGroup,
} from "@/components/dashboard/supply-request-approval-cards";
import { useErrorMessage } from "@/hooks/use-error-message";
import { getSupplyRequests } from "@/lib/supply-requests-api";
import { SupplyRequest } from "@/lib/types";

type RequestsBankPanelProps = {
  onError?: (error: unknown) => void;
};

export function RequestsBankPanel({ onError }: RequestsBankPanelProps) {
  const [requests, setRequests] = useState<SupplyRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { errorMessage, showError, clearError } = useErrorMessage();
  const requestGroups = groupRequestsByObject(requests);

  useEffect(() => {
    void loadRequests();
  }, []);

  async function loadRequests() {
    setIsLoading(true);
    clearError();

    try {
      setRequests(await getSupplyRequests());
    } catch (error) {
      if (onError) {
        onError(error);
      } else {
        showError(error);
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-950">Банк заявок</h2>
          <p className="mt-1 text-sm text-slate-500">
            Общий список заявок с текущими статусами, ответственными и деталями.
          </p>
        </div>
        <button
          className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          onClick={() => void loadRequests()}
          type="button"
        >
          <RefreshCcw size={16} />
          Обновить
        </button>
      </div>

      {errorMessage ? (
        <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3">
        {requestGroups.map((group) => (
          <ObjectApprovalGroup group={group} key={group.objectId}>
            {group.requests.map((request) => (
              <RequestSummaryCard key={request.id} request={request}>
                <RequestDetails request={request} />
              </RequestSummaryCard>
            ))}
          </ObjectApprovalGroup>
        ))}

        {!isLoading && !requests.length ? (
          <div className="rounded-md border border-dashed border-slate-300 p-6 text-sm text-slate-500">
            Пока нет заявок.
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-md border border-dashed border-slate-300 p-6 text-sm text-slate-500">
            Загружаем заявки...
          </div>
        ) : null}
      </div>
    </section>
  );
}

function RequestDetails({ request }: { request: SupplyRequest }) {
  return (
    <div className="grid gap-3 text-sm">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Info label="Автор" value={request.author?.name ?? request.authorId} />
        <Info
          label="Снабженец"
          value={
            request.assignedSupplyUser?.name ??
            request.assignedSupplyUser?.email ??
            "-"
          }
        />
        <Info label={getDetailLabel(request)} value={getDetailValue(request)} />
        <Info
          label="Счета"
          value={request.invoices?.length ? `${request.invoices.length} шт.` : "-"}
        />
        {request.type === "MONEY" ? (
          <Info
            label="Назначение платежа"
            value={request.paymentPurpose ?? "-"}
          />
        ) : null}
        {request.type === "TRANSPORT" ? (
          <Info label="Назначение техники" value={request.purpose ?? "-"} />
        ) : null}
      </div>
      <MaterialItemsStatusList request={request} />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md bg-slate-50 p-3">
      <div className="text-slate-500">{label}</div>
      <div className="mt-1 break-words font-medium text-slate-950">{value}</div>
    </div>
  );
}

function getDetailLabel(request: SupplyRequest) {
  if (request.type === "MONEY") {
    return "Сумма";
  }

  if (request.type === "TRANSPORT") {
    return "Вид техники";
  }

  return "Материалы";
}

function getDetailValue(request: SupplyRequest) {
  if (request.type === "TRANSPORT") {
    return request.transportType ?? "Транспорт";
  }

  if (request.type === "MONEY") {
    return formatMoney(toNumber(request.amount));
  }

  const itemsCount = request.items.length;
  const totalQuantity = request.items.reduce(
    (total, item) => total + toNumber(item.quantity),
    0,
  );

  return `${itemsCount} поз., ${totalQuantity.toLocaleString("ru-KZ")} ед.`;
}

function groupRequestsByObject(requests: SupplyRequest[]): ObjectRequestGroup[] {
  const groups = new Map<string, ObjectRequestGroup>();

  requests.forEach((request) => {
    const currentGroup = groups.get(request.objectId);
    const positionsCount = getRequestPositionsCount(request);

    if (currentGroup) {
      currentGroup.positionsCount += positionsCount;
      currentGroup.requests.push(request);
      return;
    }

    groups.set(request.objectId, {
      objectId: request.objectId,
      objectName: request.object?.name ?? request.objectId,
      positionsCount,
      requests: [request],
    });
  });

  return Array.from(groups.values());
}

function getRequestPositionsCount(request: SupplyRequest) {
  return request.type === "MATERIAL" ? request.items.length : 1;
}

function toNumber(value: string | number | null | undefined) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatMoney(value: number) {
  return `${value.toLocaleString("ru-KZ")} тг`;
}
