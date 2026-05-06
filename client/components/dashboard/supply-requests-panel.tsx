"use client";

import { Check, RefreshCcw, Send, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { ApprovalHistoryList } from "@/components/dashboard/approval-history-list";
import {
  approveTransportBySupply,
  approveSupplyRequestByChiefEngineer,
  approveSupplyRequestByDirector,
  assignSupplyRequest,
  completeSupplyRequest,
  deleteSupplyRequestItem,
  getSupplyRequests,
  rejectSupplyRequestByDirector,
  returnSupplyRequestToPtoByChiefEngineer,
  setPtoLimitPrices,
  setSupplierPurchasePrices,
  updateSupplyRequestItem,
} from "@/lib/supply-requests-api";
import { SupplyRequest, User, UserObjectAccess, UserRole } from "@/lib/types";

type SupplyRequestsPanelProps = {
  objectAccesses: UserObjectAccess[];
  user: User;
  onError: (error: unknown) => void;
  onSuccess: (message: string) => void;
};

export function SupplyRequestsPanel({
  objectAccesses,
  user,
  onError,
  onSuccess,
}: SupplyRequestsPanelProps) {
  const [requests, setRequests] = useState<SupplyRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const canSeePanel = objectAccesses.some((access) =>
    ["PTO", "CHIEF_ENGINEER", "SUPPLY_MANAGER", "SUPPLY", "DIRECTOR"].includes(
      access.role,
    ),
  );
  const visibleRequests = getVisibleRequests(objectAccesses, requests, user.id);

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

      onSuccess(
        `Заявка ${request.requestNumber} отправлена главному инженеру`,
      );
      await loadRequests();
    } catch (error) {
      onError(error);
    }
  }

  async function approveByChiefEngineer(request: SupplyRequest) {
    try {
      await approveSupplyRequestByChiefEngineer(request.id);
      onSuccess(
        `Заявка ${request.requestNumber} отправлена начальнику снабжения`,
      );
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

  async function assignBySupplyManager(
    request: SupplyRequest,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    try {
      await assignSupplyRequest(request.id, {
        supplyUserId: String(form.get("supplyUserId")),
        comment: String(form.get("comment") ?? ""),
      });
      onSuccess(`Заявка ${request.requestNumber} назначена снабженцу`);
      await loadRequests();
    } catch (error) {
      onError(error);
    }
  }

  async function updateRequestItemQuantity(
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
  ) {
    const quantity = window.prompt(
      `Новое количество для "${item.materialNameSnapshot}"`,
      String(item.quantity),
    );

    if (quantity === null) {
      return;
    }

    if (!quantity.trim() || Number(quantity) <= 0) {
      onError("Количество должно быть больше нуля");
      return;
    }

    const comment = window.prompt("Комментарий к изменению позиции") ?? "";

    try {
      await updateSupplyRequestItem(request.id, item.id, {
        quantity,
        comment,
      });
      onSuccess(`Позиция в заявке ${request.requestNumber} изменена`);
      await loadRequests();
    } catch (error) {
      onError(error);
    }
  }

  async function deleteRequestItemFromRequest(
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
  ) {
    const isConfirmed = window.confirm(
      `Удалить позицию "${item.materialNameSnapshot}" из заявки ${request.requestNumber}?`,
    );

    if (!isConfirmed) {
      return;
    }

    const comment = window.prompt("Комментарий к удалению позиции") ?? "";

    try {
      await deleteSupplyRequestItem(request.id, item.id, comment);
      onSuccess(`Позиция удалена из заявки ${request.requestNumber}`);
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
      onSuccess(`Заявка ${request.requestNumber} отмечена как исполненная`);
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
    const comment = window.prompt("Комментарий к отклонению заявки");

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
            Заявки на согласовании
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Заявки показываются по вашей роли внутри конкретного объекта или
            отдела.
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
          const objectRole = getObjectRole(objectAccesses, request.objectId);

          if (objectRole === "PTO") {
            return (
              <PtoRequestCard
                key={request.id}
                request={request}
                onDeleteItem={deleteRequestItemFromRequest}
                onUpdateItem={updateRequestItemQuantity}
                onSubmit={submitPtoPrices}
              />
            );
          }

          if (objectRole === "CHIEF_ENGINEER") {
            return (
              <ChiefEngineerRequestCard
                key={request.id}
                request={request}
                onApprove={approveByChiefEngineer}
                onDeleteItem={deleteRequestItemFromRequest}
                onReturn={returnToPtoByChiefEngineer}
                onUpdateItem={updateRequestItemQuantity}
              />
            );
          }

          if (objectRole === "SUPPLY_MANAGER") {
            return (
              <SupplyManagerRequestCard
                key={request.id}
                request={request}
                supplyUsers={getSupplyUsersForRequest(objectAccesses, request)}
                onDeleteItem={deleteRequestItemFromRequest}
                onSubmit={assignBySupplyManager}
                onUpdateItem={updateRequestItemQuantity}
              />
            );
          }

          if (objectRole === "SUPPLY") {
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

          if (objectRole === "DIRECTOR") {
            return (
              <DirectorRequestCard
                key={request.id}
                request={request}
                onApprove={approveByDirector}
                onDeleteItem={deleteRequestItemFromRequest}
                onReject={rejectByDirector}
                onUpdateItem={updateRequestItemQuantity}
              />
            );
          }

          return null;
        })}
      </div>
    </section>
  );
}

