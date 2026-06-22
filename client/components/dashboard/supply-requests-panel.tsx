"use client";

import { RefreshCcw } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import {
  AccountantRequestCard,
  ChiefEngineerRequestCard,
  DeputyProductionAssignmentCard,
  DeputyProductionDirectorRequestCard,
  DirectorRequestCard,
  GarageManagerTransportRequestCard,
  ObjectApprovalGroup,
  PtoRequestCard,
  SimpleApprovalCard,
  SupplyInProgressCard,
  SupplyManagerRequestCard,
  SupplyManagerReviewCard,
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
  approveSupplyRequestByDeputyTransportDirector,
  approveSupplyRequestByDirector,
  approveSupplyRequestByPto,
  approveSupplyRequestBySupply,
  approveSupplyRequestByTransportSupply,
  approveSupplyRequestByWarehouseManager,
  approveSupplyRequestByWorkshopManager,
  approveSupplyRequestByAccountant,
  approveQuarryBySupply,
  archiveSupplyRequestByDirector,
  assignWorkshopManager,
  assignSupplyRequest,
  attachInvoicesAndSendToDirector,
  attachInvoicesBySupplyManager,
  completeTransportByAuthor,
  completeQuarryByAuthor,
  completeProductionByAuthor,
  completeTransportByGarageManager,
  completeSupplyRequest,
  completeSupplyRequestByAuthor,
  completeSupplyRequestByStorekeeper,
  deleteSupplyRequestInvoice,
  deleteSupplyRequestItem,
  getSupplyRequests,
  rejectSupplyRequestToPreviousStep,
  sendMaterialToDirectorBySupplyManager,
  sendTransportToGarageManager,
  updateSupplyRequestItem,
} from "@/lib/supply-requests-api";
import { SupplyRequest, User, UserObjectAccess, UserRole } from "@/lib/types";

type SupplyRequestsPanelProps = {
  objectAccesses: UserObjectAccess[];
  user: User;
  onError: (error: unknown) => void;
  onSuccess: (message: string) => void;
};

const measurementUnitOptions = [
  "шт.",
  "уп.",
  "м",
  "м²",
  "м³",
  "пог. м",
  "лит.",
  "кг",
  "т",
];

type PendingMeasurementUnitEdit = {
  item: SupplyRequest["items"][number];
  request: SupplyRequest;
};

