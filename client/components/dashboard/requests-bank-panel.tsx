"use client";

import { RefreshCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { MaterialItemsStatusList } from "@/components/dashboard/material-items-status-list";
import { RequestSummaryCard } from "@/components/dashboard/request-summary-card";
import {
  ObjectApprovalGroup,
  ObjectRequestGroup,
} from "@/components/dashboard/supply-request-approval-cards";
import { NotificationToasts } from "@/components/ui/notification-toasts";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useSuccessMessage } from "@/hooks/use-success-message";
import { getCurrentUser } from "@/lib/auth-api";
import {
  deleteSupplyRequestByDirector,
  getSupplyRequests,
} from "@/lib/supply-requests-api";
import { SupplyRequest, User } from "@/lib/types";

type RequestsBankPanelProps = {
  onError?: (error: unknown) => void;
};

export function RequestsBankPanel({ onError }: RequestsBankPanelProps) {
  const [requests, setRequests] = useState<SupplyRequest[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { errorMessage, showError, clearError } = useErrorMessage();
  const { successMessage, showSuccess, clearSuccess } = useSuccessMessage();
  const activeRequests = requests.filter(
    (request) =>
      request.status !== "COMPLETED" && request.status !== "ARCHIVED",
  );
  const requestGroups = groupRequestsByObject(activeRequests);

  useEffect(() => {
    void loadRequests();
  }, []);

  async function loadRequests() {
    setIsLoading(true);
    clearError();

    try {
      const [nextRequests, currentUser] = await Promise.all([
        getSupplyRequests(),
        getCurrentUser(),
      ]);
      setRequests(nextRequests);
      setUser(currentUser);
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

  async function deleteRequest(request: SupplyRequest) {
    const confirmed = window.confirm(
      `Удалить заявку ${request.requestNumber} навсегда? Она исчезнет из банка, исполненных заявок и истории.`,
    );

    if (!confirmed) {
      return;
    }

    clearError();
    clearSuccess();

    try {
      await deleteSupplyRequestByDirector(request.id);
      showSuccess(`Заявка ${request.requestNumber} удалена`);
      await loadRequests();
    } catch (error) {
      if (onError) {
        onError(error);
      } else {
        showError(error);
      }
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <NotificationToasts
        errorMessage={errorMessage}
        successMessage={successMessage}
        onClearError={clearError}
        onClearSuccess={clearSuccess}
      />
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

      <div className="mt-4 grid gap-3">
        {requestGroups.map((group) => (
          <ObjectApprovalGroup group={group} key={group.objectId}>
            {group.requests.map((request) => (
              <RequestSummaryCard key={request.id} request={request}>
                <RequestDetails request={request} />
                {canDeleteRequest(user, request) ? (
                  <div className="mt-4 flex justify-end">
                    <button
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-red-200 bg-white px-3 text-sm font-medium text-red-700 hover:bg-red-50"
                      onClick={() => void deleteRequest(request)}
                      type="button"
                    >
                      <Trash2 size={16} />
                      Удалить
                    </button>
                  </div>
                ) : null}
              </RequestSummaryCard>
            ))}
          </ObjectApprovalGroup>
        ))}

        {!isLoading && !activeRequests.length ? (
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
          <>
            <Info label="Тип оплаты" value={formatPaymentType(request.paymentType)} />
            <Info
              label="Назначение платежа"
              value={request.paymentPurpose ?? "-"}
            />
          </>
        ) : null}
        {request.type === "BUSINESS_TRIP" ? (
          <Info
            label="Назначение командировки"
            value={request.paymentPurpose ?? "-"}
          />
        ) : null}
        {(request.type === "TRANSPORT" || request.type === "FUEL") ? (
          <Info label="Назначение техники" value={request.purpose ?? "-"} />
        ) : null}
        {request.type === "PRODUCTION" ? (
          <Info label="Задача на производство" value={request.purpose ?? "-"} />
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
  if (request.type === "BUSINESS_TRIP") {
    return "Сумма командировочных";
  }

  if (request.type === "MONEY") {
    return "Сумма";
  }

  if (request.type === "TRANSPORT") {
    return "Вид техники";
  }

  if (request.type === "FUEL") {
    return "Тип топлива";
  }

  if (request.type === "QUARRY") {
    return "Карьер";
  }

  if (request.type === "PRODUCTION") {
    return "Производство";
  }

  return "ТМЦ";
}

function getDetailValue(request: SupplyRequest) {
  if (request.type === "BUSINESS_TRIP") {
    return formatMoney(toNumber(request.amount));
  }

  if (request.type === "TRANSPORT") {
    return request.transportType ?? "Транспорт";
  }

  if (request.type === "FUEL") {
    return request.transportType ?? "Топливо";
  }

  if (request.type === "MONEY") {
    return formatMoney(toNumber(request.amount));
  }

  if (request.type === "PRODUCTION") {
    return request.purpose ?? "Производство";
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
  return (
    request.type === "MATERIAL" ||
    request.type === "QUARRY" ||
    request.type === "EXPRESS_MATERIAL"
  )
    ? request.items.length
    : 1;
}

function canDeleteRequest(user: User | null, request: SupplyRequest) {
  if (!user) {
    return false;
  }

  return Boolean(
    request.object?.userAccesses?.some(
      (access) => access.userId === user.id && access.role === "DIRECTOR",
    ),
  );
}

function toNumber(value: string | number | null | undefined) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatMoney(value: number) {
  return `${value.toLocaleString("ru-KZ")} тг`;
}

function formatPaymentType(type: SupplyRequest["paymentType"]) {
  if (type === "CASH") {
    return "Наличные";
  }

  if (type === "NON_CASH") {
    return "Безналичные";
  }

  return "-";
}
