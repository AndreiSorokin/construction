"use client";

import { RefreshCcw } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import {
  ChiefEngineerRequestCard,
  DeputyProductionDirectorRequestCard,
  DirectorRequestCard,
  GarageManagerTransportRequestCard,
  ObjectApprovalGroup,
  PtoRequestCard,
  SupplyInProgressCard,
  SupplyManagerRequestCard,
  SupplyManagerTransportRequestCard,
  SupplyMoneyRequestCard,
  StorekeeperRequestCard,
  SupplyRequestCard,
  SupplyTransportRequestCard,
  TransportAuthorCompletionCard,
  WarehouseManagerRequestCard,
  type ObjectRequestGroup,
} from "@/components/dashboard/supply-request-approval-cards";
import {
  approveSupplyRequestByChiefEngineer,
  approveSupplyRequestByDeputyProductionDirector,
  approveSupplyRequestByDirector,
  approveSupplyRequestByWarehouseManager,
  assignSupplyRequest,
  attachInvoicesAndSendToDirector,
  completeTransportByAuthor,
  completeTransportByGarageManager,
  completeSupplyRequest,
  completeSupplyRequestByStorekeeper,
  deleteSupplyRequestInvoice,
  deleteSupplyRequestItem,
  getSupplyRequests,
  rejectSupplyRequestByDirector,
  rejectSupplyRequestByChiefEngineer,
  rejectSupplyRequestByDeputyProductionDirector,
  returnSupplyRequestToSupplyByDirector,
  sendMoneyRequestToDirector,
  sendTransportToGarageManager,
  setPtoLimitPrices,
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

  const canSeePanel = objectAccesses.length > 0;
  const visibleRequests = getVisibleRequests(objectAccesses, requests, user.id);
  const visibleRequestGroups = groupRequestsByObject(visibleRequests);

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
    const items = request.items.map((item) => ({
      requestItemId: item.id,
      ptoLimitPrice: String(form.get(`ptoLimitPrice:${item.id}`) ?? ""),
    }));

    if (
      items.some(
        (item) => !item.ptoLimitPrice.trim() || Number(item.ptoLimitPrice) <= 0,
      )
    ) {
      onError("ПТО должно указать сметную цену за единицу для каждой позиции");
      return;
    }

    try {
      await setPtoLimitPrices(request.id, {
        comment: String(form.get("comment") ?? ""),
        items,
      });

      onSuccess(
        `Заявка ${request.requestNumber} отправлена начальнику снабжения`,
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
        `Заявка ${request.requestNumber} отправлена начальнику складского хозяйства`,
      );
      await loadRequests();
    } catch (error) {
      onError(error);
    }
  }

  async function approveByWarehouseManager(request: SupplyRequest) {
    try {
      await approveSupplyRequestByWarehouseManager(request.id);
      onSuccess(
        `Заявка ${request.requestNumber} отправлена в ПТО`,
      );
      await loadRequests();
    } catch (error) {
      onError(error);
    }
  }

  async function returnToPtoByChiefEngineer(request: SupplyRequest) {
    const comment = window.prompt("Комментарий к отклонению заявки");

    if (comment === null) {
      return;
    }

    if (!comment.trim()) {
      onError("Комментарий обязателен для отклонения заявки");
      return;
    }

    try {
      await rejectSupplyRequestByChiefEngineer(request.id, comment);
      onSuccess(`Заявка ${request.requestNumber} отклонена`);
      await loadRequests();
    } catch (error) {
      onError(error);
    }
  }

  async function approveByDeputyProductionDirector(request: SupplyRequest) {
    try {
      await approveSupplyRequestByDeputyProductionDirector(request.id);
      onSuccess(
        `Заявка ${request.requestNumber} отправлена начальнику снабжения`,
      );
      await loadRequests();
    } catch (error) {
      onError(error);
    }
  }

  async function rejectByDeputyProductionDirector(request: SupplyRequest) {
    const comment = window.prompt("Комментарий к отклонению заявки") ?? null;

    if (comment === null) {
      return;
    }

    try {
      await rejectSupplyRequestByDeputyProductionDirector(request.id, comment);
      onSuccess(`Заявка ${request.requestNumber} отклонена`);
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

  async function sendToGarageBySupplyManager(request: SupplyRequest) {
    const comment = window.prompt(
      "Комментарий для заведующего гаражом",
    );

    if (comment === null) {
      return;
    }

    try {
      await sendTransportToGarageManager(request.id, comment);
      onSuccess(
        `Заявка ${request.requestNumber} отправлена заведующему гаражом`,
      );
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

  async function deleteInvoiceFromRequest(
    request: SupplyRequest,
    invoiceId: string,
  ) {
    const isConfirmed = window.confirm("Удалить прикрепленный счет?");

    if (!isConfirmed) {
      return;
    }

    try {
      await deleteSupplyRequestInvoice(request.id, invoiceId);
      onSuccess(`!G5B C40;5= 87 70O2:8 ${request.requestNumber}`);
      await loadRequests();
    } catch (error) {
      onError(error);
    }
  }

  async function submitInvoicesBySupply(
    request: SupplyRequest,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const files = Array.from(
      (form.get("files") as File | null)
        ? ((event.currentTarget.elements.namedItem("files") as HTMLInputElement)
            .files ?? [])
        : [],
    );

    if (!files.length) {
      onError("Прикрепите хотя бы один счет на оплату");
      return;
    }

    try {
      await attachInvoicesAndSendToDirector(request.id, {
        comment: String(form.get("comment") ?? ""),
        files,
      });

      onSuccess(`Заявка ${request.requestNumber} отправлена директору`);
      await loadRequests();
    } catch (error) {
      onError(error);
    }
  }

  async function completeBySupply(request: SupplyRequest) {
    const comment = window.prompt("Комментарий для кладовщика");

    if (comment === null) {
      return;
    }

    try {
      await completeSupplyRequest(request.id, comment);
      onSuccess(`Заявка ${request.requestNumber} отправлена кладовщику`);
      await loadRequests();
    } catch (error) {
      onError(error);
    }
  }

  async function completeByStorekeeper(
    request: SupplyRequest,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const completedItemIds = form
      .getAll("completedItemIds")
      .map((itemId) => String(itemId));

    try {
      await completeSupplyRequestByStorekeeper(request.id, {
        comment: String(form.get("comment") ?? ""),
        completedItemIds,
      });
      onSuccess(`Заявка ${request.requestNumber} отмечена как исполненная`);
      await loadRequests();
    } catch (error) {
      onError(error);
    }
  }

  async function sendMoneyBySupply(
    request: SupplyRequest,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    try {
      await sendMoneyRequestToDirector(
        request.id,
        String(form.get("comment") ?? ""),
      );

      onSuccess(`Заявка ${request.requestNumber} отправлена директору`);
      await loadRequests();
    } catch (error) {
      onError(error);
    }
  }

  async function completeByGarageManager(request: SupplyRequest) {
    const comment = window.prompt("Комментарий для автора заявки");

    if (comment === null) {
      return;
    }

    try {
      await completeTransportByGarageManager(request.id, comment);
      onSuccess(
        `Заявка ${request.requestNumber} отправлена автору на подтверждение`,
      );
      await loadRequests();
    } catch (error) {
      onError(error);
    }
  }

  async function completeTransportByRequestAuthor(request: SupplyRequest) {
    const comment = window.prompt("Комментарий к подтверждению исполнения");

    if (comment === null) {
      return;
    }

    try {
      await completeTransportByAuthor(request.id, comment);
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

  async function returnByDirector(request: SupplyRequest) {
    const comment = window.prompt("Комментарий к возврату заявки снабженцу");

    if (comment === null) {
      return;
    }

    try {
      await returnSupplyRequestToSupplyByDirector(request.id, comment);
      onSuccess(`Заявка ${request.requestNumber} возвращена снабженцу`);
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

        {visibleRequestGroups.map((group) => (
          <ObjectApprovalGroup group={group} key={group.objectId}>
            {group.requests.map((request) => {
              const objectRole = getObjectRole(objectAccesses, request.objectId);

              if (
                request.type === "TRANSPORT" &&
                request.status === "PENDING_TRANSPORT_AUTHOR" &&
                request.authorId === user.id
              ) {
                return (
                  <TransportAuthorCompletionCard
                    key={request.id}
                    request={request}
                    onComplete={completeTransportByRequestAuthor}
                  />
                );
              }

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

              if (objectRole === "WAREHOUSE_MANAGER") {
                return (
                  <WarehouseManagerRequestCard
                    key={request.id}
                    request={request}
                    onApprove={approveByWarehouseManager}
                    onDeleteItem={deleteRequestItemFromRequest}
                    onUpdateItem={updateRequestItemQuantity}
                  />
                );
              }

              if (objectRole === "DEPUTY_PRODUCTION_DIRECTOR") {
                return (
                  <DeputyProductionDirectorRequestCard
                    key={request.id}
                    request={request}
                    onApprove={approveByDeputyProductionDirector}
                    onDeleteItem={deleteRequestItemFromRequest}
                    onReject={rejectByDeputyProductionDirector}
                    onUpdateItem={updateRequestItemQuantity}
                  />
                );
              }

              if (objectRole === "SUPPLY_MANAGER") {
                if (request.type === "TRANSPORT") {
                  return (
                    <SupplyManagerTransportRequestCard
                      key={request.id}
                      request={request}
                      onSendToGarage={sendToGarageBySupplyManager}
                    />
                  );
                }

                return (
                  <SupplyManagerRequestCard
                    key={request.id}
                    request={request}
                    supplyUsers={getSupplyUsersForRequest(objectAccesses, request)}
                    onSubmit={assignBySupplyManager}
                  />
                );
              }

              if (objectRole === "GARAGE_MANAGER") {
                return (
                  <GarageManagerTransportRequestCard
                    key={request.id}
                    request={request}
                    onComplete={completeByGarageManager}
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
                      onSubmit={submitInvoicesBySupply}
                    />
                  );
                }

                return request.type === "MONEY" ? (
                  <SupplyMoneyRequestCard
                    key={request.id}
                    request={request}
                    onSubmit={sendMoneyBySupply}
                  />
                ) : (
                <SupplyRequestCard
                  key={request.id}
                  request={request}
                  onDeleteInvoice={deleteInvoiceFromRequest}
                  onSubmit={submitInvoicesBySupply}
                />
                );
              }

              if (objectRole === "STOREKEEPER") {
                return (
                  <StorekeeperRequestCard
                    key={request.id}
                    request={request}
                    onComplete={completeByStorekeeper}
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
                    onReturn={returnByDirector}
                    onUpdateItem={updateRequestItemQuantity}
                  />
                );
              }

              return null;
            })}
          </ObjectApprovalGroup>
        ))}
      </div>
    </section>
  );
}

function getVisibleRequests(
  objectAccesses: UserObjectAccess[],
  requests: SupplyRequest[],
  userId: string,
) {
  return requests.filter((request) => {
    const objectRole = getObjectRole(objectAccesses, request.objectId);

    if (
      request.type === "TRANSPORT" &&
      request.status === "PENDING_TRANSPORT_AUTHOR" &&
      request.authorId === userId
    ) {
      return true;
    }

    if (objectRole === "PTO") {
      return request.type === "MATERIAL" && request.status === "PENDING_PTO";
    }

    if (objectRole === "CHIEF_ENGINEER") {
      return request.status === "PENDING_CHIEF_ENGINEER";
    }

    if (objectRole === "WAREHOUSE_MANAGER") {
      return (
        request.type === "MATERIAL" &&
        request.status === "PENDING_WAREHOUSE_MANAGER"
      );
    }

    if (objectRole === "DEPUTY_PRODUCTION_DIRECTOR") {
      return request.status === "PENDING_DEPUTY_PRODUCTION_DIRECTOR";
    }

    if (objectRole === "GARAGE_MANAGER") {
      return (
        request.type === "TRANSPORT" &&
        request.status === "PENDING_GARAGE_MANAGER"
      );
    }

    if (objectRole === "SUPPLY_MANAGER") {
      return (
        (request.type === "MATERIAL" || request.type === "MONEY") &&
        request.status === "PENDING_SUPPLY_MANAGER"
      );
    }

    if (objectRole === "SUPPLY") {
      return (
        (request.type === "MATERIAL" || request.type === "MONEY") &&
        request.assignedSupplyUserId === userId &&
        (request.status === "PENDING_SUPPLY" ||
          request.status === "RETURNED_TO_SUPPLY" ||
          request.status === "IN_PROGRESS")
      );
    }

    if (objectRole === "STOREKEEPER") {
      return (
        request.type === "MATERIAL" &&
        request.status === "PENDING_STOREKEEPER"
      );
    }

    if (objectRole === "DIRECTOR") {
      return (
        (request.type === "MATERIAL" || request.type === "MONEY") &&
        request.status === "PENDING_DIRECTOR"
      );
    }

    return false;
  });
}

function groupRequestsByObject(requests: SupplyRequest[]): ObjectRequestGroup[] {
  const groups = new Map<string, ObjectRequestGroup>();

  requests.forEach((request) => {
    const currentGroup = groups.get(request.objectId);
    const positionsCount = getRequestApprovalPositionsCount(request);

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

function getRequestApprovalPositionsCount(request: SupplyRequest) {
  return request.type === "MATERIAL" ? request.items.length : 1;
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