export function SupplyRequestsPanel({
  objectAccesses,
  user,
  onError,
  onSuccess,
}: SupplyRequestsPanelProps) {
  const [requests, setRequests] = useState<SupplyRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingMeasurementUnitEdit, setPendingMeasurementUnitEdit] =
    useState<PendingMeasurementUnitEdit | null>(null);

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

  async function submitPtoApproval(
    request: SupplyRequest,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    try {
      await approveSupplyRequestByPto(
        request.id,
        String(form.get("comment") ?? ""),
      );

      onSuccess(`Заявка ${request.requestNumber} согласована ПТО`);
      await loadRequests();
    } catch (error) {
      onError(error);
    }
  }

  async function approveByPto(request: SupplyRequest) {
    const comment = window.prompt("Комментарий ПТО");

    if (comment === null) {
      return;
    }

    try {
      await approveSupplyRequestByPto(request.id, comment);
      onSuccess(`Заявка ${request.requestNumber} согласована ПТО`);
      await loadRequests();
    } catch (error) {
      onError(error);
    }
  }

  async function approveByChiefEngineer(request: SupplyRequest) {
    try {
      await approveSupplyRequestByChiefEngineer(request.id);
      onSuccess(
        `Заявка ${request.requestNumber} отправлена`,
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
        request.object?.type === "WORKSHOP"
          ? `Заявка ${request.requestNumber} отправлена`
          : `Заявка ${request.requestNumber} отправлена`,
      );
      await loadRequests();
    } catch (error) {
      onError(error);
    }
  }

  async function rejectToPreviousStep(request: SupplyRequest) {
    const comment = window.prompt("Комментарий к отклонению заявки");

    if (comment === null) {
      return;
    }

    if (!comment.trim()) {
      onError("Комментарий обязателен для отклонения заявки");
      return;
    }

    try {
      await rejectSupplyRequestToPreviousStep(request.id, comment);
      onSuccess(`Заявка ${request.requestNumber} отправлена на предыдущий этап`);
      await loadRequests();
    } catch (error) {
      onError(error);
    }
  }

  async function approveByDeputyProductionDirector(request: SupplyRequest) {
    try {
      await approveSupplyRequestByDeputyProductionDirector(request.id);
      onSuccess(
        `Заявка ${request.requestNumber} отправлена`,
      );
      await loadRequests();
    } catch (error) {
      onError(error);
    }
  }

  async function assignByDeputyProductionDirector(
    request: SupplyRequest,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    try {
      await assignWorkshopManager(request.id, {
        workshopManagerId: String(form.get("workshopManagerId")),
        comment: String(form.get("comment") ?? ""),
      });
      onSuccess(`Заявка ${request.requestNumber} назначена начальнику цеха`);
      await loadRequests();
    } catch (error) {
      onError(error);
    }
  }

  async function approveByDeputyTransportDirector(request: SupplyRequest) {
    try {
      await approveSupplyRequestByDeputyTransportDirector(request.id);
      onSuccess(`Заявка ${request.requestNumber} подтверждена`);
      await loadRequests();
    } catch (error) {
      onError(error);
    }
  }

  async function approveByAccountant(request: SupplyRequest) {
    try {
      await approveSupplyRequestByAccountant(request.id);
      onSuccess(`Заявка ${request.requestNumber} согласована`);
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

  async function approveBySupplyManagerReview(request: SupplyRequest) {
    const comment = window.prompt("Комментарий начальника снабжения");

    if (comment === null) {
      return;
    }

    try {
      await sendMaterialToDirectorBySupplyManager(request.id, comment);
      onSuccess(`Заявка ${request.requestNumber} согласована`);
      await loadRequests();
    } catch (error) {
      onError(error);
    }
  }

  async function updateRequestItemQuantity(
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    field: "orderQuantity" | "quantity" | "stockQuantity" = "quantity",
  ) {
    const fieldLabel =
      field === "stockQuantity"
        ? "количество на складе"
        : "количество";
    const currentValue =
      field === "stockQuantity"
        ? String(item.stockQuantity ?? "0")
        : field === "orderQuantity"
          ? String(item.orderQuantity ?? item.quantity)
          : String(item.quantity);
    const quantity = window.prompt(
      `Новое ${fieldLabel} для "${item.materialNameSnapshot}"`,
      currentValue,
    );

    if (quantity === null) {
      return;
    }

    const minValue = field === "quantity" ? 0 : -1;

    if (!quantity.trim() || Number(quantity) <= minValue) {
      onError(
        field === "quantity"
          ? "Количество должно быть больше нуля"
          : "Количество должно быть больше или равно нулю",
      );
      return;
    }

    if (
      field !== "quantity" &&
      request.status !== "PENDING_WAREHOUSE_MANAGER"
    ) {
      onError("Складские количества может менять только заведующий складом");
      return;
    }

    const comment =
      field === "quantity"
        ? (window.prompt("Комментарий к изменению позиции") ?? "")
        : "";

    try {
      await updateSupplyRequestItem(request.id, item.id, {
        [field]: quantity,
        comment,
      });
      onSuccess(`Позиция в заявке ${request.requestNumber} изменена`);
      await loadRequests();
    } catch (error) {
      onError(error);
    }
  }

  async function updateRequestItemTextField(
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    field: "materialName" | "measurementUnit",
  ) {
    if (field === "measurementUnit") {
      setPendingMeasurementUnitEdit({ item, request });
      return;
    }

    const fieldLabel =
      field === "materialName" ? "наименование" : "единицу измерения";
    const currentValue =
      field === "materialName"
        ? item.materialNameSnapshot
        : item.measurementUnitSnapshot;
    const nextValue = window.prompt(
      `Введите новое ${fieldLabel} для "${item.materialNameSnapshot}"`,
      currentValue,
    );

    if (nextValue === null) {
      return;
    }

    if (!nextValue.trim()) {
      onError(
        field === "materialName"
          ? "Наименование не может быть пустым"
          : "Единица измерения не может быть пустой",
      );
      return;
    }

    try {
      await updateSupplyRequestItem(request.id, item.id, {
        [field]: nextValue.trim(),
        comment:
          field === "materialName"
            ? "Изменено наименование позиции"
            : "Изменена единица измерения позиции",
      });
      onSuccess(`Позиция в заявке ${request.requestNumber} изменена`);
      await loadRequests();
    } catch (error) {
      onError(error);
    }
  }

  async function submitMeasurementUnitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!pendingMeasurementUnitEdit) {
      return;
    }

    const form = new FormData(event.currentTarget);
    const measurementUnit = String(form.get("measurementUnit") ?? "").trim();

    if (!measurementUnit) {
      onError("Выберите единицу измерения");
      return;
    }

    try {
      await updateSupplyRequestItem(
        pendingMeasurementUnitEdit.request.id,
        pendingMeasurementUnitEdit.item.id,
        {
          measurementUnit,
          comment: "Изменена единица измерения позиции",
        },
      );
      onSuccess(
        `Позиция в заявке ${pendingMeasurementUnitEdit.request.requestNumber} изменена`,
      );
      setPendingMeasurementUnitEdit(null);
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

  async function updateSupplyManagerItemComment(
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    supplyManagerComment: string,
  ) {
    try {
      await updateSupplyRequestItem(request.id, item.id, {
        supplyManagerComment,
      });
      onSuccess("Комментарий начальника снабжения к позиции сохранен");
      await loadRequests();
    } catch (error) {
      onError(error);
    }
  }

  async function updateSupplierItemComment(
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    supplierComment: string,
  ) {
    try {
      await updateSupplyRequestItem(request.id, item.id, {
        supplierComment,
      });
      onSuccess("Комментарий снабженца к позиции сохранен");
      await loadRequests();
    } catch (error) {
      onError(error);
    }
  }

  async function updatePtoItemComment(
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    ptoComment: string,
  ) {
    try {
      await updateSupplyRequestItem(request.id, item.id, {
        ptoComment,
      });
      onSuccess("Комментарий ПТО к позиции сохранен");
      await loadRequests();
    } catch (error) {
      onError(error);
    }
  }

  async function updateChiefEngineerItemComment(
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    chiefEngineerComment: string,
  ) {
    try {
      await updateSupplyRequestItem(request.id, item.id, {
        chiefEngineerComment,
      });
      onSuccess("Комментарий главного инженера к позиции сохранен");
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

    try {
      if (request.type === "MATERIAL") {
        await Promise.all(
          request.items.map((item) => {
            const cashPaidAmount = String(
              form.get(`cashPaidAmount:${item.id}`) ?? "",
            ).trim();
            const cashPaymentComment = String(
              form.get(`cashPaymentComment:${item.id}`) ?? "",
            ).trim();

            const currentCashPaidAmount = String(
              item.cashPaidAmount ?? "",
            ).trim();
            const currentCashPaymentComment = String(
              item.cashPaymentComment ?? "",
            ).trim();

            if (
              cashPaidAmount === currentCashPaidAmount &&
              cashPaymentComment === currentCashPaymentComment
            ) {
              return Promise.resolve();
            }

            return updateSupplyRequestItem(request.id, item.id, {
              cashPaidAmount: cashPaidAmount || "0",
              cashPaymentComment,
            });
          }),
        );
      }

      if (request.type === "QUARRY") {
        await approveQuarryBySupply(
          request.id,
          String(form.get("comment") ?? ""),
        );
      } else {
        await attachInvoicesAndSendToDirector(request.id, {
          comment: String(form.get("comment") ?? ""),
          files,
        });
      }

      onSuccess(
        request.type === "QUARRY"
          ? `Заявка ${request.requestNumber} отправлена`
          : `Заявка ${request.requestNumber} отправлена`,
      );
      await loadRequests();
    } catch (error) {
      onError(error);
    }
  }

  async function submitInvoicesBySupplyManager(
    request: SupplyRequest,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const filesInput = formElement.elements.namedItem(
      "files",
    ) as HTMLInputElement | null;
    const files = Array.from(filesInput?.files ?? []);

    if (!files.length) {
      onError("Прикрепите хотя бы один счет");
      return;
    }

    try {
      await attachInvoicesBySupplyManager(request.id, {
        comment: String(form.get("comment") ?? ""),
        files,
      });
      formElement.reset();
      onSuccess(`Счета прикреплены к заявке ${request.requestNumber}`);
      await loadRequests();
    } catch (error) {
      onError(error);
    }
  }

  async function completeBySupply(
    request: SupplyRequest,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const storekeeperUserId = String(form.get("storekeeperUserId") ?? "");

    if (!storekeeperUserId) {
      onError("Выберите кладовщика");
      return;
    }

    try {
      await completeSupplyRequest(request.id, {
        comment: String(form.get("comment") ?? ""),
        storekeeperUserId,
      });
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

    if (completedItemIds.length < request.items.length) {
      const isConfirmed = window.confirm(
        "Вы уверены, что хотите согласовать заявку неполной?",
      );

      if (!isConfirmed) {
        return;
      }
    }

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

  async function approveBySupplyWithoutInvoices(
    request: SupplyRequest,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    try {
      await approveSupplyRequestBySupply(
        request.id,
        String(form.get("comment") ?? ""),
      );

      onSuccess(`Заявка ${request.requestNumber} отмечена как исполненная`);
      await loadRequests();
    } catch (error) {
      onError(error);
    }
  }

  async function approveQuarryBySupplyUser(request: SupplyRequest) {
    const comment = window.prompt("Комментарий снабжения");

    if (comment === null) {
      return;
    }

    try {
      await approveQuarryBySupply(request.id, comment);
      onSuccess(
        `Заявка ${request.requestNumber} отправлена заведующему гаражом`,
      );
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

  async function approveByTransportSupply(request: SupplyRequest) {
    const comment = window.prompt("Комментарий транспортного снабженца");

    if (comment === null) {
      return;
    }

    try {
      await approveSupplyRequestByTransportSupply(request.id, comment);
      onSuccess(
        `Заявка ${request.requestNumber} отправлена автору на подтверждение`,
      );
      await loadRequests();
    } catch (error) {
      onError(error);
    }
  }

  async function completeByRequestAuthor(request: SupplyRequest) {
    const comment = window.prompt("Комментарий к подтверждению получения");

    if (comment === null) {
      return;
    }

    try {
      await completeSupplyRequestByAuthor(request.id, comment);
      onSuccess(`Заявка ${request.requestNumber} отмечена как исполненная`);
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
      if (request.type === "QUARRY") {
        await completeQuarryByAuthor(request.id, comment);
      } else {
        await completeTransportByAuthor(request.id, comment);
      }
      onSuccess(`Заявка ${request.requestNumber} отмечена как исполненная`);
      await loadRequests();
    } catch (error) {
      onError(error);
    }
  }

  async function approveByWorkshopManager(request: SupplyRequest) {
    const comment = window.prompt("Комментарий начальника цеха");

    if (comment === null) {
      return;
    }

    try {
      await approveSupplyRequestByWorkshopManager(request.id, comment);
      onSuccess(`Заявка ${request.requestNumber} отправлена автору`);
      await loadRequests();
    } catch (error) {
      onError(error);
    }
  }

  async function archiveByDirector(request: SupplyRequest) {
    const isConfirmed = window.confirm(
      `Удалить заявку ${request.requestNumber}? Она исчезнет из банка заявок, но останется в исполненных заявках.`,
    );

    if (!isConfirmed) {
      return;
    }

    const comment = window.prompt("Комментарий к удалению заявки") ?? "";

    try {
      await archiveSupplyRequestByDirector(request.id, comment);
      onSuccess(`Заявка ${request.requestNumber} удалена`);
      await loadRequests();
    } catch (error) {
      onError(error);
    }
  }

  async function completeProductionByRequestAuthor(request: SupplyRequest) {
    const comment = window.prompt("Комментарий к закрытию заявки");

    if (comment === null) {
      return;
    }

    try {
      await completeProductionByAuthor(request.id, comment);
      onSuccess(`Заявка ${request.requestNumber} закрыта`);
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

  return (
    <>
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
                (request.type === "TRANSPORT" || request.type === "QUARRY") &&
                request.status === "PENDING_TRANSPORT_AUTHOR" &&
                request.authorId === user.id
              ) {
                return (
                  <TransportAuthorCompletionCard
                    key={request.id}
                    request={request}
                    onComplete={completeTransportByRequestAuthor}
                    onReject={rejectToPreviousStep}
                  />
                );
              }

              if (
                request.type === "PRODUCTION" &&
                request.status === "PENDING_PRODUCTION_AUTHOR" &&
                request.authorId === user.id
              ) {
                return (
                  <SimpleApprovalCard
                    key={request.id}
                    request={request}
                    onApprove={completeProductionByRequestAuthor}
                    onReject={rejectToPreviousStep}
                  />
                );
              }

              if (
                request.status === "PENDING_REQUEST_AUTHOR" &&
                request.authorId === user.id
              ) {
                return (
                  <SimpleApprovalCard
                    key={request.id}
                    request={request}
                    onApprove={completeByRequestAuthor}
                    onReject={rejectToPreviousStep}
                  />
                );
              }

              if (objectRole === "PTO") {
                if (request.type !== "MATERIAL") {
                  return (
                    <SimpleApprovalCard
                      key={request.id}
                      request={request}
                      onApprove={approveByPto}
                      onReject={rejectToPreviousStep}
                    />
                  );
                }

                return (
                  <PtoRequestCard
                    key={request.id}
                    request={request}
                    onDeleteItem={deleteRequestItemFromRequest}
                    onReject={rejectToPreviousStep}
                    onUpdatePtoComment={updatePtoItemComment}
                    onUpdateItem={updateRequestItemQuantity}
                    onUpdateTextField={updateRequestItemTextField}
                    onSubmit={submitPtoApproval}
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
                    onReturn={rejectToPreviousStep}
                    onUpdateChiefEngineerComment={updateChiefEngineerItemComment}
                    onUpdateItem={updateRequestItemQuantity}
                    onUpdateTextField={updateRequestItemTextField}
                  />
                );
              }

              if (objectRole === "WAREHOUSE_MANAGER") {
                return (
                  <WarehouseManagerRequestCard
                    key={request.id}
                    request={request}
                    onApprove={approveByWarehouseManager}
                    onReject={rejectToPreviousStep}
                    onUpdateItem={updateRequestItemQuantity}
                  />
                );
              }

              if (objectRole === "DEPUTY_PRODUCTION_DIRECTOR") {
                if (request.type === "PRODUCTION") {
                  return (
                    <DeputyProductionAssignmentCard
                      key={request.id}
                      request={request}
                      workshopManagers={getWorkshopManagersForRequest(
                        objectAccesses,
                        request,
                      )}
                      onReject={rejectToPreviousStep}
                      onSubmit={assignByDeputyProductionDirector}
                    />
                  );
                }

                return (
                  <DeputyProductionDirectorRequestCard
                    key={request.id}
                    request={request}
                    onApprove={approveByDeputyProductionDirector}
                    onDeleteItem={deleteRequestItemFromRequest}
                    onReject={rejectToPreviousStep}
                    onUpdateItem={updateRequestItemQuantity}
                    onUpdateTextField={updateRequestItemTextField}
                  />
                );
              }

              if (objectRole === "DEPUTY_TRANSPORT_DIRECTOR") {
                return (
                  <DeputyProductionDirectorRequestCard
                    key={request.id}
                    request={request}
                    onApprove={approveByDeputyTransportDirector}
                    onDeleteItem={deleteRequestItemFromRequest}
                    onReject={rejectToPreviousStep}
                    onUpdateItem={updateRequestItemQuantity}
                    onUpdateTextField={updateRequestItemTextField}
                  />
                );
              }

              if (objectRole === "SUPPLY_MANAGER") {
                if (request.status === "PENDING_SUPPLY_MANAGER_REVIEW") {
                  return (
                    <SupplyManagerReviewCard
                      key={request.id}
                      request={request}
                      checklistStorageScope={user.id}
                      onAttachInvoices={submitInvoicesBySupplyManager}
                      onApprove={approveBySupplyManagerReview}
                      onReject={rejectToPreviousStep}
                      onUpdateSupplyManagerComment={updateSupplyManagerItemComment}
                      onUpdateItem={updateRequestItemQuantity}
                      onUpdateTextField={updateRequestItemTextField}
                    />
                  );
                }

                return (
                  <SupplyManagerRequestCard
                    key={request.id}
                    request={request}
                    checklistStorageScope={user.id}
                    supplyUsers={getSupplyUsersForRequest(objectAccesses, request)}
                    onAttachInvoices={submitInvoicesBySupplyManager}
                    onReject={rejectToPreviousStep}
                    onSubmit={assignBySupplyManager}
                    onUpdateSupplyManagerComment={updateSupplyManagerItemComment}
                    onUpdateItem={updateRequestItemQuantity}
                    onUpdateTextField={updateRequestItemTextField}
                  />
                );
              }

              if (objectRole === "ACCOUNTANT") {
                return (
                  <AccountantRequestCard
                    key={request.id}
                    request={request}
                    onApprove={approveByAccountant}
                    onReject={rejectToPreviousStep}
                    onUpdateItem={updateRequestItemQuantity}
                    onUpdateTextField={updateRequestItemTextField}
                  />
                );
              }

              if (objectRole === "GARAGE_MANAGER") {
                return (
                  <GarageManagerTransportRequestCard
                    key={request.id}
                    request={request}
                    onComplete={completeByGarageManager}
                    onReject={rejectToPreviousStep}
                    onUpdateItem={updateRequestItemQuantity}
                    onUpdateTextField={updateRequestItemTextField}
                  />
                );
              }

              if (objectRole === "TRANSPORT_SUPPLY") {
                return (
                  <SimpleApprovalCard
                    key={request.id}
                    request={request}
                    onApprove={approveByTransportSupply}
                    onReject={rejectToPreviousStep}
                    onUpdateItem={updateRequestItemQuantity}
                    onUpdateTextField={updateRequestItemTextField}
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
                      onReject={rejectToPreviousStep}
                      storekeepers={getStorekeepersForRequest(
                        objectAccesses,
                        request,
                      )}
                    />
                  );
                }

                return request.type === "MONEY" ||
                  request.type === "TRANSPORT" ||
                  request.type === "FUEL" ||
                  request.type === "BUSINESS_TRIP" ||
                  request.type === "PRODUCTION" ||
                  request.type === "APPEAL" ? (
                  <SupplyMoneyRequestCard
                    key={request.id}
                    request={request}
                    onReject={rejectToPreviousStep}
                    onSubmit={approveBySupplyWithoutInvoices}
                  />
                ) : (
                <SupplyRequestCard
                  key={request.id}
                  request={request}
                  checklistStorageScope={user.id}
                  onDeleteInvoice={deleteInvoiceFromRequest}
                  onReject={rejectToPreviousStep}
                  onSubmit={submitInvoicesBySupply}
                  onUpdateSupplierComment={updateSupplierItemComment}
                  onUpdateItem={updateRequestItemQuantity}
                  onUpdateTextField={updateRequestItemTextField}
                />
                );
              }

              if (objectRole === "STOREKEEPER") {
                return (
                  <StorekeeperRequestCard
                    key={request.id}
                    request={request}
                    onComplete={completeByStorekeeper}
                    onReject={rejectToPreviousStep}
                    onUpdateItem={updateRequestItemQuantity}
                    onUpdateTextField={updateRequestItemTextField}
                  />
                );
              }

              if (objectRole === "WORKSHOP_MANAGER") {
                return (
                  <SimpleApprovalCard
                    key={request.id}
                    request={request}
                    onApprove={approveByWorkshopManager}
                    onReject={rejectToPreviousStep}
                  />
                );
              }

              if (objectRole === "DIRECTOR") {
                return (
                  <DirectorRequestCard
                    key={request.id}
                    request={request}
                    onApprove={approveByDirector}
                    onArchive={archiveByDirector}
                    onDeleteItem={deleteRequestItemFromRequest}
                    onReject={rejectToPreviousStep}
                    onUpdateItem={updateRequestItemQuantity}
                    onUpdateTextField={updateRequestItemTextField}
                  />
                );
              }

              return null;
            })}
          </ObjectApprovalGroup>
        ))}
      </div>
    </section>
    {pendingMeasurementUnitEdit ? (
      <MeasurementUnitEditModal
        item={pendingMeasurementUnitEdit.item}
        onClose={() => setPendingMeasurementUnitEdit(null)}
        onSubmit={submitMeasurementUnitEdit}
      />
    ) : null}
    </>
  );
}

