"use client";

import { Check, Send, X } from "lucide-react";
import { FormEvent, ReactNode, useState } from "react";
import { RequestSummaryCard } from "@/components/dashboard/request-summary-card";
import { requestStatusLabels } from "@/lib/domain-labels";
import { downloadSupplyRequestInvoice } from "@/lib/supply-requests-api";
import { SupplyRequest, User } from "@/lib/types";

export type ObjectRequestGroup = {
  objectId: string;
  objectName: string;
  positionsCount: number;
  requests: SupplyRequest[];
};

export function ObjectApprovalGroup({
  children,
  group,
}: {
  children: ReactNode;
  group: ObjectRequestGroup;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const createdAt = group.requests
    .map((request) => new Date(request.createdAt).getTime())
    .filter(Number.isFinite)
    .sort((firstDate, secondDate) => secondDate - firstDate)[0];

  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <button
        className="grid w-full gap-3 px-4 py-3 text-left sm:grid-cols-[1fr_auto] sm:items-center"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <span className="min-w-0">
          <span className="block truncate font-medium text-slate-950">
            {group.objectName}
          </span>
          <span className="mt-1 block text-sm text-slate-500">
            Позиций на согласование: {group.positionsCount}
          </span>
        </span>
        <div style={{cursor: 'pointer'}}>{isOpen ? "Свернуть" : "Развернуть"}</div>
      </button>

      {isOpen ? (
        <div className="grid gap-3 border-t border-slate-100 bg-slate-50/60 p-3">
          {children}
        </div>
      ) : null}
    </article>
  );
}

