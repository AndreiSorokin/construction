"use client";

import { Check, Printer, X } from "lucide-react";
import { FormEvent, ReactNode, useEffect, useState } from "react";
import { RequestSummaryCard } from "@/components/dashboard/request-summary-card";
import { requestStatusLabels } from "@/lib/domain-labels";
import {
  downloadSupplyRequestInvoice,
  downloadSupplyRequestAttachment,
  getSupplyRequestAttachmentPreview,
  getSupplyRequestInvoicePreview,
} from "@/lib/supply-requests-api";
import {
  SupplyRequest,
  SupplyRequestAttachment,
  SupplyRequestInvoice,
  User,
} from "@/lib/types";

export type ObjectRequestGroup = {
  objectId: string;
  objectName: string;
  positionsCount: number;
  requests: SupplyRequest[];
};

const approvalActionsClass =
  "grid grid-cols-2 gap-1.5 sm:flex sm:flex-row sm:justify-end sm:gap-2 [&>button]:h-7 [&>button]:w-full [&>button]:min-w-0 [&>button]:gap-1 [&>button]:px-1 [&>button]:text-[10px] [&>button]:leading-none sm:[&>button]:h-10 sm:[&>button]:w-auto sm:[&>button]:gap-2 sm:[&>button]:px-3 sm:[&>button]:text-sm [&>button>svg]:size-3 sm:[&>button>svg]:size-4";

const approvalActionsWithMarginClass = `mt-4 ${approvalActionsClass}`;
const approvalCardClass =
  "min-w-0 max-w-full overflow-hidden rounded-md border border-slate-200 p-2 sm:p-4";
const limeApprovalCardClass =
  "min-w-0 max-w-full overflow-hidden rounded-md border border-lime-200 bg-lime-50/40 p-2 sm:p-4";
const emeraldApprovalCardClass =
  "min-w-0 max-w-full overflow-hidden rounded-md border border-emerald-200 bg-emerald-50/40 p-2 sm:p-4";
const stoneApprovalCardClass =
  "min-w-0 max-w-full overflow-hidden rounded-md border border-stone-200 bg-stone-50/50 p-2 sm:p-4";
const skyApprovalCardClass =
  "min-w-0 max-w-full overflow-hidden rounded-md border border-sky-200 bg-sky-50/30 p-2 sm:p-4";

export function ObjectApprovalGroup({
  children,
  countLabel = "Заявок на согласование",
  group,
}: {
  children: ReactNode;
  countLabel?: string;
  group: ObjectRequestGroup;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const createdAt = group.requests
    .map((request) => new Date(request.createdAt).getTime())
    .filter(Number.isFinite)
    .sort((firstDate, secondDate) => secondDate - firstDate)[0];

  return (
    <article className="min-w-0 max-w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <button
        className="grid w-full min-w-0 gap-3 px-3 py-3 text-left sm:grid-cols-[1fr_auto] sm:items-center sm:px-4"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <span className="min-w-0">
          <span className="block truncate font-medium text-slate-950">
            {group.objectName}
          </span>
          <span className="mt-1 block text-sm text-slate-500">
            {countLabel}: {group.requests.length}
          </span>
        </span>
        <div
          className="text-sm font-medium text-slate-600 transition-colors hover:text-teal-700"
          style={{ cursor: "pointer" }}
        >
          {isOpen ? "Свернуть" : "Развернуть"}
        </div>
      </button>

      <div
        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="grid min-w-0 gap-3 overflow-x-auto border-t border-slate-100 bg-slate-50/60 p-2 sm:p-3">
            {children}
          </div>
        </div>
      </div>
    </article>
  );
}

export function SupplyManagerRequestCard({
  onAttachInvoices,
  onSendToDirector,
  onUpdateSupplyManagerComment,
  onUpdateItem,
  onUpdateTextField,
  onReject,
  onSubmit,
  request,
  checklistStorageScope,
  supplyUsers,
}: {
  onAttachInvoices?: (
    request: SupplyRequest,
    event: FormEvent<HTMLFormElement>,
  ) => void;
  onSendToDirector?: (request: SupplyRequest) => void;
  onUpdateSupplyManagerComment: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    comment: string,
  ) => void;
  onUpdateItem?: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    field?: "orderQuantity" | "quantity" | "stockQuantity",
  ) => void;
  onUpdateTextField?: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    field: "materialName" | "measurementUnit",
  ) => void;
  onReject: (request: SupplyRequest) => void;
  onSubmit: (
    request: SupplyRequest,
    event: FormEvent<HTMLFormElement>,
  ) => void;
  request: SupplyRequest;
  checklistStorageScope: string;
  supplyUsers: User[];
}) {
  return (
    <div className={approvalCardClass}>
      <RequestSummaryCard request={request} variant="approval">
      <SupplyItemWorkTable
        checklistStorageScope={checklistStorageScope}
        commentField="supplyManagerComment"
        commentLabel="Комментарий начальника снабжения"
        request={request}
        onUpdateComment={onUpdateSupplyManagerComment}
        onUpdateItem={onUpdateItem}
        onUpdateTextField={onUpdateTextField}
      />
      <InvoiceList request={request} />
      {onAttachInvoices ? (
        <InvoiceUploadForm request={request} onSubmit={onAttachInvoices} />
      ) : null}
      <PrintRequestAction request={request} />
      <form
        className="mt-4 grid gap-3 rounded-md bg-slate-50 p-3"
        onSubmit={(event) => onSubmit(request, event)}
      >
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
        <div className={approvalActionsClass}>
          <button
            className="inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-md border border-red-200 bg-white px-1 py-1 text-[10px] font-medium leading-none text-red-700 hover:bg-red-50 [&_svg]:size-3 sm:h-10 sm:w-auto sm:gap-2 sm:px-3 sm:text-sm sm:[&_svg]:size-4"
            onClick={() => onReject(request)}
            type="button"
          >
            <X size={16} />
            Отклонить
          </button>
          {onSendToDirector ? (
            <button
              className="inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-md border border-teal-200 bg-white px-1 py-1 text-[10px] font-medium leading-none text-teal-700 hover:bg-teal-50 [&_svg]:size-3 sm:h-10 sm:w-auto sm:gap-2 sm:px-3 sm:text-sm sm:[&_svg]:size-4"
              onClick={() => onSendToDirector(request)}
              type="button"
            >
              <Check size={16} />
              Сразу директору
            </button>
          ) : null}
          <button
            className="inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-md bg-teal-700 px-1 py-1 text-[10px] font-medium leading-none text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300 [&_svg]:size-3 sm:h-10 sm:w-auto sm:gap-2 sm:px-3 sm:text-sm sm:[&_svg]:size-4"
            disabled={!supplyUsers.length}
            type="submit"
          >
            <Check size={16} />
            Согласовать
          </button>
        </div>
        {!supplyUsers.length ? (
          <div className="text-sm text-amber-700">
            На этом объекте пока нет пользователя с ролью снабженца.
          </div>
        ) : null}
      </form>
      </RequestSummaryCard>
    </div>
  );
}

export function SupplyManagerTransportRequestCard({
  onReject,
  onSendToGarage,
  request,
}: {
  onReject: (request: SupplyRequest) => void;
  onSendToGarage: (request: SupplyRequest) => void;
  request: SupplyRequest;
}) {
  return (
    <div className={approvalCardClass}>
      <RequestSummaryCard request={request} variant="approval">
        <TransportDetails request={request} />
        <div className={approvalActionsWithMarginClass}>
          <button
            className="inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-md border border-red-200 bg-white px-1 py-1 text-[10px] font-medium leading-none text-red-700 hover:bg-red-50 [&_svg]:size-3 sm:h-10 sm:w-auto sm:gap-2 sm:px-3 sm:text-sm sm:[&_svg]:size-4"
            onClick={() => onReject(request)}
            type="button"
          >
            <X size={16} />
            Отклонить
          </button>
          <button
            className="inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-md bg-teal-700 px-1 py-1 text-[10px] font-medium leading-none text-white hover:bg-teal-800 [&_svg]:size-3 sm:h-10 sm:w-auto sm:gap-2 sm:px-3 sm:text-sm sm:[&_svg]:size-4"
            onClick={() => onSendToGarage(request)}
            type="button"
          >
            <Check size={16} />
            Отправить в архив
          </button>
        </div>
      </RequestSummaryCard>
    </div>
  );
}

export function SimpleApprovalCard({
  onApprove,
  onReject,
  onUpdateItem,
  onUpdateTextField,
  request,
}: {
  onApprove: (request: SupplyRequest) => void;
  onReject: (request: SupplyRequest) => void;
  onUpdateItem?: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    field?: "orderQuantity" | "quantity" | "stockQuantity",
  ) => void;
  onUpdateTextField?: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    field: "materialName" | "measurementUnit",
  ) => void;
  request: SupplyRequest;
}) {
  return (
    <div className={approvalCardClass}>
      <RequestSummaryCard request={request} variant="approval">
        {isItemRequest(request) ? (
          <ItemReviewTable
            request={request}
            onUpdateItem={onUpdateItem}
            onUpdateTextField={onUpdateTextField}
          />
        ) : (
          <RequestDetails request={request} />
        )}
        <div className={approvalActionsWithMarginClass}>
          <button
            className="inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-md border border-red-200 bg-white px-1 py-1 text-[10px] font-medium leading-none text-red-700 hover:bg-red-50 [&_svg]:size-3 sm:h-10 sm:w-auto sm:gap-2 sm:px-3 sm:text-sm sm:[&_svg]:size-4"
            onClick={() => onReject(request)}
            type="button"
          >
            <X size={16} />
            Отклонить
          </button>
          <button
            className="inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-md bg-teal-700 px-1 py-1 text-[10px] font-medium leading-none text-white hover:bg-teal-800 [&_svg]:size-3 sm:h-10 sm:w-auto sm:gap-2 sm:px-3 sm:text-sm sm:[&_svg]:size-4"
            onClick={() => onApprove(request)}
            type="button"
          >
            <Check size={16} />
            Согласовать
          </button>
        </div>
      </RequestSummaryCard>
    </div>
  );
}