function SupplyManagerRequestCard({
  onDeleteItem,
  onSubmit,
  onUpdateItem,
  request,
  supplyUsers,
}: {
  onDeleteItem: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
  ) => void;
  onSubmit: (
    request: SupplyRequest,
    event: FormEvent<HTMLFormElement>,
  ) => void;
  onUpdateItem: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
  ) => void;
  request: SupplyRequest;
  supplyUsers: User[];
}) {
  return (
    <form
      className="rounded-md border border-slate-200 p-4"
      onSubmit={(event) => onSubmit(request, event)}
    >
      <RequestHeader request={request} />
      <ApprovalHistoryList history={request.approvalHistory} />
      {request.type === "TRANSPORT" ? (
        <TransportDetails request={request} />
      ) : (
        <>
          <PriceComparisonTable
            request={request}
            mode="pto"
            onDeleteItem={onDeleteItem}
            onUpdateItem={onUpdateItem}
          />
          <Totals request={request} mode="pto" />
        </>
      )}
      <div className="mt-4 grid gap-3 rounded-md bg-slate-50 p-3">
        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-slate-700">
            Назначенный снабженец
          </span>
          <select
            className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-teal-700"
            name="supplyUserId"
            required
          >
            <option value="">Выберите снабженца</option>
            {supplyUsers.map((supplyUser) => (
              <option key={supplyUser.id} value={supplyUser.id}>
                {supplyUser.name} ({supplyUser.email})
              </option>
            ))}
          </select>
        </label>
        <input
          className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-teal-700"
          name="comment"
          placeholder="Комментарий начальника снабжения"
        />
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={!supplyUsers.length}
          type="submit"
        >
          <Send size={16} />
          Назначить снабженца
        </button>
        {!supplyUsers.length ? (
          <div className="text-sm text-amber-700">
            На этом объекте пока нет пользователя с ролью снабженца.
          </div>
        ) : null}
      </div>
    </form>
  );
}

function PtoRequestCard({
  onDeleteItem,
  onSubmit,
  onUpdateItem,
  request,
}: {
  onDeleteItem: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
  ) => void;
  onSubmit: (
    request: SupplyRequest,
    event: FormEvent<HTMLFormElement>,
  ) => void;
  onUpdateItem: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
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
              <th className="py-2 pr-3 font-medium">Количество</th>
              <th className="py-2 pr-3 font-medium">
                Сметная цена за ед.
              </th>
              <th className="py-2 pr-3 font-medium">Сумма заявки</th>
              <th className="py-2 pr-3 font-medium">Цена ПТО за ед.</th>
              <th className="py-2 pr-3 font-medium">Действия</th>
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
                <td className="py-3 pr-3">
                  <RequestItemActions
                    item={item}
                    request={request}
                    onDelete={onDeleteItem}
                    onUpdate={onUpdateItem}
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
  onDeleteItem,
  onReturn,
  onUpdateItem,
  request,
}: {
  onApprove: (request: SupplyRequest) => void;
  onDeleteItem: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
  ) => void;
  onReturn: (request: SupplyRequest) => void;
  onUpdateItem: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
  ) => void;
  request: SupplyRequest;
}) {
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <RequestHeader request={request} />
      <ApprovalHistoryList history={request.approvalHistory} />
      <PriceComparisonTable
        request={request}
        mode="pto"
        onDeleteItem={onDeleteItem}
        onUpdateItem={onUpdateItem}
      />
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
          Согласовать и отправить начальнику снабжения
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
              <th className="py-2 pr-3 font-medium">Количество</th>
              <th className="py-2 pr-3 font-medium">
                Сметная цена за ед.
              </th>
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
  onDeleteItem,
  onReject,
  onUpdateItem,
  request,
}: {
  onApprove: (request: SupplyRequest) => void;
  onDeleteItem: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
  ) => void;
  onReject: (request: SupplyRequest) => void;
  onUpdateItem: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
  ) => void;
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
          <PriceComparisonTable
            request={request}
            mode="supplier"
            onDeleteItem={onDeleteItem}
            onUpdateItem={onUpdateItem}
          />
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