export function SupplyManagerRequestCard({
  onSubmit,
  request,
  supplyUsers,
}: {
  onSubmit: (
    request: SupplyRequest,
    event: FormEvent<HTMLFormElement>,
  ) => void;
  request: SupplyRequest;
  supplyUsers: User[];
}) {
  return (
    <form
      className="rounded-md border border-slate-200 p-4"
      onSubmit={(event) => onSubmit(request, event)}
    >
      <RequestSummaryCard request={request} variant="approval">

      {request.type === "TRANSPORT" ? (
        <TransportDetails request={request} />
      ) : request.type === "MONEY" ? (
        <MoneyDetails request={request} />
      ) : (
        <MaterialItemsTable request={request} />
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
      </RequestSummaryCard>
    </form>
  );
}

export function SupplyManagerTransportRequestCard({
  onSendToGarage,
  request,
}: {
  onSendToGarage: (request: SupplyRequest) => void;
  request: SupplyRequest;
}) {
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <RequestSummaryCard request={request} variant="approval">
        <TransportDetails request={request} />
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800"
            onClick={() => onSendToGarage(request)}
            type="button"
          >
            <Send size={16} />
            Отправить заведующему гаражом
          </button>
        </div>
      </RequestSummaryCard>
    </div>
  );
}

export function GarageManagerTransportRequestCard({
  onComplete,
  request,
}: {
  onComplete: (request: SupplyRequest) => void;
  request: SupplyRequest;
}) {
  return (
    <div className="rounded-md border border-lime-200 bg-lime-50/40 p-4">
      <RequestSummaryCard request={request} variant="approval">
        <TransportDetails request={request} />
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800"
            onClick={() => onComplete(request)}
            type="button"
          >
            <Send size={16} />
            Отправить автору на подтверждение
          </button>
        </div>
      </RequestSummaryCard>
    </div>
  );
}

export function TransportAuthorCompletionCard({
  onComplete,
  request,
}: {
  onComplete: (request: SupplyRequest) => void;
  request: SupplyRequest;
}) {
  return (
    <div className="rounded-md border border-lime-200 bg-lime-50/40 p-4">
      <RequestSummaryCard request={request} variant="approval">
        <TransportDetails request={request} />
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800"
            onClick={() => onComplete(request)}
            type="button"
          >
            <Check size={16} />
            Подтвердить исполнение
          </button>
        </div>
      </RequestSummaryCard>
    </div>
  );
}

export function PtoRequestCard({
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
      <RequestSummaryCard request={request} variant="approval">

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-3 font-medium">Материал</th>
              <th className="py-2 pr-3 font-medium">Количество</th>
              <th className="py-2 pr-3 font-medium">{"Сметная цена ПТО за ед."}</th>
              <th className="py-2 pr-3 font-medium">Удаление</th>
            </tr>
          </thead>
          <tbody>
            {request.items.map((item) => (
              <tr className="border-b border-slate-100" key={item.id}>
                <td className="py-3 pr-3 text-slate-950">
                  {item.materialNameSnapshot}
                </td>
                <td className="py-3 pr-3 text-slate-600">
                  <QuantityWithEdit
                    item={item}
                    request={request}
                    onUpdate={onUpdateItem}
                  />
                </td>
                <td className="py-3 pr-3">
                  <input
                    className="h-10 w-36 rounded-md border border-slate-300 px-3 outline-none focus:border-teal-700"
                    defaultValue={String(item.ptoLimitPrice ?? "")}
                    min="0.01"
                    name={`ptoLimitPrice:${item.id}`}
                    required
                    step="0.01"
                    type="number"
                  />
                </td>
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
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800"
          type="submit"
        >
          <Send size={16} />
          Отправить начальнику снабжения
        </button>
      </div>
      </RequestSummaryCard>
    </form>
  );
}

export function ChiefEngineerRequestCard({
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
      <RequestSummaryCard request={request} variant="approval">

        {request.type === "MATERIAL" ? (
          <>
            <EditableMaterialItemsTable
              request={request}
              onDeleteItem={onDeleteItem}
              onUpdateItem={onUpdateItem}
            />
          </>
        ) : request.type === "TRANSPORT" ? (
          <TransportDetails request={request} />
        ) : (
          <MoneyDetails request={request} />
        )}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        {request.type === "MATERIAL" || request.type === "TRANSPORT" ? (
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-red-200 bg-white px-3 text-sm font-medium text-red-700 hover:bg-red-50"
          onClick={() => onReturn(request)}
          type="button"
        >
          <X size={16} />
          Отклонить заявку
        </button>
        ) : null}
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800"
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
  onDeleteItem,
  onUpdateItem,
  request,
}: {
  onApprove: (request: SupplyRequest) => void;
  onDeleteItem: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
  ) => void;
  onUpdateItem: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
  ) => void;
  request: SupplyRequest;
}) {
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <RequestSummaryCard request={request} variant="approval">
        <EditableMaterialItemsTable
          request={request}
          onDeleteItem={onDeleteItem}
          onUpdateItem={onUpdateItem}
        />
        <div className="mt-4 flex justify-end">
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800"
            onClick={() => onApprove(request)}
            type="button"
          >
            <Send size={16} />
            Передать в ПТО
          </button>
        </div>
      </RequestSummaryCard>
    </div>
  );
}

function getChiefEngineerApproveLabel(type: SupplyRequest["type"]) {
  if (type === "MATERIAL") {
    return "Согласовать и отправить начальнику складского хозяйства";
  }

  if (type === "TRANSPORT") {
    return "Согласовать и отправить заведующему гаражом";
  }

  return "Согласовать и отправить начальнику снабжения";
}

export function DeputyProductionDirectorRequestCard({
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
      <RequestSummaryCard request={request} variant="approval">
        {request.type === "MATERIAL" ? (
          <>
            <PriceComparisonTable
              request={request}
              mode="pto"
              onDeleteItem={onDeleteItem}
              onUpdateItem={onUpdateItem}
            />
            <Totals request={request} mode="pto" />
          </>
        ) : request.type === "TRANSPORT" ? (
          <TransportDetails request={request} />
        ) : (
          <MoneyDetails request={request} />
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
            Подтвердить
          </button>
        </div>
      </RequestSummaryCard>
    </div>
  );
}

export function SupplyRequestCard({
  onDeleteInvoice,
  onSubmit,
  request,
}: {
  onDeleteInvoice?: (request: SupplyRequest, invoiceId: string) => void;
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
      <RequestSummaryCard request={request} variant="approval">

      <MaterialItemsTable request={request} />
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
            required
            type="file"
          />
        </label>
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
          Отправить директору со счетами
        </button>
      </div>
      </RequestSummaryCard>
    </form>
  );
}

export function SupplyMoneyRequestCard({
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
      <RequestSummaryCard request={request} variant="approval">
        <MoneyDetails request={request} />
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
      </RequestSummaryCard>
    </form>
  );
}

export function SupplyTransportRequestCard({
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
            required
            type="file"
          />
        </label>
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
          Отправить директору со счетами
        </button>
      </div>
      </RequestSummaryCard>
    </form>
  );
}

export function SupplyInProgressCard({
  onComplete,
  request,
}: {
  onComplete: (request: SupplyRequest) => void;
  request: SupplyRequest;
}) {
  return (
    <div className="rounded-md border border-emerald-200 bg-emerald-50/40 p-4">
      <RequestSummaryCard request={request} variant="approval">

      {request.type === "TRANSPORT" ? (
        <TransportDetails request={request} />
      ) : request.type === "MONEY" ? (
        <MoneyDetails request={request} />
      ) : (
        <MaterialItemsTable request={request} />
      )}
      <InvoiceList request={request} />
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800"
          onClick={() => onComplete(request)}
          type="button"
        >
          <Send size={16} />
          Передать кладовщику
        </button>
      </div>
      </RequestSummaryCard>
    </div>
  );
}

export function StorekeeperRequestCard({
  onComplete,
  request,
}: {
  onComplete: (
    request: SupplyRequest,
    event: FormEvent<HTMLFormElement>,
  ) => void;
  request: SupplyRequest;
}) {
  return (
    <form
      className="rounded-md border border-stone-200 bg-stone-50/50 p-4"
      onSubmit={(event) => onComplete(request, event)}
    >
      <RequestSummaryCard request={request} variant="approval">
        <StorekeeperItemsChecklist request={request} />
        <InvoiceList request={request} />
        <div className="mt-4 grid gap-3">
          <input
            className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-teal-700"
            name="comment"
            placeholder="Комментарий кладовщика"
          />
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800"
            type="submit"
          >
            <Check size={16} />
            Подтвердить исполнение
          </button>
        </div>
      </RequestSummaryCard>
    </form>
  );
}

export function DirectorRequestCard({
  onApprove,
  onDeleteItem,
  onReject,
  onReturn,
  onUpdateItem,
  request,
}: {
  onApprove: (request: SupplyRequest) => void;
  onDeleteItem: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
  ) => void;
  onReject: (request: SupplyRequest) => void;
  onReturn: (request: SupplyRequest) => void;
  onUpdateItem: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
  ) => void;
  request: SupplyRequest;
}) {
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <RequestSummaryCard request={request} variant="approval">

      {request.type === "TRANSPORT" ? (
        <TransportDetails request={request} />
      ) : request.type === "MONEY" ? (
        <MoneyDetails request={request} />
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
      <InvoiceList request={request} />
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        {request.type === "MATERIAL" ? (
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-amber-200 bg-white px-3 text-sm font-medium text-amber-700 hover:bg-amber-50"
            onClick={() => onReturn(request)}
            type="button"
          >
            <X size={16} />
            Вернуть
          </button>
        ) : null}
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
          {request.type === "MATERIAL"
            ? "Согласовать"
            : "Отметить исполненной"}
        </button>
      </div>
      </RequestSummaryCard>
    </div>
  );
}

function QuantityWithEdit({
  item,
  onUpdate,
  request,
}: {
  item: SupplyRequest["items"][number];
  onUpdate: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
  ) => void;
  request: SupplyRequest;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>
        {formatQuantity(item.quantity)} {item.measurementUnitSnapshot}
      </span>
      <button
        className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        onClick={() => onUpdate(request, item)}
        type="button"
      >
        Изменить
      </button>
    </div>
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

function MaterialItemsTable({ request }: { request: SupplyRequest }) {
  const shouldShowFulfillmentStatus = request.items.some(
    (item) => item.fulfillmentStatus !== "PENDING",
  );

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="py-2 pr-3 font-medium">Материал</th>
            <th className="py-2 pr-3 font-medium">Количество</th>
            {shouldShowFulfillmentStatus ? (
              <th className="py-2 pr-3 font-medium">Статус</th>
            ) : null}
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

function getFulfillmentStatusLabel(
  status: SupplyRequest["items"][number]["fulfillmentStatus"],
) {
  if (status === "COMPLETED") {
    return "Исполнено";
  }

  if (status === "SKIPPED") {
    return "Пропущено";
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

function StorekeeperItemsChecklist({ request }: { request: SupplyRequest }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="py-2 pr-3 font-medium">Исполнено</th>
            <th className="py-2 pr-3 font-medium">Материал</th>
            <th className="py-2 pr-3 font-medium">Количество</th>
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
              </td>
              <td className="py-3 pr-3 text-slate-600">
                {formatQuantity(item.quantity)} {item.measurementUnitSnapshot}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-slate-500">
        Отмеченные позиции будут исполнены. Неотмеченные автоматически получат
        статус «Пропущено».
      </p>
    </div>
  );
}

function EditableMaterialItemsTable({
  onDeleteItem,
  onUpdateItem,
  request,
}: {
  onDeleteItem: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
  ) => void;
  onUpdateItem: (
    request: SupplyRequest,
    item: SupplyRequest["items"][number],
  ) => void;
  request: SupplyRequest;
}) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[620px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="py-2 pr-3 font-medium">Материал</th>
            <th className="py-2 pr-3 font-medium">Количество</th>
            <th className="py-2 pr-3 font-medium">Удаление</th>
          </tr>
        </thead>
        <tbody>
          {request.items.map((item) => (
            <tr className="border-b border-slate-100" key={item.id}>
              <td className="py-3 pr-3 text-slate-950">
                {item.materialNameSnapshot}
              </td>
              <td className="py-3 pr-3 text-slate-600">
                <QuantityWithEdit
                  item={item}
                  request={request}
                  onUpdate={onUpdateItem}
                />
              </td>
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
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="py-2 pr-3 font-medium">Материал</th>
            <th className="py-2 pr-3 font-medium">Количество</th>
            <th className="py-2 pr-3 font-medium">Цена ПТО за ед.</th>
            <th className="py-2 pr-3 font-medium">{"Сумма ПТО"}</th>
            {canEditItems ? (
              <th className="py-2 pr-3 font-medium">Удаление</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {request.items.map((item) => {
            const ptoTotal = getPtoTotal(item);

            return (
              <tr className="border-b border-slate-100" key={item.id}>
                <td className="py-3 pr-3 text-slate-950">
                  {item.materialNameSnapshot}
                </td>
                <td className="py-3 pr-3 text-slate-600">
                  {canEditItems && onUpdateItem ? (
                    <QuantityWithEdit
                      item={item}
                      request={request}
                      onUpdate={onUpdateItem}
                    />
                  ) : (
                    `${formatQuantity(item.quantity)} ${item.measurementUnitSnapshot}`
                  )}
                </td>
                <td className="py-3 pr-3 font-medium text-slate-950">
                  {formatMoney(toNumber(item.ptoLimitPrice))}
                </td>
                <td className="py-3 pr-3 text-slate-600">
                  {formatMoney(ptoTotal)}
                </td>
                {canEditItems && onDeleteItem && onUpdateItem ? (
                  <td className="py-3 pr-3">
                    <RequestItemDeleteAction
                      item={item}
                      request={request}
                      onDelete={onDeleteItem}
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

function Totals({ request }: { mode: "pto" | "supplier"; request: SupplyRequest }) {
  const ptoTotal = getRequestPtoTotal(request);

  return (
    <div className="mt-4 grid gap-2 rounded-md bg-slate-50 p-3 text-sm sm:grid-cols-3">
      <Metric label="Итого по цене ПТО" value={formatMoney(ptoTotal)} />
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

function MoneyDetails({ request }: { request: SupplyRequest }) {
  return (
    <div className="mt-4 grid gap-3 rounded-md bg-slate-50 p-3 text-sm sm:grid-cols-2">
      <div>
        <div className="text-slate-500">{"Сумма"}</div>
        <div className="mt-1 font-medium text-slate-950">
          {formatMoney(toNumber(request.amount))}
        </div>
      </div>
      <div>
        <div className="text-slate-500">Назначение платежа</div>
        <div className="mt-1 font-medium text-slate-950">
          {request.paymentPurpose ?? "Не указано"}
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

  return (
    <div className="mt-4 rounded-md bg-slate-50 p-3">
      <div className="text-sm font-medium text-slate-950">
        Прикрепленные счета
      </div>
      <div className="mt-2 grid gap-2">
        {request.invoices.map((invoice) => (
          <div
            className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white px-3 py-2 text-sm"
            key={invoice.id}
          >
            <div>
              <div className="font-medium text-slate-950">
                {invoice.originalName}
              </div>
              <div className="text-slate-500">
                {formatFileSize(invoice.size)} ·{" "}
                {invoice.uploadedBy?.name ?? invoice.uploadedById}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                onClick={() =>
                  void downloadSupplyRequestInvoice(
                    request.id,
                    invoice.id,
                    invoice.originalName,
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
        ))}
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

function formatFileSize(value: number) {
  if (value < 1024 * 1024) {
    return `${Math.max(Math.round(value / 1024), 1)} КБ`;
  }

  return `${(value / 1024 / 1024).toFixed(1)} МБ`;
}