export function SupplyManagerReviewCard({
  onAttachInvoices,
  onApprove,
  onUpdateSupplyManagerComment,
  onUpdateItem,
  onUpdateTextField,
  onReject,
  request,
  checklistStorageScope,
}: {
  onAttachInvoices?: (
    request: SupplyRequest,
    event: FormEvent<HTMLFormElement>,
  ) => void;
  onApprove: (request: SupplyRequest) => void;
  onUpdateSupplyManagerComment: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    comment: string,
  ) => void;
  onUpdateItem?: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    field?: "orderQuantity" | "quantity" | "stockQuantity",
  ) => void;
  onUpdateTextField?: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    field: "materialName" | "measurementUnit",
  ) => void;
  onReject: (request: SupplyRequest) => void;
  request: SupplyRequest;
  checklistStorageScope: string;
}) {
  return (
    <div className={skyApprovalCardClass}>
      <RequestSummaryCard request={request} variant="approval">
        <SupplyItemWorkTable
          checklistStorageScope={checklistStorageScope}
          commentField="supplyManagerComment"
          commentLabel="Комментарий начальника снабжения"
          request={request}
          onUpdateComment={onUpdateSupplyManagerComment}
          onUpdateItem={onUpdateItem}
          onUpdateTextField={onUpdateTextField}
        />
        <InvoiceList request={request} />
        {onAttachInvoices ? (
          <InvoiceUploadForm request={request} onSubmit={onAttachInvoices} />
        ) : null}
        <PrintRequestAction request={request} />
        <div className={approvalActionsWithMarginClass}>
          <button
            className="inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-md border border-red-200 bg-white px-1 py-1 text-[10px] font-medium leading-none text-red-700 hover:bg-red-50 [&_svg]:size-3 sm:h-10 sm:w-auto sm:gap-2 sm:px-3 sm:text-sm sm:[&_svg]:size-4"
            onClick={() => onReject(request)}
            type="button"
          >
            <X size={16} />
            Отклонить
          </button>
          <button
            className="inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-md bg-teal-700 px-1 py-1 text-[10px] font-medium leading-none text-white hover:bg-teal-800 [&_svg]:size-3 sm:h-10 sm:w-auto sm:gap-2 sm:px-3 sm:text-sm sm:[&_svg]:size-4"
            onClick={() => onApprove(request)}
            type="button"
          >
            <Check size={16} />
            Согласовать
          </button>
        </div>
      </RequestSummaryCard>
    </div>
  );
}

export function DeputyProductionAssignmentCard({
  onReject,
  onSubmit,
  request,
  workshopManagers,
}: {
  onReject: (request: SupplyRequest) => void;
  onSubmit: (
    request: SupplyRequest,
    event: FormEvent<HTMLFormElement>,
  ) => void;
  request: SupplyRequest;
  workshopManagers: User[];
}) {
  return (
    <form
      className={approvalCardClass}
      onSubmit={(event) => onSubmit(request, event)}
    >
      <RequestSummaryCard request={request} variant="approval">
        <ProductionDetails request={request} />
        <div className="mt-4 grid gap-3 rounded-md bg-slate-50 p-3">
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-slate-700">
              Назначенный начальник цеха
            </span>
            <select
              className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-teal-700"
              name="workshopManagerId"
              required
            >
              <option value="">Выберите начальника цеха</option>
              {workshopManagers.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.name} ({manager.email})
                </option>
              ))}
            </select>
          </label>
          <input
            className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-teal-700"
            name="comment"
            placeholder="Комментарий зам. директора по производству"
          />
          <div className={approvalActionsClass}>
            <button
              className="inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-md border border-red-200 bg-white px-1 py-1 text-[10px] font-medium leading-none text-red-700 hover:bg-red-50 [&_svg]:size-3 sm:h-10 sm:w-auto sm:gap-2 sm:px-3 sm:text-sm sm:[&_svg]:size-4"
              onClick={() => onReject(request)}
              type="button"
            >
              <X size={16} />
              Отклонить
            </button>
            <button
              className="inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-md bg-teal-700 px-1 py-1 text-[10px] font-medium leading-none text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300 [&_svg]:size-3 sm:h-10 sm:w-auto sm:gap-2 sm:px-3 sm:text-sm sm:[&_svg]:size-4"
              disabled={!workshopManagers.length}
              type="submit"
            >
              <Check size={16} />
              Согласовать
            </button>
          </div>
          {!workshopManagers.length ? (
            <div className="text-sm text-amber-700">
              На этом объекте пока нет пользователя с ролью начальника цеха.
            </div>
          ) : null}
        </div>
      </RequestSummaryCard>
    </form>
  );
}

export function GarageManagerTransportRequestCard({
  onComplete,
  onReject,
  onUpdateItem,
  onUpdateTextField,
  request,
}: {
  onComplete: (request: SupplyRequest) => void;
  onReject: (request: SupplyRequest) => void;
  onUpdateItem?: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    field?: "orderQuantity" | "quantity" | "stockQuantity",
  ) => void;
  onUpdateTextField?: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    field: "materialName" | "measurementUnit",
  ) => void;
  request: SupplyRequest;
}) {
  return (
    <div className={limeApprovalCardClass}>
      <RequestSummaryCard request={request} variant="approval">
        {isItemRequest(request) ? (
          <ItemReviewTable
            request={request}
            onUpdateItem={onUpdateItem}
            onUpdateTextField={onUpdateTextField}
          />
        ) : (
          <RequestDetails request={request} />
        )}
        <div className={approvalActionsWithMarginClass}>
          <button
            className="inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-md border border-red-200 bg-white px-1 py-1 text-[10px] font-medium leading-none text-red-700 hover:bg-red-50 [&_svg]:size-3 sm:h-10 sm:w-auto sm:gap-2 sm:px-3 sm:text-sm sm:[&_svg]:size-4"
            onClick={() => onReject(request)}
            type="button"
          >
            <X size={16} />
            Отклонить
          </button>
          <button
            className="inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-md bg-teal-700 px-1 py-1 text-[10px] font-medium leading-none text-white hover:bg-teal-800 [&_svg]:size-3 sm:h-10 sm:w-auto sm:gap-2 sm:px-3 sm:text-sm sm:[&_svg]:size-4"
            onClick={() => onComplete(request)}
            type="button"
          >
            <Check size={16} />
            Согласовать
          </button>
        </div>
      </RequestSummaryCard>
    </div>
  );
}

export function TransportAuthorCompletionCard({
  onComplete,
  onReject,
  request,
}: {
  onComplete: (request: SupplyRequest) => void;
  onReject: (request: SupplyRequest) => void;
  request: SupplyRequest;
}) {
  return (
    <div className={limeApprovalCardClass}>
      <RequestSummaryCard request={request} variant="approval">
        <TransportDetails request={request} />
        <div className={approvalActionsWithMarginClass}>
          <button
            className="inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-md border border-red-200 bg-white px-1 py-1 text-[10px] font-medium leading-none text-red-700 hover:bg-red-50 [&_svg]:size-3 sm:h-10 sm:w-auto sm:gap-2 sm:px-3 sm:text-sm sm:[&_svg]:size-4"
            onClick={() => onReject(request)}
            type="button"
          >
            <X size={16} />
            Отклонить
          </button>
          <button
            className="inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-md bg-teal-700 px-1 py-1 text-[10px] font-medium leading-none text-white hover:bg-teal-800 [&_svg]:size-3 sm:h-10 sm:w-auto sm:gap-2 sm:px-3 sm:text-sm sm:[&_svg]:size-4"
            onClick={() => onComplete(request)}
            type="button"
          >
            <Check size={16} />
            Согласовать
          </button>
        </div>
      </RequestSummaryCard>
    </div>
  );
}