function RequestItemActions({
  item,
  onDelete,
  onUpdate,
  request,
}: {
  item: SupplyRequest["items"][number];
  onDelete: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
  ) => void;
  onUpdate: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
  ) => void;
  request: SupplyRequest;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
        onClick={() => onUpdate(request, item)}
        type="button"
      >
        Изменить
      </button>
      <button
        className="inline-flex h-9 items-center justify-center rounded-md border border-red-200 bg-white px-3 text-xs font-medium text-red-700 hover:bg-red-50"
        onClick={() => onDelete(request, item)}
        type="button"
      >
        Удалить
      </button>
    </div>
  );
}

function PriceComparisonTable({
  mode,
  onDeleteItem,
  onUpdateItem,
  request,
}: {
  mode: "pto" | "supplier";
  onDeleteItem?: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
  ) => void;
  onUpdateItem?: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
  ) => void;
  request: SupplyRequest;
}) {
  const canEditItems = Boolean(onDeleteItem && onUpdateItem);

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[980px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="py-2 pr-3 font-medium">Материал</th>
            <th className="py-2 pr-3 font-medium">Количество</th>
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
            {canEditItems ? (
              <th className="py-2 pr-3 font-medium">Действия</th>
            ) : null}
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
                {canEditItems && onDeleteItem && onUpdateItem ? (
                  <td className="py-3 pr-3">
                    <RequestItemActions
                      item={item}
                      request={request}
                      onDelete={onDeleteItem}
                      onUpdate={onUpdateItem}
                    />
                  </td>
                ) : null}
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
        <Metric
          label="Итого снабжение"
          value={formatMoney(supplierTotal)}
        />
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
        {request.assignedSupplyUser ? (
          <div className="mt-1 text-sm text-slate-600">
            Снабженец: {request.assignedSupplyUser.name}
          </div>
        ) : null}
      </div>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
        {getStatusLabel(request.status)}
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

function getVisibleRequests(
  objectAccesses: UserObjectAccess[],
  requests: SupplyRequest[],
  userId: string,
) {
  return requests.filter((request) => {
    const objectRole = getObjectRole(objectAccesses, request.objectId);

    if (objectRole === "PTO") {
      return request.type === "MATERIAL" && request.status === "PENDING_PTO";
    }

    if (objectRole === "CHIEF_ENGINEER") {
      return (
        request.type === "MATERIAL" &&
        request.status === "PENDING_CHIEF_ENGINEER"
      );
    }

    if (objectRole === "SUPPLY_MANAGER") {
      return (
        (request.type === "MATERIAL" || request.type === "TRANSPORT") &&
        request.status === "PENDING_SUPPLY_MANAGER"
      );
    }

    if (objectRole === "SUPPLY") {
      return (
        (request.type === "MATERIAL" || request.type === "TRANSPORT") &&
        request.assignedSupplyUserId === userId &&
        (request.status === "PENDING_SUPPLY" ||
          request.status === "RETURNED_TO_SUPPLY" ||
          request.status === "IN_PROGRESS")
      );
    }

    if (objectRole === "DIRECTOR") {
      return (
        (request.type === "MATERIAL" ||
          request.type === "TRANSPORT" ||
          request.type === "MONEY") &&
        request.status === "PENDING_DIRECTOR"
      );
    }

    return false;
  });
}

function getObjectRole(
  objectAccesses: UserObjectAccess[],
  objectId: string,
): UserRole | null {
  return (
    objectAccesses.find((access) => access.objectId === objectId)?.role ?? null
  );
}

function getSupplyUsersForRequest(
  objectAccesses: UserObjectAccess[],
  request: SupplyRequest,
) {
  const objectAccess = objectAccesses.find(
    (access) => access.objectId === request.objectId,
  );

  return (
    objectAccess?.object.userAccesses
      ?.filter((access) => access.role === "SUPPLY" && access.user)
      .map((access) => access.user as User) ?? []
  );
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
  return `${value.toLocaleString("ru-KZ")} тг`;
}

function getStatusLabel(status: SupplyRequest["status"]) {
  const labels: Record<SupplyRequest["status"], string> = {
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

  return labels[status];
}
