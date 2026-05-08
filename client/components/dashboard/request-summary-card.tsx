"use client";

import { ChevronDown, History } from "lucide-react";
import Link from "next/link";
import { ReactNode, useState } from "react";
import { SupplyRequest, SupplyRequestStatus, SupplyRequestType } from "@/lib/types";

type RequestSummaryCardProps = {
  children?: ReactNode;
  defaultOpen?: boolean;
  request: SupplyRequest;
};

const typeLabels: Record<SupplyRequestType, string> = {
  MATERIAL: "Материалы",
  TRANSPORT: "Транспорт",
  MONEY: "Деньги",
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

export function RequestSummaryCard({
  children,
  defaultOpen = false,
  request,
}: RequestSummaryCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="rounded-md border border-slate-200 bg-white">
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
          onClick={() => setIsOpen((current) => !current)}
          type="button"
        >
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-600">
            <ChevronDown
              className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
              size={16}
            />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium text-slate-950">
              {request.object?.name ?? request.objectId}
            </span>
            <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-500">
              <span>{typeLabels[request.type]}</span>
              <span>{new Date(request.createdAt).toLocaleDateString("ru-KZ")}</span>
              <span>{request.requestNumber}</span>
            </span>
          </span>
        </button>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
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
        </div>
      </div>

      {isOpen ? <div className="border-t border-slate-100 p-4">{children}</div> : null}
    </div>
  );
}

export function getRequestTypeLabel(type: SupplyRequestType) {
  return typeLabels[type];
}

export function getRequestStatusLabel(status: SupplyRequestStatus) {
  return statusLabels[status];
}