export function PtoRequestCard({
  onDeleteItem,
  onReject,
  onSubmit,
  onUpdateItem,
  onUpdatePtoComment,
  onUpdateTextField,
  request,
}: {
  onDeleteItem: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
  ) => void;
  onReject: (request: SupplyRequest) => void;
  onSubmit: (
    request: SupplyRequest,
    event: FormEvent<HTMLFormElement>,
  ) => void;
  onUpdateItem: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    field?: "orderQuantity" | "quantity" | "stockQuantity",
  ) => void;
  onUpdatePtoComment: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    comment: string,
  ) => void;
  onUpdateTextField: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    field: "materialName" | "measurementUnit",
  ) => void;
  request: SupplyRequest;
}) {
  return (
    <form
      className={approvalCardClass}
      onSubmit={(event) => onSubmit(request, event)}
    >
      <RequestSummaryCard request={request} variant="approval">
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-3 font-medium">ТМЦ</th>
              <MaterialQuantityHeaders />
              <th className="py-2 pr-3 font-medium">Удаление</th>
            </tr>
          </thead>
          <tbody>
            {request.items.map((item) => (
              <tr className="border-b border-slate-100" key={item.id}>
                <td className="py-3 pr-3 text-slate-950">
                  <ItemNameWithComments item={item} />
                  <TextItemEditActions
                    item={item}
                    request={request}
                    onUpdate={onUpdateTextField}
                  />
                  <RoleItemCommentInput
                    fieldName="ptoComment"
                    item={item}
                    label="Комментарий ПТО"
                    onSave={(comment) =>
                      onUpdatePtoComment(request, item, comment)
                    }
                  />
                </td>
                <EditableMaterialQuantityCells
                  item={item}
                  request={request}
                  onUpdate={onUpdateItem}
                />
                <td className="py-3 pr-3">
                  <RequestItemDeleteAction
                    item={item}
                    request={request}
                    onDelete={onDeleteItem}
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
        <div className={approvalActionsClass}>
          <button
            className="inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-md border border-red-200 bg-white px-1 py-1 text-[10px] font-medium leading-none text-red-700 hover:bg-red-50 [&_svg]:size-3 sm:h-10 sm:w-auto sm:gap-2 sm:px-3 sm:text-sm sm:[&_svg]:size-4"
            onClick={() => onReject(request)}
            type="button"
          >
            <X size={16} />
            Отклонить
          </button>
          <button
            className="inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-md bg-teal-700 px-1 py-1 text-[10px] font-medium leading-none text-white hover:bg-teal-800 [&_svg]:size-3 sm:h-10 sm:w-auto sm:gap-2 sm:px-3 sm:text-sm sm:[&_svg]:size-4"
            type="submit"
          >
            <Check size={16} />
            Согласовать
          </button>
        </div>
        </div>
      </RequestSummaryCard>
    </form>
  );
}

export function ChiefEngineerRequestCard({
  onApprove,
  onDeleteItem,
  onReturn,
  onUpdateChiefEngineerComment,
  onUpdateItem,
  onUpdateTextField,
  request,
}: {
  onApprove: (request: SupplyRequest) => void;
  onDeleteItem: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
  ) => void;
  onReturn: (request: SupplyRequest) => void;
  onUpdateChiefEngineerComment: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    comment: string,
  ) => void;
  onUpdateItem: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    field?: "orderQuantity" | "quantity" | "stockQuantity",
  ) => void;
  onUpdateTextField: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    field: "materialName" | "measurementUnit",
  ) => void;
  request: SupplyRequest;
}) {
  return (
    <div className={approvalCardClass}>
      <RequestSummaryCard request={request} variant="approval">

        {isItemRequest(request) ? (
          <>
            <EditableMaterialItemsTable
              request={request}
              onDeleteItem={onDeleteItem}
              onUpdateChiefEngineerComment={onUpdateChiefEngineerComment}
              onUpdateItem={onUpdateItem}
              onUpdateTextField={onUpdateTextField}
            />
          </>
        ) : (
          <RequestDetails request={request} />
        )}
      <div className={approvalActionsWithMarginClass}>
        {isItemRequest(request) ||
        request.type === "TRANSPORT" ||
        request.type === "FUEL" ? (
        <button
          className="inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-md border border-red-200 bg-white px-1 py-1 text-[10px] font-medium leading-none text-red-700 hover:bg-red-50 [&_svg]:size-3 sm:h-10 sm:w-auto sm:gap-2 sm:px-3 sm:text-sm sm:[&_svg]:size-4"
          onClick={() => onReturn(request)}
          type="button"
        >
          <X size={16} />
          Отклонить
        </button>
        ) : null}
        <button
          className="inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-md bg-teal-700 px-1 py-1 text-[10px] font-medium leading-none text-white hover:bg-teal-800 [&_svg]:size-3 sm:h-10 sm:w-auto sm:gap-2 sm:px-3 sm:text-sm sm:[&_svg]:size-4"
          onClick={() => onApprove(request)}
          type="button"
        >
          <Check size={16} />
          {getChiefEngineerApproveLabel(request.type)}
        </button>
      </div>
      </RequestSummaryCard>
    </div>
  );
}

export function WarehouseManagerRequestCard({
  onApprove,
  onReject,
  onUpdateItem,
  request,
}: {
  onApprove: (request: SupplyRequest) => void;
  onReject: (request: SupplyRequest) => void;
  onUpdateItem: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    field?: "orderQuantity" | "quantity" | "stockQuantity",
  ) => void;
  request: SupplyRequest;
}) {
  return (
    <div className={approvalCardClass}>
      <RequestSummaryCard request={request} variant="approval">
        <WarehouseStockItemsTable request={request} onUpdateItem={onUpdateItem} />
        <div className={approvalActionsWithMarginClass}>
          <button
            className="inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-md border border-red-200 bg-white px-1 py-1 text-[10px] font-medium leading-none text-red-700 hover:bg-red-50 [&_svg]:size-3 sm:h-10 sm:w-auto sm:gap-2 sm:px-3 sm:text-sm sm:[&_svg]:size-4"
            onClick={() => onReject(request)}
            type="button"
          >
            <X size={16} />
            Отклонить
          </button>
          <button
            className="inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-md bg-teal-700 px-1 py-1 text-[10px] font-medium leading-none text-white hover:bg-teal-800 [&_svg]:size-3 sm:h-10 sm:w-auto sm:gap-2 sm:px-3 sm:text-sm sm:[&_svg]:size-4"
            onClick={() => onApprove(request)}
            type="button"
          >
            <Check size={16} />
            Согласовать
          </button>
        </div>
      </RequestSummaryCard>
    </div>
  );
}

function getChiefEngineerApproveLabel(type: SupplyRequest["type"]) {
  void type;
  return "Согласовать";
}

export function DeputyProductionDirectorRequestCard({
  onApprove,
  onDeleteItem,
  onReject,
  onUpdateItem,
  onUpdateTextField,
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
    field?: "orderQuantity" | "quantity" | "stockQuantity",
  ) => void;
  onUpdateTextField?: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    field: "materialName" | "measurementUnit",
  ) => void;
  request: SupplyRequest;
}) {
  return (
    <div className={approvalCardClass}>
      <RequestSummaryCard request={request} variant="approval">
        {isItemRequest(request) ? (
          <>
            <ItemReviewTable
              request={request}
              onDeleteItem={onDeleteItem}
              onUpdateItem={onUpdateItem}
              onUpdateTextField={onUpdateTextField}
            />
          </>
        ) : (
          <RequestDetails request={request} />
        )}
        <div className={approvalActionsWithMarginClass}>
          <button
            className="inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-md border border-red-200 bg-white px-1 py-1 text-[10px] font-medium leading-none text-red-700 hover:bg-red-50 [&_svg]:size-3 sm:h-10 sm:w-auto sm:gap-2 sm:px-3 sm:text-sm sm:[&_svg]:size-4"
            onClick={() => onReject(request)}
            type="button"
          >
            <X size={16} />
            Отклонить
          </button>
          <button
            className="inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-md bg-teal-700 px-1 py-1 text-[10px] font-medium leading-none text-white hover:bg-teal-800 [&_svg]:size-3 sm:h-10 sm:w-auto sm:gap-2 sm:px-3 sm:text-sm sm:[&_svg]:size-4"
            onClick={() => onApprove(request)}
            type="button"
          >
            <Check size={16} />
            Согласовать
          </button>
        </div>
      </RequestSummaryCard>
    </div>
  );
}

export function AccountantRequestCard({
  onApprove,
  onReject,
  onUpdateItem,
  onUpdateTextField,
  request,
}: {
  onApprove: (request: SupplyRequest) => void;
  onReject: (request: SupplyRequest) => void;
  onUpdateItem?: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    field?: "orderQuantity" | "quantity" | "stockQuantity",
  ) => void;
  onUpdateTextField?: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    field: "materialName" | "measurementUnit",
  ) => void;
  request: SupplyRequest;
}) {
  return (
    <div className={approvalCardClass}>
      <RequestSummaryCard request={request} variant="approval">
        {shouldShowPlainItemDetails(request) ? (
          <PlainItemRequestDetails request={request} />
        ) : isItemRequest(request) ? (
          <>
            <ItemReviewTable
              request={request}
              onUpdateItem={onUpdateItem}
              onUpdateTextField={onUpdateTextField}
            />
          </>
        ) : (
          <MoneyDetails request={request} />
        )}
        <InvoiceList request={request} />
        <div className={approvalActionsWithMarginClass}>
          <button
            className="inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-md border border-red-200 bg-white px-1 py-1 text-[10px] font-medium leading-none text-red-700 hover:bg-red-50 [&_svg]:size-3 sm:h-10 sm:w-auto sm:gap-2 sm:px-3 sm:text-sm sm:[&_svg]:size-4"
            onClick={() => onReject(request)}
            type="button"
          >
            <X size={16} />
            Отклонить
          </button>
          <button
            className="inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-md bg-teal-700 px-1 py-1 text-[10px] font-medium leading-none text-white hover:bg-teal-800 [&_svg]:size-3 sm:h-10 sm:w-auto sm:gap-2 sm:px-3 sm:text-sm sm:[&_svg]:size-4"
            onClick={() => onApprove(request)}
            type="button"
          >
            <Check size={16} />
            Согласовать
          </button>
        </div>
      </RequestSummaryCard>
    </div>
  );
}

