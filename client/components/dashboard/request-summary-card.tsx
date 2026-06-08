"use client";

import {
  Banknote,
  Boxes,
  ChevronDown,
  Factory,
  History,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { ReactNode, useState } from "react";
import {
  requestStatusLabels,
  requestTypeLabels,
  userRoleLabels,
} from "@/lib/domain-labels";
import {
  SupplyRequest,
  SupplyRequestItem,
  SupplyRequestStatus,
  SupplyRequestType,
  UserRole,
} from "@/lib/types";

type RequestSummaryCardProps = {
  children?: ReactNode;
  defaultOpen?: boolean;
  request: SupplyRequest;
  variant?: "default" | "approval";
};

const NEW_ROUTE_STARTED_AT = new Date("2026-06-07T00:00:00+03:00");

const statusClasses: Record<SupplyRequestStatus, string> = {
  CREATED: "bg-slate-100 text-slate-700",
  PENDING_PTO: "bg-amber-50 text-amber-700",
  PENDING_CHIEF_ENGINEER: "bg-indigo-50 text-indigo-700",
  PENDING_DEPUTY_PRODUCTION_DIRECTOR: "bg-fuchsia-50 text-fuchsia-700",
  PENDING_DEPUTY_TRANSPORT_DIRECTOR: "bg-orange-50 text-orange-700",
  PENDING_SUPPLY_MANAGER: "bg-sky-50 text-sky-700",
  PENDING_SUPPLY_MANAGER_REVIEW: "bg-sky-50 text-sky-700",
  PENDING_SUPPLY: "bg-cyan-50 text-cyan-700",
  PENDING_DIRECTOR: "bg-violet-50 text-violet-700",
  PENDING_GARAGE_MANAGER: "bg-lime-50 text-lime-700",
  PENDING_WAREHOUSE_MANAGER: "bg-emerald-50 text-emerald-700",
  PENDING_STOREKEEPER: "bg-stone-100 text-stone-700",
  PENDING_ACCOUNTANT: "bg-rose-50 text-rose-700",
  PENDING_TRANSPORT_AUTHOR: "bg-lime-50 text-lime-700",
  PENDING_WORKSHOP_MANAGER: "bg-indigo-50 text-indigo-700",
  PENDING_PRODUCTION_AUTHOR: "bg-indigo-50 text-indigo-700",
  PENDING_REQUEST_AUTHOR: "bg-cyan-50 text-cyan-700",
  RETURNED_TO_SUPPLY: "bg-orange-50 text-orange-700",
  REJECTED: "bg-red-50 text-red-700",
  IN_PROGRESS: "bg-teal-50 text-teal-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  ARCHIVED: "bg-slate-100 text-slate-500",
};

const typeClasses: Record<SupplyRequestType, string> = {
  MATERIAL: "bg-teal-50 text-teal-700",
  TRANSPORT: "bg-lime-50 text-lime-700",
  MONEY: "bg-violet-50 text-violet-700",
  PRODUCTION: "bg-indigo-50 text-indigo-700",
  QUARRY: "bg-stone-100 text-stone-700",
  EXPRESS_MATERIAL: "bg-cyan-50 text-cyan-700",
  FUEL: "bg-yellow-50 text-yellow-700",
  BUSINESS_TRIP: "bg-fuchsia-50 text-fuchsia-700",
  APPEAL: "bg-slate-100 text-slate-700",
};

export function RequestSummaryCard({
  children,
  defaultOpen = false,
  request,
  variant = "default",
}: RequestSummaryCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const TypeIcon = getTypeIcon(request.type);
  const isApproval = variant === "approval";
  const isLegacyRequest = isLegacyRouteRequest(request);

 function getRequestItemsLabel(request: SupplyRequest) {
  if (request.type === "MONEY") {
    return "Средства";
  }

  if (request.type === "TRANSPORT") {
    return "Транспорт";
  }

  if (request.type === "FUEL") {
    return request.transportType ?? "Топливо";
  }

  if (request.type === "BUSINESS_TRIP") {
    return request.paymentPurpose ?? "Командировочные";
  }

  if (request.type === "APPEAL") {
    return request.purpose ?? "Обращение";
  }

  if (request.type === "PRODUCTION") {
    return request.purpose ?? "Производство";
  }

  if (request.type === "APPEAL") {
    return request.purpose ?? "Обращение";
  }

  if (request.type === "QUARRY" || request.type === "EXPRESS_MATERIAL") {
    return request.items.map((item) => item.materialNameSnapshot).join(", ");
  }

  return request.items
    .map((item) => item.materialNameSnapshot)
    .join(", ");
}


  

  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-3 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <button
          className="grid min-w-0 grid-cols-[2rem_1fr] gap-3 text-left"
          onClick={() => setIsOpen((current) => !current)}
          type="button"
        >
          <span
            className={`grid size-8 shrink-0 place-items-center rounded-md ${typeClasses[request.type]}`}
          >
            <TypeIcon size={16} />
          </span>

          <span className="min-w-0">
            <span className="block truncate font-medium text-slate-950">
              {getRequestItemsLabel(request)}
            </span>
            <span className="mt-1 block truncate text-xs text-slate-500">
              {getCurrentHolderLabel(request)}
            </span>
          </span>
        </button>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {isLegacyRequest ? (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
              Старая цепочка
            </span>
          ) : null}
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${statusClasses[request.status]}`}
          >
            {requestStatusLabels[request.status]}
          </span>
          <Link
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            href={`/dashboard/requests/${request.id}/history`}
          >
            <History size={14} />
            История
          </Link>
          {children ? (
            <button
              aria-label={isOpen ? "Свернуть" : "Развернуть"}
              className="grid size-8 place-items-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50"
              onClick={() => setIsOpen((current) => !current)}
              type="button"
            >
              <ChevronDown
                className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
                size={16}
              />
            </button>
          ) : null}
        </div>
      </div>

      {isOpen && children ? (
        <div className="border-t border-slate-100 p-4">
          {isApproval ? <ExpandedRequestMeta request={request} /> : null}
          {children}
        </div>
      ) : null}
    </article>
  );
}

export function getRequestTypeLabel(type: SupplyRequestType) {
  return requestTypeLabels[type];
}

export function getRequestStatusLabel(status: SupplyRequestStatus) {
  return requestStatusLabels[status];
}

function ExpandedRequestMeta({ request }: { request: SupplyRequest }) {
  const authorRole = getAuthorObjectRole(request);
  const authorRoleLabel = authorRole ? userRoleLabels[authorRole] : "Роль не указана";
  const currentHolderLabel = getCurrentHolderLabel(request);
  const workflowLabel = isLegacyRouteRequest(request)
    ? "Старая цепочка"
    : "Новая цепочка";

  return (
    <div className="mb-4 grid gap-2 rounded-md bg-slate-50 p-3 text-sm sm:grid-cols-3">
      <MetaItem label="Номер" value={request.requestNumber} />
      <MetaItem label="Тип" value={requestTypeLabels[request.type]} />
      <MetaItem
        label="Дата"
        value={new Date(request.createdAt).toLocaleDateString("ru-KZ")}
      />
      <MetaItem label="Автор" value={request.author?.name ?? "Не указан"} />
      <MetaItem label="Email автора" value={request.author?.email ?? "Не указан"} />
      <MetaItem label="Должность автора" value={authorRoleLabel} />
      <MetaItem label="Цепочка" value={workflowLabel} />
      <MetaItem label="Сейчас у" value={currentHolderLabel} />
    </div>
  );
}

function isLegacyRouteRequest(request: SupplyRequest) {
  return new Date(request.createdAt).getTime() < NEW_ROUTE_STARTED_AT.getTime();
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-slate-500">{label}</div>
      <div className="mt-1 font-medium text-slate-950">{value}</div>
    </div>
  );
}

function getTypeIcon(type: SupplyRequestType) {
  if (type === "TRANSPORT") {
    return Truck;
  }

  if (type === "MONEY") {
    return Banknote;
  }

  if (type === "PRODUCTION") {
    return Factory;
  }

  return Boxes;
}

function getAuthorObjectRole(request: SupplyRequest) {
  if (request.authorObjectRole) {
    return request.authorObjectRole;
  }

  const objectAccessRole = request.object?.userAccesses?.find(
    (access) => access.userId === request.authorId,
  )?.role;

  if (objectAccessRole) {
    return objectAccessRole;
  }

  return request.author?.objectAccesses?.find(
    (access) => access.objectId === request.objectId,
  )?.role;
}

function getCurrentHolderLabel(request: SupplyRequest) {
  if (request.status === "COMPLETED") {
    return "Заявка исполнена";
  }

  if (request.status === "ARCHIVED") {
    return "Заявка в архиве";
  }

  if (request.status === "REJECTED") {
    return "Заявка отклонена";
  }

  if (
    request.status === "PENDING_SUPPLY" ||
    request.status === "RETURNED_TO_SUPPLY" ||
    request.status === "IN_PROGRESS"
  ) {
    return request.assignedSupplyUser
      ? formatUserHolder("Снабженец", request.assignedSupplyUser)
      : formatRoleHolders(request, "SUPPLY");
  }

  if (request.status === "PENDING_STOREKEEPER") {
    return request.assignedStorekeeper
      ? formatUserHolder("Кладовщик", request.assignedStorekeeper)
      : formatRoleHolders(request, "STOREKEEPER");
  }

  if (request.status === "PENDING_WORKSHOP_MANAGER") {
    return request.assignedWorkshopManager
      ? formatUserHolder("Начальник цеха", request.assignedWorkshopManager)
      : formatRoleHolders(request, "WORKSHOP_MANAGER");
  }

  if (
    request.status === "PENDING_TRANSPORT_AUTHOR" ||
    request.status === "PENDING_PRODUCTION_AUTHOR" ||
    request.status === "PENDING_REQUEST_AUTHOR"
  ) {
    return request.author
      ? formatUserHolder("Автор", request.author)
      : "У автора заявки";
  }

  const role = holderRoleByStatus[request.status];

  if (!role) {
    return requestStatusLabels[request.status];
  }

  return formatRoleHolders(request, role);
}

const holderRoleByStatus: Partial<Record<SupplyRequestStatus, UserRole>> = {
  CREATED: "FOREMAN",
  PENDING_ACCOUNTANT: "ACCOUNTANT",
  PENDING_CHIEF_ENGINEER: "CHIEF_ENGINEER",
  PENDING_DEPUTY_PRODUCTION_DIRECTOR: "DEPUTY_PRODUCTION_DIRECTOR",
  PENDING_DEPUTY_TRANSPORT_DIRECTOR: "DEPUTY_TRANSPORT_DIRECTOR",
  PENDING_DIRECTOR: "DIRECTOR",
  PENDING_GARAGE_MANAGER: "GARAGE_MANAGER",
  PENDING_PTO: "PTO",
  PENDING_SUPPLY_MANAGER: "SUPPLY_MANAGER",
  PENDING_SUPPLY_MANAGER_REVIEW: "SUPPLY_MANAGER",
  PENDING_WAREHOUSE_MANAGER: "WAREHOUSE_MANAGER",
};

function formatRoleHolders(request: SupplyRequest, role: UserRole) {
  const roleLabel = userRoleLabels[role] ?? role;
  const users =
    request.object?.userAccesses
      ?.filter((access) => access.role === role && access.user)
      .map((access) => access.user)
      .filter((user): user is NonNullable<typeof user> => Boolean(user)) ?? [];

  if (!users.length) {
    return `${roleLabel} не назначен на этом объекте/цехе`;
  }

  const formattedUsers = users
    .map((user) => `${user.name ?? "Без имени"} (${user.email})`)
    .join(", ");

  return `${roleLabel}: ${formattedUsers}`;
}

function formatUserHolder(label: string, user: { email: string; name?: string | null }) {
  return `${label}: ${user.name ?? "Без имени"} (${user.email})`;
}
