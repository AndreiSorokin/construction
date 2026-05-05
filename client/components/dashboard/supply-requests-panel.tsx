"use client";

import { Check, RefreshCcw, Send, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { ApprovalHistoryList } from "@/components/dashboard/approval-history-list";
import {
  approveTransportBySupply,
  approveSupplyRequestByChiefEngineer,
  approveSupplyRequestByDirector,
  completeSupplyRequest,
  getSupplyRequests,
  rejectSupplyRequestByDirector,
  returnSupplyRequestToPtoByChiefEngineer,
  setPtoLimitPrices,
  setSupplierPurchasePrices,
} from "@/lib/supply-requests-api";
import { SupplyRequest, User } from "@/lib/types";

type SupplyRequestsPanelProps = {
  user: User;
  onError: (error: unknown) => void;
  onSuccess: (message: string) => void;
};

export function SupplyRequestsPanel({
  user,
  onError,
  onSuccess,
}: SupplyRequestsPanelProps) {
  const [requests, setRequests] = useState<SupplyRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const canSeePanel =
    user.role === "PTO" ||
    user.role === "CHIEF_ENGINEER" ||
    user.role === "SUPPLY" ||
    user.role === "DIRECTOR";
  const visibleRequests = getVisibleRequests(user, requests);

  useEffect(() => {
    if (canSeePanel) {
      void loadRequests();
    }
  }, [canSeePanel]);

  if (!canSeePanel) {
    return null;
  }

  async function loadRequests() {
    setIsLoading(true);

    try {
      setRequests(await getSupplyRequests());
    } catch (error) {
      onError(error);
    } finally {
      setIsLoading(false);
    }
  }

  async function submitPtoPrices(
    request: SupplyRequest,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    try {
      await setPtoLimitPrices(request.id, {
        comment: String(form.get("comment") ?? ""),
        items: request.items.map((item) => ({
          requestItemId: item.id,
          ptoLimitPrice: String(form.get(`ptoLimitPrice:${item.id}`)),
        })),
      });

      onSuccess(`Заявка ${request.requestNumber} отправлена главному инженеру`);
      await loadRequests();
    } catch (error) {
      onError(error);
    }
  }

  async function approveByChiefEngineer(request: SupplyRequest) {
    try {
      await approveSupplyRequestByChiefEngineer(request.id);
      onSuccess(`Заявка ${request.requestNumber} отправлена в снабжение`);
      await loadRequests();
    } catch (error) {
      onError(error);
    }
  }

  async function returnToPtoByChiefEngineer(request: SupplyRequest) {
    const comment = window.prompt("Комментарий для возврата в ПТО");

    if (comment === null) {
      return;
    }

    if (!comment.trim()) {
      onError("Комментарий обязателен для возврата заявки в ПТО");
      return;
    }

    try {
      await returnSupplyRequestToPtoByChiefEngineer(request.id, comment);
      onSuccess(`Заявка ${request.requestNumber} возвращена в ПТО`);
      await loadRequests();
    } catch (error) {
      onError(error);
    }
  }

  async function submitSupplierPrices(
    request: SupplyRequest,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    try {
      await setSupplierPurchasePrices(request.id, {
        comment: String(form.get("comment") ?? ""),
        items: request.items.map((item) => ({
          requestItemId: item.id,
          supplierPurchasePrice: String(
            form.get(`supplierPurchasePrice:${item.id}`),
          ),
        })),
      });

      onSuccess(`Заявка ${request.requestNumber} отправлена директору`);
      await loadRequests();
    } catch (error) {
      onError(error);
    }
  }

  async function approveTransportRequestBySupply(request: SupplyRequest) {

    try {
      await approveTransportBySupply(request.id);
      onSuccess(`Заявка ${request.requestNumber} отправлена директору`);
      await loadRequests();
    } catch (error) {
      onError(error);
    }
  }

  async function completeBySupply(request: SupplyRequest) {
    const comment = window.prompt("Комментарий к исполнению заявки");

    if (comment === null) {
      return;
    }

    try {
      await completeSupplyRequest(request.id, comment);
      onSuccess(`Заявка ${request.requestNumber} исполнена`);
      await loadRequests();
    } catch (error) {
      onError(error);
    }
  }

  async function approveByDirector(request: SupplyRequest) {
    try {
      await approveSupplyRequestByDirector(request.id);
      onSuccess(`Заявка ${request.requestNumber} согласована`);
      await loadRequests();
    } catch (error) {
      onError(error);
    }
  }

  async function rejectByDirector(request: SupplyRequest) {
    const comment = window.prompt("Комментарий к отклонению");

    if (comment === null) {
      return;
    }

    try {
      await rejectSupplyRequestByDirector(request.id, comment);
      onSuccess(`Заявка ${request.requestNumber} отклонена`);
      await loadRequests();
    } catch (error) {
      onError(error);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-950">
            {getPanelTitle(user)}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {getPanelDescription(user)}
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
        {isLoading ? (
          <div className="rounded-md border border-slate-200 p-4 text-sm text-slate-600">
            Загружаем заявки...
          </div>
        ) : null}

        {!isLoading && !visibleRequests.length ? (
          <div className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-600">
            Нет заявок для текущего этапа.
          </div>
        ) : null}

        {visibleRequests.map((request) => {
          if (user.role === "PTO") {
            return (
              <PtoRequestCard
                key={request.id}
                request={request}
                onSubmit={submitPtoPrices}
              />
            );
          }

          if (user.role === "CHIEF_ENGINEER") {
            return (
              <ChiefEngineerRequestCard
                key={request.id}
                request={request}
                onApprove={approveByChiefEngineer}
                onReturn={returnToPtoByChiefEngineer}
              />
            );
          }

          if (user.role === "SUPPLY") {
            if (request.status === "IN_PROGRESS") {
              return (
                <SupplyInProgressCard
                  key={request.id}
                  request={request}
                  onComplete={completeBySupply}
                />
              );
            }

            if (request.type === "TRANSPORT") {
              return (
                <SupplyTransportRequestCard
                  key={request.id}
                  request={request}
                  onApprove={approveTransportRequestBySupply}
                />
              );
            }

            return (
              <SupplyRequestCard
                key={request.id}
                request={request}
                onSubmit={submitSupplierPrices}
              />
            );
          }

          return (
            <DirectorRequestCard
              key={request.id}
              request={request}
              onApprove={approveByDirector}
              onReject={rejectByDirector}
            />
          );
        })}
      </div>
    </section>
  );
}

function PtoRequestCard({
  onSubmit,
  request,
}: {
  onSubmit: (
    request: SupplyRequest,
    event: FormEvent<HTMLFormElement>,
  ) => void;
  request: SupplyRequest;
}) {
  return (
    <form
      className="rounded-md border border-slate-200 p-4"
      onSubmit={(event) => onSubmit(request, event)}
    >
      <RequestHeader request={request} />
      <ApprovalHistoryList history={request.approvalHistory} />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-3 font-medium">Материал</th>
              <th className="py-2 pr-3 font-medium">Кол-во</th>
              <th className="py-2 pr-3 font-medium">Сметная цена за ед.</th>
              <th className="py-2 pr-3 font-medium">Сумма заявки</th>
              <th className="py-2 pr-3 font-medium">Цена ПТО за ед.</th>
            </tr>
          </thead>
          <tbody>
            {request.items.map((item) => (
              <tr className="border-b border-slate-100" key={item.id}>
                <td className="py-3 pr-3 text-slate-950">
                  {item.materialNameSnapshot}
                </td>
                <td className="py-3 pr-3 text-slate-600">
                  {formatQuantity(item.quantity)} {item.measurementUnitSnapshot}
                </td>
                <td className="py-3 pr-3 text-slate-600">
                  {formatMoney(toNumber(item.estimatedPriceSnapshot))}
                </td>
                <td className="py-3 pr-3 text-slate-600">
                  {formatMoney(getEstimatedTotal(item))}
                </td>
                <td className="py-3 pr-3">
                  <input
                    className="h-10 w-36 rounded-md border border-slate-300 px-3 outline-none focus:border-teal-700"
                    defaultValue={String(
                      item.ptoLimitPrice ?? item.estimatedPriceSnapshot,
                    )}
                    min="0"
                    name={`ptoLimitPrice:${item.id}`}
                    required
                    type="number"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 grid gap-3">
        <input
          className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-teal-700"
          name="comment"
          placeholder="Комментарий ПТО"
        />
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800"
          type="submit"
        >
          <Send size={16} />
          Отправить главному инженеру
        </button>
      </div>
    </form>
  );
}

function ChiefEngineerRequestCard({
  onApprove,
  onReturn,
  request,
}: {
  onApprove: (request: SupplyRequest) => void;
  onReturn: (request: SupplyRequest) => void;
  request: SupplyRequest;
}) {
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <RequestHeader request={request} />
      <ApprovalHistoryList history={request.approvalHistory} />
      <PriceComparisonTable request={request} mode="pto" />
      <Totals request={request} mode="pto" />
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-red-200 bg-white px-3 text-sm font-medium text-red-700 hover:bg-red-50"
          onClick={() => onReturn(request)}
          type="button"
        >
          <X size={16} />
          Вернуть в ПТО
        </button>
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800"
          onClick={() => onApprove(request)}
          type="button"
        >
          <Check size={16} />
          Согласовать и отправить в снабжение
        </button>
      </div>
    </div>
  );
}

function SupplyRequestCard({
  onSubmit,
  request,
}: {
  onSubmit: (
    request: SupplyRequest,
    event: FormEvent<HTMLFormElement>,
  ) => void;
  request: SupplyRequest;
}) {
  return (
    <form
      className="rounded-md border border-slate-200 p-4"
      onSubmit={(event) => onSubmit(request, event)}
    >
      <RequestHeader request={request} />
      <ApprovalHistoryList history={request.approvalHistory} />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-3 font-medium">Материал</th>
              <th className="py-2 pr-3 font-medium">Кол-во</th>
              <th className="py-2 pr-3 font-medium">Сметная цена за ед.</th>
              <th className="py-2 pr-3 font-medium">Цена ПТО за ед.</th>
              <th className="py-2 pr-3 font-medium">Сумма ПТО</th>
              <th className="py-2 pr-3 font-medium">
                Закупочная цена за ед.
              </th>
            </tr>
          </thead>
          <tbody>
            {request.items.map((item) => (
              <tr className="border-b border-slate-100" key={item.id}>
                <td className="py-3 pr-3 text-slate-950">
                  {item.materialNameSnapshot}
                </td>
                <td className="py-3 pr-3 text-slate-600">
                  {formatQuantity(item.quantity)} {item.measurementUnitSnapshot}
                </td>
                <td className="py-3 pr-3 text-slate-600">
                  {formatMoney(toNumber(item.estimatedPriceSnapshot))}
                </td>
                <td className="py-3 pr-3 text-slate-600">
                  {formatMoney(toNumber(item.ptoLimitPrice))}
                </td>
                <td className="py-3 pr-3 text-slate-600">
                  {formatMoney(getPtoTotal(item))}
                </td>
                <td className="py-3 pr-3">
                  <input
                    className="h-10 w-40 rounded-md border border-slate-300 px-3 outline-none focus:border-teal-700"
                    defaultValue={String(
                      item.supplierPurchasePrice ??
                        item.ptoLimitPrice ??
                        item.estimatedPriceSnapshot,
                    )}
                    min="0"
                    name={`supplierPurchasePrice:${item.id}`}
                    required
                    type="number"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 grid gap-3">
        <input
          className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-teal-700"
          name="comment"
          placeholder="Комментарий снабжения"
        />
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800"
          type="submit"
        >
          <Send size={16} />
          Отправить директору
        </button>
      </div>
    </form>
  );
}

function SupplyTransportRequestCard({
  onApprove,
  request,
}: {
  onApprove: (request: SupplyRequest) => void;
  request: SupplyRequest;
}) {
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <RequestHeader request={request} />
      <ApprovalHistoryList history={request.approvalHistory} />
      <TransportDetails request={request} />
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800"
          onClick={() => onApprove(request)}
          type="button"
        >
          <Send size={16} />
          Отправить директору
        </button>
      </div>
    </div>
  );
}

function SupplyInProgressCard({
  onComplete,
  request,
}: {
  onComplete: (request: SupplyRequest) => void;
  request: SupplyRequest;
}) {
  return (
    <div className="rounded-md border border-emerald-200 bg-emerald-50/40 p-4">
      <RequestHeader request={request} />
      <ApprovalHistoryList history={request.approvalHistory} />
      {request.type === "TRANSPORT" ? (
        <TransportDetails request={request} />
      ) : (
        <>
          <PriceComparisonTable request={request} mode="supplier" />
          <Totals request={request} mode="supplier" />
        </>
      )}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800"
          onClick={() => onComplete(request)}
          type="button"
        >
          <Check size={16} />
          Отметить исполненной
        </button>
      </div>
    </div>
  );
}

function DirectorRequestCard({
  onApprove,
  onReject,
  request,
}: {
  onApprove: (request: SupplyRequest) => void;
  onReject: (request: SupplyRequest) => void;
  request: SupplyRequest;
}) {
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <RequestHeader request={request} />
      <ApprovalHistoryList history={request.approvalHistory} />
      {request.type === "TRANSPORT" ? (
        <TransportDetails request={request} />
      ) : (
        <>
          <PriceComparisonTable request={request} mode="supplier" />
          <Totals request={request} mode="supplier" />
        </>
      )}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-red-200 bg-white px-3 text-sm font-medium text-red-700 hover:bg-red-50"
          onClick={() => onReject(request)}
          type="button"
        >
          <X size={16} />
          Отклонить
        </button>
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800"
          onClick={() => onApprove(request)}
          type="button"
        >
          <Check size={16} />
          Согласовать
        </button>
      </div>
    </div>
  );
}

function PriceComparisonTable({
  mode,
  request,
}: {
  mode: "pto" | "supplier";
  request: SupplyRequest;
}) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[980px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="py-2 pr-3 font-medium">Материал</th>
            <th className="py-2 pr-3 font-medium">Кол-во</th>
            <th className="py-2 pr-3 font-medium">Сметная цена за ед.</th>
            <th className="py-2 pr-3 font-medium">Цена ПТО за ед.</th>
            {mode === "supplier" ? (
              <th className="py-2 pr-3 font-medium">
                Закупочная цена за ед.
              </th>
            ) : null}
            <th className="py-2 pr-3 font-medium">Сумма заявки</th>
            <th className="py-2 pr-3 font-medium">Сумма ПТО</th>
            {mode === "supplier" ? (
              <th className="py-2 pr-3 font-medium">Сумма снабжения</th>
            ) : null}
            <th className="py-2 pr-3 font-medium">Разница</th>
          </tr>
        </thead>
        <tbody>
          {request.items.map((item) => {
            const estimatedTotal = getEstimatedTotal(item);
            const ptoTotal = getPtoTotal(item);
            const supplierTotal = getSupplierTotal(item);
            const comparisonTotal =
              mode === "supplier" ? supplierTotal : ptoTotal;
            const diff = comparisonTotal - estimatedTotal;

            return (
              <tr className="border-b border-slate-100" key={item.id}>
                <td className="py-3 pr-3 text-slate-950">
                  {item.materialNameSnapshot}
                </td>
                <td className="py-3 pr-3 text-slate-600">
                  {formatQuantity(item.quantity)} {item.measurementUnitSnapshot}
                </td>
                <td className="py-3 pr-3 text-slate-600">
                  {formatMoney(toNumber(item.estimatedPriceSnapshot))}
                </td>
                <td className="py-3 pr-3 font-medium text-slate-950">
                  {formatMoney(toNumber(item.ptoLimitPrice))}
                </td>
                {mode === "supplier" ? (
                  <td className="py-3 pr-3 font-medium text-slate-950">
                    {formatMoney(toNumber(item.supplierPurchasePrice))}
                  </td>
                ) : null}
                <td className="py-3 pr-3 text-slate-600">
                  {formatMoney(estimatedTotal)}
                </td>
                <td className="py-3 pr-3 text-slate-600">
                  {formatMoney(ptoTotal)}
                </td>
                {mode === "supplier" ? (
                  <td className="py-3 pr-3 font-medium text-slate-950">
                    {formatMoney(supplierTotal)}
                  </td>
                ) : null}
                <td
                  className={
                    diff > 0
                      ? "py-3 pr-3 font-medium text-red-700"
                      : "py-3 pr-3 font-medium text-emerald-700"
                  }
                >
                  {formatMoney(diff)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Totals({
  mode,
  request,
}: {
  mode: "pto" | "supplier";
  request: SupplyRequest;
}) {
  const estimatedTotal = getRequestEstimatedTotal(request);
  const ptoTotal = getRequestPtoTotal(request);
  const supplierTotal = getRequestSupplierTotal(request);
  const comparisonTotal = mode === "supplier" ? supplierTotal : ptoTotal;

  return (
    <div className="mt-4 grid gap-2 rounded-md bg-slate-50 p-3 text-sm sm:grid-cols-4">
      <Metric label="Итого заявка" value={formatMoney(estimatedTotal)} />
      <Metric label="Итого ПТО" value={formatMoney(ptoTotal)} />
      {mode === "supplier" ? (
        <Metric label="Итого снабжение" value={formatMoney(supplierTotal)} />
      ) : null}
      <Metric
        label="Разница"
        tone={comparisonTotal > estimatedTotal ? "danger" : "success"}
        value={formatMoney(comparisonTotal - estimatedTotal)}
      />
    </div>
  );
}

function RequestHeader({ request }: { request: SupplyRequest }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="font-medium text-slate-950">
          {request.requestNumber}
        </div>
        <div className="mt-1 text-sm text-slate-600">
          {request.object?.name ?? "Объект"} · автор{" "}
          {request.author?.name ?? request.authorId}
        </div>
      </div>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
        {request.status}
      </span>
    </div>
  );
}

function TransportDetails({ request }: { request: SupplyRequest }) {
  return (
    <div className="mt-4 grid gap-3 rounded-md bg-slate-50 p-3 text-sm sm:grid-cols-2">
      <div>
        <div className="text-slate-500">Вид транспорта</div>
        <div className="mt-1 font-medium text-slate-950">
          {request.transportType ?? "Не указан"}
        </div>
      </div>
      <div>
        <div className="text-slate-500">Назначение</div>
        <div className="mt-1 font-medium text-slate-950">
          {request.purpose ?? "Не указано"}
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  tone,
  value,
}: {
  label: string;
  tone?: "danger" | "success";
  value: string;
}) {
  return (
    <div>
      <div className="text-slate-500">{label}</div>
      <div
        className={
          tone === "danger"
            ? "mt-1 font-semibold text-red-700"
            : tone === "success"
              ? "mt-1 font-semibold text-emerald-700"
              : "mt-1 font-semibold text-slate-950"
        }
      >
        {value}
      </div>
    </div>
  );
}

function getVisibleRequests(user: User, requests: SupplyRequest[]) {
  if (user.role === "PTO") {
    return requests.filter(
      (request) =>
        request.type === "MATERIAL" && request.status === "PENDING_PTO",
    );
  }

  if (user.role === "CHIEF_ENGINEER") {
    return requests.filter(
      (request) =>
        request.type === "MATERIAL" &&
        request.status === "PENDING_CHIEF_ENGINEER",
    );
  }

  if (user.role === "SUPPLY") {
    return requests.filter(
      (request) =>
        (request.type === "MATERIAL" || request.type === "TRANSPORT") &&
        (request.status === "PENDING_SUPPLY" ||
          request.status === "RETURNED_TO_SUPPLY" ||
          request.status === "IN_PROGRESS"),
    );
  }

  return requests.filter(
    (request) =>
      (request.type === "MATERIAL" || request.type === "TRANSPORT") &&
      request.status === "PENDING_DIRECTOR",
  );
}

function getPanelTitle(user: User) {
  if (user.role === "PTO") {
    return "Заявки на оценке ПТО";
  }

  if (user.role === "CHIEF_ENGINEER") {
    return "Заявки на согласовании главного инженера";
  }

  if (user.role === "SUPPLY") {
    return "Заявки в снабжении";
  }

  return "Заявки на согласовании директора";
}

function getPanelDescription(user: User) {
  if (user.role === "PTO") {
    return "Укажите предельную сметную цену за единицу товара и отправьте заявку главному инженеру.";
  }

  if (user.role === "CHIEF_ENGINEER") {
    return "Проверьте исходную цену и цену ПТО за единицу перед отправкой в снабжение.";
  }

  if (user.role === "SUPPLY") {
    return "Укажите закупочную цену за единицу товара, отправьте заявку директору и ведите согласованные заявки в работе.";
  }

  return "Сравните исходную цену, цену ПТО и закупочную цену снабжения.";
}

function getEstimatedTotal(item: SupplyRequest["items"][number]) {
  return toNumber(item.estimatedPriceSnapshot) * toNumber(item.quantity);
}

function getPtoTotal(item: SupplyRequest["items"][number]) {
  return toNumber(item.ptoLimitPrice) * toNumber(item.quantity);
}

function getSupplierTotal(item: SupplyRequest["items"][number]) {
  return toNumber(item.supplierPurchasePrice) * toNumber(item.quantity);
}

function getRequestEstimatedTotal(request: SupplyRequest) {
  return request.items.reduce(
    (total, item) => total + getEstimatedTotal(item),
    0,
  );
}

function getRequestPtoTotal(request: SupplyRequest) {
  return request.items.reduce((total, item) => total + getPtoTotal(item), 0);
}

function getRequestSupplierTotal(request: SupplyRequest) {
  return request.items.reduce(
    (total, item) => total + getSupplierTotal(item),
    0,
  );
}

function toNumber(value: string | number | null | undefined) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatQuantity(value: string) {
  return Number(value).toLocaleString("ru-KZ");
}

function formatMoney(value: number) {
  return `${value.toLocaleString("ru-KZ")} ₸`;
}
