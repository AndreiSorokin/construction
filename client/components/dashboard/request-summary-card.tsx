"use client";

import {
  Banknote,
  Boxes,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  History,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { ReactNode, useState } from "react";
import {
  SupplyRequest,
  SupplyRequestStatus,
  SupplyRequestType,
} from "@/lib/types";

type RequestSummaryCardProps = {
  children?: ReactNode;
  defaultOpen?: boolean;
  request: SupplyRequest;
  variant?: "default" | "approval";
};

const typeLabels: Record<SupplyRequestType, string> = {
  MATERIAL: "Материалы",
  TRANSPORT: "Спецтехника",
  MONEY: "Средства",
};

const statusLabels: Record<SupplyRequestStatus, string> = {
  CREATED: "Создана",
  PENDING_PTO: "В ПТО",
  PENDING_CHIEF_ENGINEER: "У главного инженера",
  PENDING_DEPUTY_PRODUCTION_DIRECTOR: "У зам. директора по производству",
  PENDING_SUPPLY_MANAGER: "У начальника снабжения",
  PENDING_SUPPLY: "У снабженца",
  PENDING_DIRECTOR: "У директора",
  PENDING_GARAGE_MANAGER: "У заведующего гаражом",
  RETURNED_TO_SUPPLY: "Возвращена снабжению",
  REJECTED: "Отклонена",
  IN_PROGRESS: "В работе",
  COMPLETED: "Исполнена",
  ARCHIVED: "Архив",
};

const statusClasses: Record<SupplyRequestStatus, string> = {
  CREATED: "bg-slate-100 text-slate-700",
  PENDING_PTO: "bg-amber-50 text-amber-700",
  PENDING_CHIEF_ENGINEER: "bg-indigo-50 text-indigo-700",
  PENDING_DEPUTY_PRODUCTION_DIRECTOR: "bg-fuchsia-50 text-fuchsia-700",
  PENDING_SUPPLY_MANAGER: "bg-sky-50 text-sky-700",
  PENDING_SUPPLY: "bg-cyan-50 text-cyan-700",
  PENDING_DIRECTOR: "bg-violet-50 text-violet-700",
  PENDING_GARAGE_MANAGER: "bg-lime-50 text-lime-700",
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
              {request.object?.name ?? request.objectId}
            </span>
          </span>
        </button>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${statusClasses[request.status]}`}
          >
            {statusLabels[request.status]}
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
              aria-label={isOpen ? "Свернуть заявку" : "Раскрыть заявку"}
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
  return typeLabels[type];
}

export function getRequestStatusLabel(status: SupplyRequestStatus) {
  return statusLabels[status];
}

function ExpandedRequestMeta({ request }: { request: SupplyRequest }) {
  return (
    <div className="mb-4 grid gap-2 rounded-md bg-slate-50 p-3 text-sm sm:grid-cols-3">
      <MetaItem label="Номер" value={request.requestNumber} />
      <MetaItem label="Тип" value={typeLabels[request.type]} />
      <MetaItem
        label="Дата"
        value={new Date(request.createdAt).toLocaleDateString("ru-KZ")}
      />
    </div>
  );
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

  return Boxes;
}