function MeasurementUnitEditModal({
  item,
  onClose,
  onSubmit,
}: {
  item: SupplyRequest["items"][number];
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const defaultValue = measurementUnitOptions.includes(
    item.measurementUnitSnapshot,
  )
    ? item.measurementUnitSnapshot
    : measurementUnitOptions[0];

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4"
      role="dialog"
    >
      <form
        className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl"
        onSubmit={onSubmit}
      >
        <div>
          <h3 className="font-semibold text-slate-950">
            Изменить единицу измерения
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            {item.materialNameSnapshot}
          </p>
        </div>

        <label className="mt-4 grid gap-1.5">
          <span className="text-sm font-medium text-slate-700">
            Единица измерения
          </span>
          <select
            className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-teal-700"
            defaultValue={defaultValue}
            name="measurementUnit"
            required
          >
            {measurementUnitOptions.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-4 flex justify-end gap-2">
          <button
            className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={onClose}
            type="button"
          >
            Отмена
          </button>
          <button
            className="inline-flex h-10 items-center justify-center rounded-md bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800"
            type="submit"
          >
            Сохранить
          </button>
        </div>
      </form>
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

    if (
      (request.type === "TRANSPORT" || request.type === "QUARRY") &&
      request.status === "PENDING_TRANSPORT_AUTHOR" &&
      request.authorId === userId
    ) {
      return true;
    }

    if (
      request.type === "PRODUCTION" &&
      request.status === "PENDING_PRODUCTION_AUTHOR" &&
      request.authorId === userId
    ) {
      return true;
    }

    if (
      request.status === "PENDING_REQUEST_AUTHOR" &&
      request.authorId === userId
    ) {
      return true;
    }

    if (objectRole === "PTO") {
      return request.status === "PENDING_PTO";
    }

    if (objectRole === "CHIEF_ENGINEER") {
      return request.status === "PENDING_CHIEF_ENGINEER";
    }

    if (objectRole === "WAREHOUSE_MANAGER") {
      return request.status === "PENDING_WAREHOUSE_MANAGER";
    }

    if (objectRole === "DEPUTY_PRODUCTION_DIRECTOR") {
      return request.status === "PENDING_DEPUTY_PRODUCTION_DIRECTOR";
    }

    if (objectRole === "WORKSHOP_MANAGER") {
      return (
        request.type === "PRODUCTION" &&
        request.status === "PENDING_WORKSHOP_MANAGER" &&
        request.assignedWorkshopManagerId === userId
      );
    }

    if (objectRole === "DEPUTY_TRANSPORT_DIRECTOR") {
      return request.status === "PENDING_DEPUTY_TRANSPORT_DIRECTOR";
    }

    if (objectRole === "GARAGE_MANAGER") {
      return request.status === "PENDING_GARAGE_MANAGER";
    }

    if (objectRole === "TRANSPORT_SUPPLY") {
      return request.status === "PENDING_TRANSPORT_SUPPLY";
    }

    if (objectRole === "SUPPLY_MANAGER") {
      return (
        (request.status === "PENDING_SUPPLY_MANAGER" ||
          request.status === "PENDING_SUPPLY_MANAGER_REVIEW")
      );
    }

    if (objectRole === "ACCOUNTANT") {
      return request.status === "PENDING_ACCOUNTANT";
    }

    if (objectRole === "SUPPLY") {
      return (
        request.assignedSupplyUserId === userId &&
        (request.status === "PENDING_SUPPLY" ||
          request.status === "RETURNED_TO_SUPPLY" ||
          request.status === "IN_PROGRESS")
      );
    }

    if (objectRole === "STOREKEEPER") {
      return (
        request.type === "MATERIAL" &&
        request.status === "PENDING_STOREKEEPER" &&
        request.assignedStorekeeperId === userId
      );
    }

    if (objectRole === "DIRECTOR") {
      return request.status === "PENDING_DIRECTOR";
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
  return (
    request.type === "MATERIAL" ||
    request.type === "QUARRY" ||
    request.type === "EXPRESS_MATERIAL"
  )
    ? request.items.length
    : 1;
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

function getStorekeepersForRequest(
  objectAccesses: UserObjectAccess[],
  request: SupplyRequest,
) {
  const objectAccess = objectAccesses.find(
    (access) => access.objectId === request.objectId,
  );

  return (
    objectAccess?.object.userAccesses
      ?.filter((access) => access.role === "STOREKEEPER" && access.user)
      .map((access) => access.user as User) ?? []
  );
}

function getWorkshopManagersForRequest(
  objectAccesses: UserObjectAccess[],
  request: SupplyRequest,
) {
  const objectAccess = objectAccesses.find(
    (access) => access.objectId === request.objectId,
  );

  return (
    objectAccess?.object.userAccesses
      ?.filter((access) => access.role === "WORKSHOP_MANAGER" && access.user)
      .map((access) => access.user as User) ?? []
  );
}
