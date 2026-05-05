"use client";

import { RefreshCcw, Search, X } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { ApprovalHistoryList } from "@/components/dashboard/approval-history-list";
import { useErrorMessage } from "@/hooks/use-error-message";
import { getSupplyRequestsPage } from "@/lib/supply-requests-api";
import {
  SupplyRequest,
  SupplyRequestStatus,
  SupplyRequestType,
} from "@/lib/types";

type RequestsBankPanelProps = {
  onError?: (error: unknown) => void;
};

const statusLabels: Record<SupplyRequestStatus, string> = {
  CREATED: "Создана",
  PENDING_PTO: "В ПТО",
  PENDING_CHIEF_ENGINEER: "У главного инженера",
  PENDING_SUPPLY: "В снабжении",
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
  PENDING_SUPPLY: "bg-cyan-50 text-cyan-700",
  PENDING_DIRECTOR: "bg-violet-50 text-violet-700",
  RETURNED_TO_SUPPLY: "bg-orange-50 text-orange-700",
  REJECTED: "bg-red-50 text-red-700",
  IN_PROGRESS: "bg-teal-50 text-teal-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  ARCHIVED: "bg-slate-100 text-slate-500",
};

const REQUESTS_PER_PAGE = 10;

export function RequestsBankPanel({ onError }: RequestsBankPanelProps) {
  const [requests, setRequests] = useState<SupplyRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [objectSearch, setObjectSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<SupplyRequestType | "ALL">(
    "ALL",
  );
  const [statusFilter, setStatusFilter] = useState<
    SupplyRequestStatus | "ALL"
  >("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const { errorMessage, showError, clearError } = useErrorMessage();

  useEffect(() => {
    void loadRequests(page);
  }, [dateFrom, dateTo, objectSearch, page, statusFilter, typeFilter]);

  async function loadRequests(nextPage = page) {
    setIsLoading(true);
    clearError();

    try {
      const response = await getSupplyRequestsPage({
        dateFrom,
        dateTo,
        limit: REQUESTS_PER_PAGE,
        objectSearch,
        page: nextPage,
        status: statusFilter,
        type: typeFilter,
      });

      setRequests(response.items ?? []);
      setTotal(response.total ?? 0);
      setTotalPages(response.totalPages ?? 1);

      if (nextPage > response.totalPages) {
        setPage(response.totalPages);
      }
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

  function resetFilters() {
    setObjectSearch("");
    setTypeFilter("ALL");
    setStatusFilter("ALL");
    setDateFrom("");
    setDateTo("");
    setPage(1);
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

      <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4">
        <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto]">
          <label className="grid gap-1 text-sm">
            <span className="text-slate-600">Поиск по объекту</span>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={16}
              />
              <input
                className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 outline-none focus:border-teal-700"
                onChange={(event) => {
                  setObjectSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Название объекта"
                value={objectSearch}
              />
            </div>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-slate-600">Тип</span>
            <select
              className="h-10 rounded-md border border-slate-300 bg-white px-3 outline-none focus:border-teal-700"
              onChange={(event) =>
                {
                  setTypeFilter(
                    event.target.value as SupplyRequestType | "ALL",
                  );
                  setPage(1);
                }
              }
              value={typeFilter}
            >
              <option value="ALL">Все типы</option>
              {Object.entries(typeLabels).map(([type, label]) => (
                <option key={type} value={type}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-slate-600">Статус</span>
            <select
              className="h-10 rounded-md border border-slate-300 bg-white px-3 outline-none focus:border-teal-700"
              onChange={(event) => {
                setStatusFilter(
                  event.target.value as SupplyRequestStatus | "ALL",
                );
                setPage(1);
              }}
              value={statusFilter}
            >
              <option value="ALL">Все статусы</option>
              {Object.entries(statusLabels).map(([status, label]) => (
                <option key={status} value={status}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-slate-600">Дата от</span>
            <input
              className="h-10 rounded-md border border-slate-300 bg-white px-3 outline-none focus:border-teal-700"
              onChange={(event) => {
                setDateFrom(event.target.value);
                setPage(1);
              }}
              type="date"
              value={dateFrom}
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-slate-600">Дата до</span>
            <input
              className="h-10 rounded-md border border-slate-300 bg-white px-3 outline-none focus:border-teal-700"
              onChange={(event) => {
                setDateTo(event.target.value);
                setPage(1);
              }}
              type="date"
              value={dateTo}
            />
          </label>

          <div className="flex items-end">
            <button
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={resetFilters}
              type="button"
            >
              <X size={16} />
              Сбросить
            </button>
          </div>
        </div>

        <div className="mt-3 text-sm text-slate-600">
          Показано {requests.length} из {total}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[880px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-center text-slate-500">
              <th className="py-2 pr-3 font-medium">Номер</th>
              <th className="py-2 pr-3 font-medium">Тип</th>
              <th className="py-2 pr-3 font-medium">Объект</th>
              <th className="py-2 pr-3 font-medium">Автор</th>
              <th className="py-2 pr-3 font-medium">Статус</th>
              <th className="py-2 pr-3 font-medium">
                Детали / сумма заявки
              </th>
              <th className="py-2 pr-3 font-medium">Сумма снабжения</th>
              <th className="py-2 pr-3 font-medium">Дата</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <Fragment key={request.id}>
                <tr className="border-b border-slate-100">
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
                    {request.items.length
                      ? formatMoney(getSupplierTotal(request))
                      : "-"}
                  </td>
                  <td className="py-3 pr-3 text-slate-600">
                    {new Date(request.createdAt).toLocaleDateString("ru-KZ")}
                  </td>
                </tr>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  <td className="px-3 py-3" colSpan={8}>
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
                <td className="py-6 text-sm text-slate-500" colSpan={8}>
                  Пока нет заявок.
                </td>
              </tr>
            ) : null}

            {!isLoading && total > 0 && !requests.length ? (
              <tr>
                <td className="py-6 text-sm text-slate-500" colSpan={8}>
                  По выбранным фильтрам заявок нет.
                </td>
              </tr>
            ) : null}

            {isLoading ? (
              <tr>
                <td className="py-6 text-sm text-slate-500" colSpan={8}>
                  Загружаем заявки...
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="text-slate-600">
          Страница {page} из {totalPages}
        </div>
        <div className="flex gap-2">
          <button
            className="h-10 rounded-md border border-slate-300 bg-white px-3 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={page <= 1 || isLoading}
            onClick={() => setPage((currentPage) => Math.max(currentPage - 1, 1))}
            type="button"
          >
            Назад
          </button>
          <button
            className="h-10 rounded-md border border-slate-300 bg-white px-3 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={page >= totalPages || isLoading}
            onClick={() =>
              setPage((currentPage) =>
                Math.min(currentPage + 1, totalPages),
              )
            }
            type="button"
          >
            Вперед
          </button>
        </div>
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

function getSupplierTotal(request: SupplyRequest) {
  return request.items.reduce(
    (total, item) =>
      total + toNumber(item.supplierPurchasePrice) * toNumber(item.quantity),
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
