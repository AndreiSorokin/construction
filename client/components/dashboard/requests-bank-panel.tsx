"use client";

import { RefreshCcw } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { ApprovalHistoryList } from "@/components/dashboard/approval-history-list";
import { useErrorMessage } from "@/hooks/use-error-message";
import { getSupplyRequests } from "@/lib/supply-requests-api";
import { SupplyRequest, SupplyRequestStatus, SupplyRequestType } from "@/lib/types";

type RequestsBankPanelProps = {
  onError?: (error: unknown) => void;
};

const statusLabels: Record<SupplyRequestStatus, string> = {
  CREATED: "Создана",
  PENDING_PTO: "В ПТО",
  PENDING_CHIEF_ENGINEER: "У главного инженера",
  PENDING_SUPPLY_MANAGER: "У начальника снабжения",
  PENDING_SUPPLY: "У снабженца",
  PENDING_DIRECTOR: "У директора",
  RETURNED_TO_SUPPLY: "Возвращена снабжению",
  REJECTED: "Отклонена",
  IN_PROGRESS: "В работе",
  COMPLETED: "Исполнена",
  ARCHIVED: "Архив",
};

const typeLabels: Record<SupplyRequestType, string> = {
  MATERIAL: "Материалы",
  TRANSPORT: "Транспорт",
  MONEY: "Деньги",
};

const statusClasses: Record<SupplyRequestStatus, string> = {
  CREATED: "bg-slate-100 text-slate-700",
  PENDING_PTO: "bg-amber-50 text-amber-700",
  PENDING_CHIEF_ENGINEER: "bg-indigo-50 text-indigo-700",
  PENDING_SUPPLY_MANAGER: "bg-sky-50 text-sky-700",
  PENDING_SUPPLY: "bg-cyan-50 text-cyan-700",
  PENDING_DIRECTOR: "bg-violet-50 text-violet-700",
  RETURNED_TO_SUPPLY: "bg-orange-50 text-orange-700",
  REJECTED: "bg-red-50 text-red-700",
  IN_PROGRESS: "bg-teal-50 text-teal-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  ARCHIVED: "bg-slate-100 text-slate-500",
};

export function RequestsBankPanel({ onError }: RequestsBankPanelProps) {
  const [requests, setRequests] = useState<SupplyRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { errorMessage, showError, clearError } = useErrorMessage();

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
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-950">Банк заявок</h2>
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

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[1040px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-center text-slate-500">
              <th className="py-2 pr-3 font-medium">Номер</th>
              <th className="py-2 pr-3 font-medium">Тип</th>
              <th className="py-2 pr-3 font-medium">Объект</th>
              <th className="py-2 pr-3 font-medium">Автор</th>
              <th className="py-2 pr-3 font-medium">Снабженец</th>
              <th className="py-2 pr-3 font-medium">Статус</th>
              <th className="py-2 pr-3 font-medium">Детали / сумма</th>
              <th className="py-2 pr-3 font-medium">Счета</th>
              <th className="py-2 pr-3 font-medium">Дата</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <Fragment key={request.id}>
                <tr className="border-b border-slate-100 text-center">
                  <td className="py-3 pr-3 font-medium text-slate-950">
                    {request.requestNumber}
                  </td>
                  <td className="py-3 pr-3 text-slate-600">
                    {typeLabels[request.type]}
                  </td>
                  <td className="py-3 pr-3 text-slate-600">
                    {request.object?.name ?? request.objectId}
                  </td>
                  <td className="py-3 pr-3 text-slate-600">
                    {request.author?.name ?? request.authorId}
                  </td>
                  <td className="py-3 pr-3 text-slate-600">
                    {request.assignedSupplyUser?.name ??
                      request.assignedSupplyUser?.email ??
                      "-"}
                  </td>
                  <td className="py-3 pr-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${statusClasses[request.status]}`}
                    >
                      {statusLabels[request.status]}
                    </span>
                  </td>
                  <td className="py-3 pr-3 text-slate-600">
                    {request.type === "TRANSPORT"
                      ? request.transportType ?? "Транспорт"
                      : formatMoney(getEstimatedTotal(request))}
                  </td>
                  <td className="py-3 pr-3 text-slate-600">
                    {request.invoices?.length
                      ? `${request.invoices.length} шт.`
                      : "-"}
                  </td>
                  <td className="py-3 pr-3 text-slate-600">
                    {new Date(request.createdAt).toLocaleDateString("ru-KZ")}
                  </td>
                </tr>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  <td className="px-3 py-3" colSpan={9}>
                    <ApprovalHistoryList
                      compact
                      history={request.approvalHistory}
                    />
                  </td>
                </tr>
              </Fragment>
            ))}

            {!isLoading && !requests.length ? (
              <tr>
                <td className="py-6 text-sm text-slate-500" colSpan={9}>
                  Пока нет заявок.
                </td>
              </tr>
            ) : null}

            {isLoading ? (
              <tr>
                <td className="py-6 text-sm text-slate-500" colSpan={9}>
                  Загружаем заявки...
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function getEstimatedTotal(request: SupplyRequest) {
  if (request.type === "MONEY") {
    return 0;
  }

  return request.items.reduce(
    (total, item) =>
      total + toNumber(item.estimatedPriceSnapshot) * toNumber(item.quantity),
    0,
  );
}

function toNumber(value: string | number | null | undefined) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatMoney(value: number) {
  return `${value.toLocaleString("ru-KZ")} тг`;
}