export function SupplyRequestCard({
  onDeleteInvoice,
  onUpdateSupplierComment,
  onUpdateItem,
  onUpdateTextField,
  onReject,
  onSubmit,
  request,
  checklistStorageScope,
}: {
  onDeleteInvoice?: (request: SupplyRequest, invoiceId: string) => void;
  onUpdateSupplierComment: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    comment: string,
  ) => void;
  onUpdateItem?: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    field?: "orderQuantity" | "quantity" | "stockQuantity",
  ) => void;
  onUpdateTextField?: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    field: "materialName" | "measurementUnit",
  ) => void;
  onReject: (request: SupplyRequest) => void;
  onSubmit: (
    request: SupplyRequest,
    event: FormEvent<HTMLFormElement>,
  ) => void;
  request: SupplyRequest;
  checklistStorageScope: string;
}) {
  return (
    <form
      className={approvalCardClass}
      onSubmit={(event) => onSubmit(request, event)}
    >
      <RequestSummaryCard request={request} variant="approval">

      <SupplierMaterialItemsTable
        checklistStorageScope={checklistStorageScope}
        request={request}
        onUpdateSupplierComment={onUpdateSupplierComment}
        onUpdateItem={onUpdateItem}
        onUpdateTextField={onUpdateTextField}
      />
      <InvoiceList request={request} onDeleteInvoice={onDeleteInvoice} />
      <div className="mt-4 grid gap-3">
        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-slate-700">
            {"Счета на оплату"}
          </span>
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 focus:border-teal-700"
            multiple
            name="files"
            type="file"
          />
          <span className="text-xs text-slate-500">
            Можно отправить заявку без счетов или прикрепить любое количество файлов.
          </span>
        </label>
        <input
          className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-teal-700"
          name="comment"
          placeholder="Комментарий снабжения"
        />
        <div className={approvalActionsClass}>
          <button
            className="inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-md border border-red-200 bg-white px-1 py-1 text-[10px] font-medium leading-none text-red-700 hover:bg-red-50 [&_svg]:size-3 sm:h-10 sm:w-auto sm:gap-2 sm:px-3 sm:text-sm sm:[&_svg]:size-4"
            onClick={() => onReject(request)}
            type="button"
          >
            <X size={16} />
            Отклонить
          </button>
          <button
            className="inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-md bg-teal-700 px-1 py-1 text-[10px] font-medium leading-none text-white hover:bg-teal-800 [&_svg]:size-3 sm:h-10 sm:w-auto sm:gap-2 sm:px-3 sm:text-sm sm:[&_svg]:size-4"
            type="submit"
          >
            <Check size={16} />
            Согласовать
          </button>
        </div>
      </div>
      </RequestSummaryCard>
    </form>
  );
}

export function SupplyMoneyRequestCard({
  onReject,
  onSubmit,
  request,
}: {
  onReject: (request: SupplyRequest) => void;
  onSubmit: (
    request: SupplyRequest,
    event: FormEvent<HTMLFormElement>,
  ) => void;
  request: SupplyRequest;
}) {
  return (
    <form
      className={approvalCardClass}
      onSubmit={(event) => onSubmit(request, event)}
    >
      <RequestSummaryCard request={request} variant="approval">
        <RequestDetails request={request} />
        <div className="mt-4 grid gap-3">
          <input
            className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-teal-700"
            name="comment"
            placeholder="Комментарий к исполнению"
          />
          <div className={approvalActionsClass}>
            <button
              className="inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-md border border-red-200 bg-white px-1 py-1 text-[10px] font-medium leading-none text-red-700 hover:bg-red-50 [&_svg]:size-3 sm:h-10 sm:w-auto sm:gap-2 sm:px-3 sm:text-sm sm:[&_svg]:size-4"
              onClick={() => onReject(request)}
              type="button"
            >
              <X size={16} />
              Отклонить
            </button>
            <button
              className="inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-md bg-teal-700 px-1 py-1 text-[10px] font-medium leading-none text-white hover:bg-teal-800 [&_svg]:size-3 sm:h-10 sm:w-auto sm:gap-2 sm:px-3 sm:text-sm sm:[&_svg]:size-4"
              type="submit"
            >
              <Check size={16} />
              Согласовать
            </button>
          </div>
        </div>
      </RequestSummaryCard>
    </form>
  );
}

export function SupplyTransportRequestCard({
  onReject,
  onSubmit,
  request,
}: {
  onReject: (request: SupplyRequest) => void;
  onSubmit: (
    request: SupplyRequest,
    event: FormEvent<HTMLFormElement>,
  ) => void;
  request: SupplyRequest;
}) {
  return (
    <form
      className={approvalCardClass}
      onSubmit={(event) => onSubmit(request, event)}
    >
      <RequestSummaryCard request={request} variant="approval">

      <TransportDetails request={request} />
      <InvoiceList request={request} />
      <div className="mt-4 grid gap-3">
        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-slate-700">
            {"Счета на оплату"}
          </span>
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 focus:border-teal-700"
            multiple
            name="files"
            type="file"
          />
        </label>
        <input
          className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-teal-700"
          name="comment"
          placeholder="Комментарий снабжения"
        />
        <div className={approvalActionsClass}>
          <button
            className="inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-md border border-red-200 bg-white px-1 py-1 text-[10px] font-medium leading-none text-red-700 hover:bg-red-50 [&_svg]:size-3 sm:h-10 sm:w-auto sm:gap-2 sm:px-3 sm:text-sm sm:[&_svg]:size-4"
            onClick={() => onReject(request)}
            type="button"
          >
            <X size={16} />
            Отклонить
          </button>
          <button
            className="inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-md bg-teal-700 px-1 py-1 text-[10px] font-medium leading-none text-white hover:bg-teal-800 [&_svg]:size-3 sm:h-10 sm:w-auto sm:gap-2 sm:px-3 sm:text-sm sm:[&_svg]:size-4"
            type="submit"
          >
            <Check size={16} />
            Согласовать
          </button>
        </div>
      </div>
      </RequestSummaryCard>
    </form>
  );
}

export function SupplyInProgressCard({
  onComplete,
  onReject,
  request,
  storekeepers,
}: {
  onComplete: (
    request: SupplyRequest,
    event: FormEvent<HTMLFormElement>,
  ) => void;
  onReject: (request: SupplyRequest) => void;
  request: SupplyRequest;
  storekeepers: User[];
}) {
  return (
    <form
      className={emeraldApprovalCardClass}
      onSubmit={(event) => onComplete(request, event)}
    >
      <RequestSummaryCard request={request} variant="approval">

      {request.type === "TRANSPORT" ? (
        <TransportDetails request={request} />
      ) : request.type === "MONEY" ? (
        <MoneyDetails request={request} />
      ) : (
        <MaterialItemsTable request={request} />
      )}
      <InvoiceList request={request} />
      <div className="mt-4 grid gap-3 rounded-md bg-white/70 p-3">
        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-slate-700">
            Назначенный кладовщик
          </span>
          <select
            className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-teal-700"
            name="storekeeperUserId"
            required
          >
            <option value="">Выберите кладовщика</option>
            {storekeepers.map((storekeeper) => (
              <option key={storekeeper.id} value={storekeeper.id}>
                {storekeeper.name} ({storekeeper.email})
              </option>
            ))}
          </select>
        </label>
        <input
          className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-teal-700"
          name="comment"
          placeholder="Комментарий снабженца"
        />
        <div className={approvalActionsClass}>
          <button
            className="inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-md border border-red-200 bg-white px-1 py-1 text-[10px] font-medium leading-none text-red-700 hover:bg-red-50 [&_svg]:size-3 sm:h-10 sm:w-auto sm:gap-2 sm:px-3 sm:text-sm sm:[&_svg]:size-4"
            onClick={() => onReject(request)}
            type="button"
          >
            <X size={16} />
            Отклонить
          </button>
          <button
            className="inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-md bg-teal-700 px-1 py-1 text-[10px] font-medium leading-none text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300 [&_svg]:size-3 sm:h-10 sm:w-auto sm:gap-2 sm:px-3 sm:text-sm sm:[&_svg]:size-4"
            disabled={!storekeepers.length}
            type="submit"
          >
            <Check size={16} />
            Согласовать
          </button>
        </div>
        {!storekeepers.length ? (
          <div className="text-sm text-amber-700">
            На этом объекте пока нет пользователя с ролью кладовщика.
          </div>
        ) : null}
      </div>
      </RequestSummaryCard>
    </form>
  );
}

export function StorekeeperRequestCard({
  onComplete,
  onReject,
  onUpdateItem,
  onUpdateTextField,
  request,
}: {
  onComplete: (
    request: SupplyRequest,
    event: FormEvent<HTMLFormElement>,
  ) => void;
  onReject: (request: SupplyRequest) => void;
  onUpdateItem?: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    field?: "orderQuantity" | "quantity" | "stockQuantity",
  ) => void;
  onUpdateTextField?: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    field: "materialName" | "measurementUnit",
  ) => void;
  request: SupplyRequest;
}) {
  return (
    <form
      className={stoneApprovalCardClass}
      onSubmit={(event) => onComplete(request, event)}
    >
      <RequestSummaryCard request={request} variant="approval">
        <StorekeeperItemsChecklist
          request={request}
          onUpdateItem={onUpdateItem}
          onUpdateTextField={onUpdateTextField}
        />
        <InvoiceList request={request} />
        <div className="mt-4 grid gap-3">
          <input
            className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-teal-700"
            name="comment"
            placeholder="Комментарий кладовщика"
          />
          <div className={approvalActionsClass}>
            <button
              className="inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-md border border-red-200 bg-white px-1 py-1 text-[10px] font-medium leading-none text-red-700 hover:bg-red-50 [&_svg]:size-3 sm:h-10 sm:w-auto sm:gap-2 sm:px-3 sm:text-sm sm:[&_svg]:size-4"
              onClick={() => onReject(request)}
              type="button"
            >
              <X size={16} />
              Отклонить
            </button>
            <button
              className="inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-md bg-teal-700 px-1 py-1 text-[10px] font-medium leading-none text-white hover:bg-teal-800 [&_svg]:size-3 sm:h-10 sm:w-auto sm:gap-2 sm:px-3 sm:text-sm sm:[&_svg]:size-4"
              type="submit"
            >
              <Check size={16} />
              Согласовать
            </button>
          </div>
        </div>
      </RequestSummaryCard>
    </form>
  );
}

export function DirectorRequestCard({
  onApprove,
  onArchive,
  onDeleteItem,
  onReject,
  onUpdateItem,
  onUpdateTextField,
  request,
}: {
  onApprove: (request: SupplyRequest) => void;
  onArchive: (request: SupplyRequest) => void;
  onDeleteItem: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
  ) => void;
  onReject: (request: SupplyRequest) => void;
  onUpdateItem: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    field?: "orderQuantity" | "quantity" | "stockQuantity",
  ) => void;
  onUpdateTextField?: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    field: "materialName" | "measurementUnit",
  ) => void;
  request: SupplyRequest;
}) {
  return (
    <div className={approvalCardClass}>
      <RequestSummaryCard request={request} variant="approval">

      {shouldShowPlainItemDetails(request) ? (
        <PlainItemRequestDetails request={request} />
      ) : isItemRequest(request) ? (
        <>
          <ItemReviewTable
            request={request}
            onDeleteItem={onDeleteItem}
            onUpdateItem={onUpdateItem}
            onUpdateTextField={onUpdateTextField}
          />
        </>
      ) : (
        <RequestDetails request={request} />
      )}
      <InvoiceList request={request} />
      <div className={approvalActionsWithMarginClass}>
        <button
          className="inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-md border border-slate-300 bg-white px-1 py-1 text-[10px] font-medium leading-none text-slate-700 hover:bg-slate-50 [&_svg]:size-3 sm:h-10 sm:w-auto sm:gap-2 sm:px-3 sm:text-sm sm:[&_svg]:size-4"
          onClick={() => onArchive(request)}
          type="button"
        >
          <X size={16} />
          Удалить
        </button>
        <button
          className="inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-md border border-red-200 bg-white px-1 py-1 text-[10px] font-medium leading-none text-red-700 hover:bg-red-50 [&_svg]:size-3 sm:h-10 sm:w-auto sm:gap-2 sm:px-3 sm:text-sm sm:[&_svg]:size-4"
          onClick={() => onReject(request)}
          type="button"
        >
          <X size={16} />
          Отклонить
        </button>
        <button
          className="inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-md bg-teal-700 px-1 py-1 text-[10px] font-medium leading-none text-white hover:bg-teal-800 [&_svg]:size-3 sm:h-10 sm:w-auto sm:gap-2 sm:px-3 sm:text-sm sm:[&_svg]:size-4"
          onClick={() => onApprove(request)}
          type="button"
        >
          <Check size={16} />
          Согласовать
        </button>
      </div>
      </RequestSummaryCard>
    </div>
  );
}

function QuantityWithEdit({
  field = "quantity",
  item,
  onUpdate,
  request,
}: {
  field?: "orderQuantity" | "quantity" | "stockQuantity";
  item: SupplyRequest["items"][number];
  onUpdate: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    field?: "orderQuantity" | "quantity" | "stockQuantity",
  ) => void;
  request: SupplyRequest;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <QuantityValue item={item} field={field} />
      <button
        className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        onClick={() => onUpdate(request, item, field)}
        type="button"
      >
        Изменить
      </button>
    </div>
  );
}

function QuantityValue({
  field,
  item,
}: {
  field: "orderQuantity" | "quantity" | "stockQuantity";
  item: SupplyRequest["items"][number];
}) {
  const valueByField = {
    orderQuantity: item.orderQuantity ?? item.quantity,
    quantity: item.quantity,
    stockQuantity: item.stockQuantity ?? "0",
  };

  return (
    <span className="font-medium text-slate-700">
      {formatQuantity(valueByField[field])} {item.measurementUnitSnapshot}
    </span>
  );
}

function MaterialQuantityHeaders() {
  return (
    <>
      <th className="py-2 pr-3 font-medium">Количество</th>
      <th className="py-2 pr-3 font-medium">Количество на складе</th>
    </>
  );
}

function MaterialQuantityCells({ item }: { item: SupplyRequest["items"][number] }) {
  return (
    <>
      <td className="py-3 pr-3 text-slate-600">
        <QuantityValue item={item} field="quantity" />
      </td>
      <td className="py-3 pr-3 text-slate-600">
        <QuantityValue item={item} field="stockQuantity" />
      </td>
    </>
  );
}

function EditableMaterialQuantityCells({
  item,
  onUpdate,
  request,
}: {
  item: SupplyRequest["items"][number];
  onUpdate: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    field?: "orderQuantity" | "quantity" | "stockQuantity",
  ) => void;
  request: SupplyRequest;
}) {
  const unit = item.measurementUnitSnapshot;
  const canEditWarehouseQuantities =
    request.status === "PENDING_WAREHOUSE_MANAGER";

  return (
    <>
      <td className="py-3 pr-3 text-slate-600">
        <QuantityWithEdit item={item} request={request} onUpdate={onUpdate} />
      </td>
      <td className="py-3 pr-3 text-slate-600">
        {canEditWarehouseQuantities ? (
          <QuantityWithEdit
            field="stockQuantity"
            item={item}
            request={request}
            onUpdate={onUpdate}
          />
        ) : (
          <>
            {formatQuantity(item.stockQuantity ?? "0")} {unit}
          </>
        )}
      </td>
    </>
  );
}

function RequestItemDeleteAction({
  item,
  onDelete,
  request,
}: {
  item: SupplyRequest["items"][number];
  onDelete: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
  ) => void;
  request: SupplyRequest;
}) {
  return (
    <button
      className="inline-flex h-9 items-center justify-center rounded-md border border-red-200 bg-white px-3 text-xs font-medium text-red-700 hover:bg-red-50"
      onClick={() => onDelete(request, item)}
      type="button"
    >
      Удалить
    </button>
  );
}

function ItemNameWithComments({
  item,
}: {
  item: SupplyRequest["items"][number];
}) {
  return (
    <div className="grid gap-2">
      <div className="font-medium text-slate-950">
        {item.materialNameSnapshot}
      </div>
      <ItemCommentList item={item} />
    </div>
  );
}

function ItemCommentList({ item }: { item: SupplyRequest["items"][number] }) {
  const comments = [
    {
      label: "Главный инженер",
      value: item.chiefEngineerComment,
    },
    {
      label: "Снабжение",
      value: item.supplierComment,
    },
    {
      label: "Начальник снабжения",
      value: item.supplyManagerComment,
    },
    {
      label: "ПТО",
      value: item.ptoComment,
    },
    {
      label: "Снабжение (старый комментарий)",
      value: item.supplyComment,
    },
  ].filter((comment) => comment.value?.trim());

  if (!comments.length) {
    return null;
  }

  return (
    <div className="grid gap-1">
      {comments.map((comment) => (
        <div
          className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-600"
          key={comment.label}
        >
          <span className="font-medium text-slate-700">{comment.label}: </span>
          <span className="whitespace-pre-wrap">{comment.value}</span>
        </div>
      ))}
    </div>
  );
}

function RoleItemCommentInput({
  fieldName,
  item,
  label,
  onSave,
}: {
  fieldName: "chiefEngineerComment" | "ptoComment";
  item: SupplyRequest["items"][number];
  label: string;
  onSave: (comment: string) => void;
}) {
  const inputId = `${fieldName}:${item.id}`;
  const defaultValue =
    fieldName === "chiefEngineerComment"
      ? item.chiefEngineerComment
      : item.ptoComment;

  return (
    <div className="mt-3 flex min-w-[320px] gap-2">
      <input
        className="h-9 min-w-0 flex-1 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-teal-700"
        defaultValue={defaultValue ?? ""}
        id={inputId}
        placeholder={label}
        type="text"
      />
      <button
        className="inline-flex h-9 items-center justify-center rounded-md border border-teal-200 bg-white px-3 text-xs font-medium text-teal-700 hover:bg-teal-50"
        onClick={() => {
          const input = document.getElementById(inputId) as HTMLInputElement | null;

          onSave(input?.value ?? "");
        }}
        type="button"
      >
        Сохранить
      </button>
    </div>
  );
}

function TextItemEditActions({
  item,
  onUpdate,
  request,
}: {
  item: SupplyRequest["items"][number];
  onUpdate: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    field: "materialName" | "measurementUnit",
  ) => void;
  request: SupplyRequest;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <button
        className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        onClick={() => onUpdate(request, item, "materialName")}
        type="button"
      >
        Изм. название
      </button>
      <button
        className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        onClick={() => onUpdate(request, item, "measurementUnit")}
        type="button"
      >
        Изм. ед.
      </button>
    </div>
  );
}

function MaterialItemsTable({ request }: { request: SupplyRequest }) {
  const shouldShowFulfillmentStatus = request.items.some(
    (item) => item.fulfillmentStatus !== "PENDING",
  );
  const shouldShowCashPayment = request.items.some(
    (item) => item.cashPaidAmount || item.cashPaymentComment,
  );

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="py-2 pr-3 font-medium">ТМЦ</th>
            <MaterialQuantityHeaders />
            {shouldShowCashPayment ? (
              <>
                <th className="py-2 pr-3 font-medium">Оплачено наличными</th>
                <th className="py-2 pr-3 font-medium">Комментарий</th>
              </>
            ) : null}
            {shouldShowFulfillmentStatus ? (
              <th className="py-2 pr-3 font-medium">Статус</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {request.items.map((item) => (
            <tr className="border-b border-slate-100" key={item.id}>
              <td className="py-3 pr-3 text-slate-950">
                <ItemNameWithComments item={item} />
              </td>
              <MaterialQuantityCells item={item} />
              {shouldShowCashPayment ? (
                <>
                  <td className="py-3 pr-3 text-slate-700">
                    {item.cashPaidAmount
                      ? formatMoney(toNumber(item.cashPaidAmount))
                      : "-"}
                  </td>
                  <td className="max-w-xs py-3 pr-3 text-slate-700">
                    {item.cashPaymentComment || "-"}
                  </td>
                </>
              ) : null}
              {shouldShowFulfillmentStatus ? (
                <td className="py-3 pr-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${getFulfillmentStatusClass(
                      item.fulfillmentStatus,
                    )}`}
                  >
                    {getFulfillmentStatusLabel(item.fulfillmentStatus)}
                  </span>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SupplierMaterialItemsTable({
  checklistStorageScope,
  onUpdateSupplierComment,
  onUpdateItem,
  onUpdateTextField,
  request,
}: {
  checklistStorageScope: string;
  onUpdateSupplierComment: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    comment: string,
  ) => void;
  onUpdateItem?: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    field?: "orderQuantity" | "quantity" | "stockQuantity",
  ) => void;
  onUpdateTextField?: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    field: "materialName" | "measurementUnit",
  ) => void;
  request: SupplyRequest;
}) {
  return (
    <SupplyItemWorkTable
      checklistStorageScope={checklistStorageScope}
      commentField="supplierComment"
      commentLabel="Комментарий снабженца"
      request={request}
      showCashPayment
      onUpdateComment={onUpdateSupplierComment}
      onUpdateTextField={onUpdateTextField}
      onUpdateItem={onUpdateItem}
    />
  );
}

function SupplyItemWorkTable({
  checklistStorageScope,
  commentField,
  commentLabel,
  onUpdateComment,
  onUpdateItem,
  onUpdateTextField,
  request,
  showCashPayment = false,
}: {
  checklistStorageScope: string;
  commentField: "supplyManagerComment" | "supplierComment";
  commentLabel: string;
  onUpdateComment: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    comment: string,
  ) => void;
  onUpdateItem?: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    field?: "orderQuantity" | "quantity" | "stockQuantity",
  ) => void;
  onUpdateTextField?: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    field: "materialName" | "measurementUnit",
  ) => void;
  request: SupplyRequest;
  showCashPayment?: boolean;
}) {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const nextCheckedItems: Record<string, boolean> = {};

    for (const item of request.items) {
      nextCheckedItems[item.id] =
        localStorage.getItem(
          getSupplyChecklistStorageKey(checklistStorageScope, request.id, item.id),
        ) === "true";
    }

    setCheckedItems(nextCheckedItems);
  }, [checklistStorageScope, request.id, request.items]);

  function toggleItem(itemId: string, isChecked: boolean) {
    setCheckedItems((current) => ({
      ...current,
      [itemId]: isChecked,
    }));

    if (typeof window !== "undefined") {
      localStorage.setItem(
        getSupplyChecklistStorageKey(checklistStorageScope, request.id, itemId),
        String(isChecked),
      );
    }
  }

  if (!request.items.length) {
    return null;
  }

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[1180px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="py-2 pr-3 font-medium">Отмечено</th>
            <th className="py-2 pr-3 font-medium">ТМЦ</th>
            <MaterialQuantityHeaders />
            {showCashPayment ? (
              <>
                <th className="py-2 pr-3 font-medium">Оплачено наличными</th>
                <th className="py-2 pr-3 font-medium">Комментарий</th>
              </>
            ) : null}
            <th className="py-2 pr-3 font-medium">{commentLabel}</th>
          </tr>
        </thead>
        <tbody>
          {request.items.map((item) => (
            <tr className="border-b border-slate-100" key={item.id}>
              <td className="py-3 pr-3">
                <input
                  checked={Boolean(checkedItems[item.id])}
                  className="h-5 w-5 rounded border-slate-300 text-teal-700 focus:ring-teal-700"
                  onChange={(event) => toggleItem(item.id, event.target.checked)}
                  type="checkbox"
                />
              </td>
              <td className="py-3 pr-3 text-slate-950">
                <ItemNameWithComments item={item} />
                {onUpdateTextField ? (
                  <TextItemEditActions
                    item={item}
                    request={request}
                    onUpdate={onUpdateTextField}
                  />
                ) : null}
              </td>
              {onUpdateItem ? (
                <EditableMaterialQuantityCells
                  item={item}
                  request={request}
                  onUpdate={onUpdateItem}
                />
              ) : (
                <MaterialQuantityCells item={item} />
              )}
              {showCashPayment ? (
                <>
                  <td className="py-3 pr-3">
                    <input
                      className="h-10 w-40 rounded-md border border-slate-300 px-3 outline-none focus:border-teal-700"
                      defaultValue={item.cashPaidAmount ?? ""}
                      min="0"
                      name={`cashPaidAmount:${item.id}`}
                      placeholder="0"
                      step="0.01"
                      type="number"
                    />
                  </td>
                  <td className="py-3 pr-3">
                    <input
                      className="h-10 w-64 rounded-md border border-slate-300 px-3 outline-none focus:border-teal-700"
                      defaultValue={item.cashPaymentComment ?? ""}
                      name={`cashPaymentComment:${item.id}`}
                      placeholder="Описание оплаты"
                      type="text"
                    />
                  </td>
                </>
              ) : null}
              <td className="py-3 pr-3">
                <div className="flex min-w-[320px] gap-2">
                  <input
                    className="h-10 min-w-0 flex-1 rounded-md border border-slate-300 px-3 outline-none focus:border-teal-700"
                    defaultValue={item[commentField] ?? ""}
                    id={`${commentField}:${item.id}`}
                    placeholder={commentLabel}
                    type="text"
                  />
                  <button
                    className="inline-flex h-10 items-center justify-center rounded-md border border-teal-200 bg-white px-3 text-xs font-medium text-teal-700 hover:bg-teal-50"
                    onClick={() => {
                      const input = document.getElementById(
                        `${commentField}:${item.id}`,
                      ) as HTMLInputElement | null;

                      onUpdateComment(request, item, input?.value ?? "");
                    }}
                    type="button"
                  >
                    Сохранить
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function getFulfillmentStatusLabel(
  status: SupplyRequest["items"][number]["fulfillmentStatus"],
) {
  if (status === "COMPLETED") {
    return "Исполнено";
  }

  if (status === "SKIPPED") {
    return "Оставлено";
  }

  return "Ожидает";
}

function getFulfillmentStatusClass(
  status: SupplyRequest["items"][number]["fulfillmentStatus"],
) {
  if (status === "COMPLETED") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "SKIPPED") {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-slate-100 text-slate-600";
}

function StorekeeperItemsChecklist({
  onUpdateItem,
  onUpdateTextField,
  request,
}: {
  onUpdateItem?: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    field?: "orderQuantity" | "quantity" | "stockQuantity",
  ) => void;
  onUpdateTextField?: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    field: "materialName" | "measurementUnit",
  ) => void;
  request: SupplyRequest;
}) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[800px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="py-2 pr-3 font-medium">Исполнено</th>
            <th className="py-2 pr-3 font-medium">ТМЦ</th>
            <MaterialQuantityHeaders />
          </tr>
        </thead>
        <tbody>
          {request.items.map((item) => (
            <tr className="border-b border-slate-100" key={item.id}>
              <td className="py-3 pr-3">
                <input
                  className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-700"
                  defaultChecked
                  name="completedItemIds"
                  type="checkbox"
                  value={item.id}
                />
              </td>
              <td className="py-3 pr-3 text-slate-950">
                {item.materialNameSnapshot}
                {onUpdateTextField ? (
                  <TextItemEditActions
                    item={item}
                    request={request}
                    onUpdate={onUpdateTextField}
                  />
                ) : null}
              </td>
              {onUpdateItem ? (
                <EditableMaterialQuantityCells
                  item={item}
                  request={request}
                  onUpdate={onUpdateItem}
                />
              ) : (
                <MaterialQuantityCells item={item} />
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-slate-500">
        Отмеченные позиции будут исполнены. Неотмеченные автоматически получат
        статус Оставлено.
      </p>
    </div>
  );
}

function EditableMaterialItemsTable({
  onDeleteItem,
  onUpdateChiefEngineerComment,
  onUpdateItem,
  onUpdateTextField,
  request,
}: {
  onDeleteItem: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
  ) => void;
  onUpdateChiefEngineerComment: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    comment: string,
  ) => void;
  onUpdateItem: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    field?: "orderQuantity" | "quantity" | "stockQuantity",
  ) => void;
  onUpdateTextField: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    field: "materialName" | "measurementUnit",
  ) => void;
  request: SupplyRequest;
}) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[860px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="py-2 pr-3 font-medium">ТМЦ</th>
            <MaterialQuantityHeaders />
            <th className="py-2 pr-3 font-medium">Удаление</th>
          </tr>
        </thead>
        <tbody>
          {request.items.map((item) => (
            <tr className="border-b border-slate-100" key={item.id}>
              <td className="py-3 pr-3 text-slate-950">
                <ItemNameWithComments item={item} />
                <TextItemEditActions
                  item={item}
                  request={request}
                  onUpdate={onUpdateTextField}
                />
                <RoleItemCommentInput
                  fieldName="chiefEngineerComment"
                  item={item}
                  label="Комментарий главного инженера"
                  onSave={(comment) =>
                    onUpdateChiefEngineerComment(request, item, comment)
                  }
                />
              </td>
              <EditableMaterialQuantityCells
                item={item}
                request={request}
                onUpdate={onUpdateItem}
              />
              <td className="py-3 pr-3">
                <RequestItemDeleteAction
                  item={item}
                  request={request}
                  onDelete={onDeleteItem}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WarehouseStockItemsTable({
  onUpdateItem,
  request,
}: {
  onUpdateItem: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    field?: "orderQuantity" | "quantity" | "stockQuantity",
  ) => void;
  request: SupplyRequest;
}) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[700px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="py-2 pr-3 font-medium">ТМЦ</th>
            <th className="py-2 pr-3 font-medium">Количество</th>
            <th className="py-2 pr-3 font-medium">Количество на складе</th>
          </tr>
        </thead>
        <tbody>
          {request.items.map((item) => (
            <tr className="border-b border-slate-100" key={item.id}>
              <td className="py-3 pr-3 text-slate-950">
                {item.materialNameSnapshot}
              </td>
              <td className="py-3 pr-3 text-slate-600">
                <QuantityValue item={item} field="quantity" />
              </td>
              <td className="py-3 pr-3 text-slate-600">
                <QuantityWithEdit
                  field="stockQuantity"
                  item={item}
                  request={request}
                  onUpdate={onUpdateItem}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ItemReviewTable({
  onDeleteItem,
  onUpdateItem,
  onUpdateTextField,
  request,
}: {
  onDeleteItem?: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
  ) => void;
  onUpdateItem?: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    field?: "orderQuantity" | "quantity" | "stockQuantity",
  ) => void;
  onUpdateTextField?: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
    field: "materialName" | "measurementUnit",
  ) => void;
  request: SupplyRequest;
}) {
  const canEditQuantities = Boolean(onUpdateItem);
  const canDeleteItems = Boolean(onDeleteItem);

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="py-2 pr-3 font-medium">ТМЦ</th>
            <MaterialQuantityHeaders />
            {canDeleteItems ? (
              <th className="py-2 pr-3 font-medium">Удаление</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {request.items.map((item) => (
            <tr className="border-b border-slate-100" key={item.id}>
                <td className="py-3 pr-3 text-slate-950">
                  <ItemNameWithComments item={item} />
                  {onUpdateTextField ? (
                    <TextItemEditActions
                      item={item}
                      request={request}
                      onUpdate={onUpdateTextField}
                    />
                  ) : null}
                </td>
                {canEditQuantities && onUpdateItem ? (
                  <EditableMaterialQuantityCells
                    item={item}
                    request={request}
                    onUpdate={onUpdateItem}
                  />
                ) : (
                  <MaterialQuantityCells item={item} />
                )}
                {canDeleteItems && onDeleteItem ? (
                  <td className="py-3 pr-3">
                    <RequestItemDeleteAction
                      item={item}
                      request={request}
                      onDelete={onDeleteItem}
                    />
                  </td>
                ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TransportDetails({ request }: { request: SupplyRequest }) {
  return (
    <div className="mt-4 grid gap-3 rounded-md bg-slate-50 p-3 text-sm sm:grid-cols-2">
      <div>
        <div className="text-slate-500">Объект</div>
        <div className="mt-1 font-medium text-slate-950">
          {request.transportObjectName ?? request.object?.name ?? "Не указан"}
        </div>
      </div>
      <div>
        <div className="text-slate-500">Дата</div>
        <div className="mt-1 font-medium text-slate-950">
          {request.transportDate ?? "Не указана"}
        </div>
      </div>
      <div>
        <div className="text-slate-500">Время</div>
        <div className="mt-1 font-medium text-slate-950">
          {request.transportTime ?? "Не указано"}
        </div>
      </div>
      <div>
        <div className="text-slate-500">Запрашиваемый транспорт</div>
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

function ProductionDetails({ request }: { request: SupplyRequest }) {
  return (
    <div className="mt-4 grid gap-3">
      <div className="grid gap-3 rounded-md bg-slate-50 p-3 text-sm">
        <div>
          <div className="text-slate-500">Описание заявки</div>
          <div className="mt-1 whitespace-pre-wrap font-medium text-slate-950">
            {request.purpose ?? "Не указано"}
          </div>
        </div>
        {request.assignedWorkshopManager ? (
          <div>
            <div className="text-slate-500">Назначенный начальник цеха</div>
            <div className="mt-1 font-medium text-slate-950">
              {request.assignedWorkshopManager.name} (
              {request.assignedWorkshopManager.email})
            </div>
          </div>
        ) : null}
      </div>
      <AttachmentList request={request} />
    </div>
  );
}

function MoneyDetails({ request }: { request: SupplyRequest }) {
  const isBusinessTrip = request.type === "BUSINESS_TRIP";

  return (
    <div className="mt-4 grid gap-3 rounded-md bg-slate-50 p-3 text-sm sm:grid-cols-2">
      <div>
        <div className="text-slate-500">
          {isBusinessTrip ? "Сумма командировочных" : "Сумма"}
        </div>
        <div className="mt-1 font-medium text-slate-950">
          {formatMoney(toNumber(request.amount))}
        </div>
      </div>
      {!isBusinessTrip ? (
        <div>
          <div className="text-slate-500">Тип оплаты</div>
          <div className="mt-1 font-medium text-slate-950">
            {formatPaymentType(request.paymentType)}
          </div>
        </div>
      ) : null}
      <div>
        <div className="text-slate-500">
          {isBusinessTrip ? "Назначение командировки" : "Назначение платежа"}
        </div>
        <div className="mt-1 font-medium text-slate-950">
          {request.paymentPurpose ?? "Не указано"}
        </div>
      </div>
    </div>
  );
}

function formatPaymentType(type: SupplyRequest["paymentType"]) {
  if (type === "CASH") {
    return "Наличные";
  }

  if (type === "NON_CASH") {
    return "Безналичные";
  }

  return "Не указано";
}

function isItemRequest(request: SupplyRequest) {
  return (
    request.type === "MATERIAL" ||
    request.type === "QUARRY" ||
    request.type === "EXPRESS_MATERIAL"
  );
}

function RequestDetails({ request }: { request: SupplyRequest }) {
  if (shouldShowPlainItemDetails(request)) {
    return <PlainItemRequestDetails request={request} />;
  }

  if (isItemRequest(request)) {
    return <MaterialItemsTable request={request} />;
  }

  if (request.type === "TRANSPORT") {
    return <TransportDetails request={request} />;
  }

  if (request.type === "FUEL") {
    return <FuelDetails request={request} />;
  }

  if (request.type === "PRODUCTION") {
    return <ProductionDetails request={request} />;
  }

  if (request.type === "APPEAL") {
    return <AppealDetails request={request} />;
  }

  return <MoneyDetails request={request} />;
}

function AppealDetails({ request }: { request: SupplyRequest }) {
  return (
    <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm">
      <div className="text-slate-500">Текст обращения</div>
      <div className="mt-1 whitespace-pre-wrap font-medium text-slate-950">
        {request.purpose ?? "Не указано"}
      </div>
    </div>
  );
}

function PlainItemRequestDetails({ request }: { request: SupplyRequest }) {
  return (
    <div className="grid gap-3">
      {request.purpose ? (
        <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm">
          <div className="text-slate-500">Комментарий</div>
          <div className="mt-1 whitespace-pre-wrap font-medium text-slate-950">
            {request.purpose}
          </div>
        </div>
      ) : null}
      <MaterialItemsTable request={request} />
    </div>
  );
}

function shouldShowPlainItemDetails(request: SupplyRequest) {
  return (
    request.type === "EXPRESS_MATERIAL" ||
    (request.type === "MATERIAL" && request.object?.type === "WORKSHOP")
  );
}

function FuelDetails({ request }: { request: SupplyRequest }) {
  return (
    <div className="mt-4 grid gap-3 rounded-md bg-slate-50 p-3 text-sm sm:grid-cols-2">
      <div>
        <div className="text-slate-500">Тип топлива</div>
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

function AttachmentList({ request }: { request: SupplyRequest }) {
  const [preview, setPreview] = useState<{
    attachment: SupplyRequestAttachment;
    contentType: string;
    url: string;
  } | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (preview?.url) {
        URL.revokeObjectURL(preview.url);
      }
    };
  }, [preview?.url]);

  if (!request.attachments?.length) {
    return null;
  }

  async function openPreview(attachment: SupplyRequestAttachment) {
    setIsPreviewLoading(attachment.id);

    try {
      const nextPreview = await getSupplyRequestAttachmentPreview(
        request.id,
        attachment.id,
      );

      if (preview?.url) {
        URL.revokeObjectURL(preview.url);
      }

      setPreview({
        ...nextPreview,
        attachment,
      });
    } finally {
      setIsPreviewLoading(null);
    }
  }

  function closePreview() {
    if (preview?.url) {
      URL.revokeObjectURL(preview.url);
    }

    setPreview(null);
  }

  return (
    <>
      <div className="rounded-md bg-slate-50 p-3">
        <div className="text-sm font-medium text-slate-950">
          Прикрепленные файлы и фото
        </div>
        <div className="mt-2 grid gap-2">
          {request.attachments.map((attachment) => (
            <div
              className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white px-3 py-2 text-sm"
              key={attachment.id}
            >
              <div>
                <div className="font-medium text-slate-950">
                  {attachment.originalName}
                </div>
                <div className="text-slate-500">
                  {formatFileSize(attachment.size)} ·{" "}
                  {attachment.uploadedBy?.name ?? attachment.uploadedById}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="inline-flex h-9 items-center justify-center rounded-md border border-teal-200 bg-white px-3 text-xs font-medium text-teal-700 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isPreviewLoading === attachment.id}
                  onClick={() => void openPreview(attachment)}
                  type="button"
                >
                  {isPreviewLoading === attachment.id
                    ? "Открываем..."
                    : "Просмотреть"}
                </button>
                <button
                  className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() =>
                    void downloadSupplyRequestAttachment(
                      request.id,
                      attachment.id,
                      attachment.originalName,
                    ).catch(() => window.alert("Не удалось скачать файл"))
                  }
                  type="button"
                >
                  Скачать
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {preview ? (
        <AttachmentPreviewModal
          attachment={preview.attachment}
          contentType={preview.contentType}
          onClose={closePreview}
          url={preview.url}
        />
      ) : null}
    </>
  );
}

function AttachmentPreviewModal({
  attachment,
  contentType,
  onClose,
  url,
}: {
  attachment: SupplyRequestAttachment;
  contentType: string;
  onClose: () => void;
  url: string;
}) {
  const canPreviewAsImage = contentType.startsWith("image/");
  const canPreviewAsPdf = contentType.includes("pdf");

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-slate-950">
              {attachment.originalName}
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              {formatFileSize(attachment.size)}
            </div>
          </div>
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-3">
          {canPreviewAsImage ? (
            <img
              alt={attachment.originalName}
              className="mx-auto max-h-[72vh] max-w-full rounded-md bg-white object-contain"
              src={url}
            />
          ) : canPreviewAsPdf ? (
            <iframe
              className="h-[72vh] w-full rounded-md border border-slate-200 bg-white"
              src={url}
              title={attachment.originalName}
            />
          ) : (
            <div className="rounded-md bg-white p-4 text-sm text-slate-600">
              Этот формат нельзя надежно показать в браузере. Скачайте файл,
              чтобы открыть его в подходящей программе.
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <a
            className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            download={attachment.originalName}
            href={url}
          >
            Скачать
          </a>
          <button
            className="inline-flex h-10 items-center justify-center rounded-md bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800"
            onClick={onClose}
            type="button"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}

function InvoiceList({
  onDeleteInvoice,
  request,
}: {
  onDeleteInvoice?: (request: SupplyRequest, invoiceId: string) => void;
  request: SupplyRequest;
}) {
  const [preview, setPreview] = useState<{
    contentType: string;
    invoice: SupplyRequestInvoice;
    url: string;
  } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (preview?.url) {
        URL.revokeObjectURL(preview.url);
      }
    };
  }, [preview?.url]);

  if (request.type === "MONEY") {
    return null;
  }

  if (!request.invoices?.length) {
    return (
      <div className="mt-4 rounded-md border border-dashed border-slate-300 p-3 text-sm text-slate-500">
        {"Счета на оплату пока не прикреплены."}
      </div>
    );
  }

  async function openPreview(invoice: SupplyRequestInvoice) {
    setPreviewError(null);
    setIsPreviewLoading(invoice.id);

    try {
      const nextPreview = await getSupplyRequestInvoicePreview(
        request.id,
        invoice.id,
      );

      if (preview?.url) {
        URL.revokeObjectURL(preview.url);
      }

      setPreview({
        ...nextPreview,
        invoice,
      });
    } catch {
      setPreviewError("Не удалось открыть счет для просмотра.");
    } finally {
      setIsPreviewLoading(null);
    }
  }

  function closePreview() {
    if (preview?.url) {
      URL.revokeObjectURL(preview.url);
    }

    setPreview(null);
    setPreviewError(null);
  }

  return (
    <>
      <div className="mt-4 rounded-md bg-slate-50 p-3">
        <div className="text-sm font-medium text-slate-950">
          Прикрепленные счета
        </div>
        {previewError ? (
          <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {previewError}
          </div>
        ) : null}
        <div className="mt-2 grid gap-2">
          {request.invoices.map((invoice) => {
            const displayName = normalizeDisplayedFileName(invoice.originalName);

            return (
              <div
                className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white px-3 py-2 text-sm"
                key={invoice.id}
              >
                <div>
                  <div className="font-medium text-slate-950">
                    {displayName}
                  </div>
                  <div className="text-slate-500">
                    {formatFileSize(invoice.size)} ·{" "}
                    {invoice.uploadedBy?.name ?? invoice.uploadedById}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="inline-flex h-9 items-center justify-center rounded-md border border-teal-200 bg-white px-3 text-xs font-medium text-teal-700 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isPreviewLoading === invoice.id}
                    onClick={() => void openPreview(invoice)}
                    type="button"
                  >
                    {isPreviewLoading === invoice.id
                      ? "Открываем..."
                      : "Просмотреть"}
                  </button>
                  <button
                    className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    onClick={() =>
                      void downloadSupplyRequestInvoice(
                        request.id,
                        invoice.id,
                        displayName,
                      ).catch(() => window.alert("Не удалось скачать счет"))
                    }
                    type="button"
                  >
                    Скачать
                  </button>
                  {onDeleteInvoice ? (
                    <button
                      className="inline-flex h-9 items-center justify-center rounded-md border border-red-200 bg-white px-3 text-xs font-medium text-red-700 hover:bg-red-50"
                      onClick={() => onDeleteInvoice(request, invoice.id)}
                      type="button"
                    >
                      Удалить
                    </button>
                  ) : null}
                  <div className="text-xs text-slate-500">
                    {new Date(invoice.createdAt).toLocaleDateString("ru-KZ")}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {preview ? (
        <InvoicePreviewModal
          contentType={preview.contentType}
          invoice={preview.invoice}
          onClose={closePreview}
          url={preview.url}
        />
      ) : null}
    </>
  );
}

function getSupplyChecklistStorageKey(
  scope: string,
  requestId: string,
  itemId: string,
) {
  return `supply-item-checklist:${scope}:${requestId}:${itemId}`;
}

function InvoiceUploadForm({
  onSubmit,
  request,
}: {
  onSubmit: (request: SupplyRequest, event: FormEvent<HTMLFormElement>) => void;
  request: SupplyRequest;
}) {
  if (request.type === "MONEY") {
    return null;
  }

  return (
    <form
      className="mt-4 grid gap-3 rounded-md border border-dashed border-teal-200 bg-teal-50/40 p-3"
      onSubmit={(event) => onSubmit(request, event)}
    >
      <div>
        <div className="text-sm font-medium text-slate-950">
          Прикрепить счета
        </div>
        <div className="mt-1 text-xs text-slate-500">
          Файлы добавятся к заявке без изменения этапа согласования.
        </div>
      </div>
      <input
        className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-teal-700 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
        multiple
        name="files"
        type="file"
      />
      <input
        className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-700"
        name="comment"
        placeholder="Комментарий к счетам"
      />
      <div className="flex justify-end">
        <button
          className="inline-flex h-9 items-center justify-center rounded-md bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800"
          type="submit"
        >
          Прикрепить счета
        </button>
      </div>
    </form>
  );
}

function PrintRequestAction({ request }: { request: SupplyRequest }) {
  return (
    <div className="mt-4 flex justify-end">
      <a
        className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        href={`/dashboard/requests/${request.id}/print`}
        rel="noreferrer"
        target="_blank"
      >
        <Printer size={16} />
        Печать
      </a>
    </div>
  );
}

function InvoicePreviewModal({
  contentType,
  invoice,
  onClose,
  url,
}: {
  contentType: string;
  invoice: SupplyRequestInvoice;
  onClose: () => void;
  url: string;
}) {
  const canPreviewAsImage = contentType.startsWith("image/");
  const canPreviewAsPdf = contentType.includes("pdf");
  const displayName = normalizeDisplayedFileName(invoice.originalName);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-slate-950">
              {displayName}
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              {formatFileSize(invoice.size)}
            </div>
          </div>
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-3">
          {canPreviewAsImage ? (
            <img
              alt={displayName}
              className="mx-auto max-h-[72vh] max-w-full rounded-md bg-white object-contain"
              src={url}
            />
          ) : canPreviewAsPdf ? (
            <iframe
              className="h-[72vh] w-full rounded-md border border-slate-200 bg-white"
              src={url}
              title={displayName}
            />
          ) : (
            <div className="rounded-md bg-white p-4 text-sm text-slate-600">
              Этот формат нельзя надежно показать в браузере. Скачайте файл,
              чтобы открыть его в подходящей программе.
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <a
            className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            download={displayName}
            href={url}
          >
            Скачать
          </a>
          <button
            className="inline-flex h-10 items-center justify-center rounded-md bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800"
            onClick={onClose}
            type="button"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
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

function formatFileSize(value: number) {
  if (value < 1024 * 1024) {
    return `${Math.max(Math.round(value / 1024), 1)} КБ`;
  }

  return `${(value / 1024 / 1024).toFixed(1)} МБ`;
}

function normalizeDisplayedFileName(fileName: string) {
  if (!/[AA?N]/.test(fileName)) {
    return fileName;
  }

  const bytes = Uint8Array.from(
    Array.from(fileName, (char) => char.charCodeAt(0) & 255),
  );
  const decodedName = new TextDecoder("utf-8").decode(bytes);

  return decodedName.includes("?") ? fileName : decodedName;
}
