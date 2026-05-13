import { Clock3 } from "lucide-react";
import {
  requestStatusLabels,
  userRoleLabels,
} from "@/lib/domain-labels";
import {
  ApprovalAction,
  ApprovalHistoryEntry,
  SupplyRequestStatus,
  UserRole,
} from "@/lib/types";

type ApprovalHistoryListProps = {
  history?: ApprovalHistoryEntry[];
  compact?: boolean;
};

type ItemChangeDetails = {
  actorRole?: UserRole;
  materialName?: string;
  oldQuantity?: string;
  newQuantity?: string;
  quantity?: string;
  estimatedPriceSnapshot?: string;
};

const actionLabels: Record<ApprovalAction, string> = {
  CREATED: "Создана",
  APPROVED: "УтвержденаT",
  REJECTED: "Отклонена",
  RETURNED: "Возвращена",
  SENT_TO_PTO: "Отправлена в ПТО",
  SENT_TO_CHIEF_ENGINEER: "Отправлена главному инженеру",
  SENT_TO_SUPPLY_MANAGER: "Отправлена начальнику снабжения",
  SENT_TO_SUPPLY: "Отправлена в снабжение",
  SENT_TO_GARAGE_MANAGER: "Отправлена заведующему гаражом",
  SENT_TO_WAREHOUSE_MANAGER: "Отправлена начальнику складского хозяйства",
  SENT_TO_STOREKEEPER: "Отправлена кладовщику",
  SENT_TO_AUTHOR: "Отправлена автору заявки",
  ASSIGNED_TO_SUPPLY: "Назначена снабженцу",
  SENT_TO_DIRECTOR: "Отправлена директору",
  MARKED_IN_PROGRESS: "Взята в работу",
  COMPLETED: "Исполнена",
  ARCHIVED: "Архивирована",
  COMMENTED: "Комментарий",
  PRICE_UPDATED: "Цена обновлена",
  REQUEST_ITEM_UPDATED: "Позиция изменена",
  REQUEST_ITEM_DELETED: "Позиция удалена",
};


export function ApprovalHistoryList({
  compact = false,
  history,
}: ApprovalHistoryListProps) {
  if (!history?.length) {
    return (
      <div className="mt-4 rounded-md border border-dashed border-slate-200 p-3 text-sm text-slate-500">
        История согласования пока пустая.
      </div>
    );
  }

  return (
    <div className={compact ? "text-sm" : "mt-4 rounded-md bg-slate-50 p-3"}>
      <div className="flex items-center gap-2 text-sm font-medium text-slate-950">
        <Clock3 size={16} />
        История согласования
      </div>
      <div className="mt-3 grid gap-3">
        {history.map((entry) => (
          <div
            className="border-l-2 border-slate-200 pl-3 text-sm"
            key={entry.id}
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium text-slate-950">
                {actionLabels[entry.action] ?? entry.action}
              </span>
              <span className="text-slate-500">
                {formatHistoryDate(entry.createdAt)}
              </span>
            </div>
            <div className="mt-1 text-slate-600">
              {formatActor(entry)}
              {entry.fromStatus || entry.toStatus ? (
                <>
                  {" "}
                  · {formatStatusTransition(entry.fromStatus, entry.toStatus)}
                </>
              ) : null}
            </div>
            {formatItemChange(entry) ? (
              <div className="mt-2 rounded-md bg-white px-3 py-2 text-slate-700">
                {formatItemChange(entry)}
              </div>
            ) : null}
            {entry.comment ? (
              <div className="mt-2 rounded-md bg-white px-3 py-2 text-slate-700">
                {translateSystemComment(entry.comment)}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatActor(entry: ApprovalHistoryEntry) {
  const details = getItemChangeDetails(entry.changesJson);
  const actorName = entry.actor?.name ?? entry.actorId;
  const actorEmail = entry.actor?.email;
  const actorRole = details?.actorRole ? userRoleLabels[details.actorRole] : null;

  return [actorName, actorEmail, actorRole].filter(Boolean).join(" · ");
}

function formatItemChange(entry: ApprovalHistoryEntry) {
  const details = getItemChangeDetails(entry.changesJson);

  if (!details?.materialName) {
    return null;
  }

  if (entry.action === "REQUEST_ITEM_UPDATED") {
    return `Материал: ${details.materialName}. Количество: ${formatQuantity(
      details.oldQuantity,
    )} -> ${formatQuantity(details.newQuantity)}.`;
  }

  if (entry.action === "REQUEST_ITEM_DELETED") {
    return `Материал: ${details.materialName}. Удаленное количество: ${formatQuantity(
      details.quantity,
    )}. !<5B=0O F5=0: ${formatMoney(details.estimatedPriceSnapshot)}.`;
  }

  return null;
}

function getItemChangeDetails(value: unknown): ItemChangeDetails | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as ItemChangeDetails;
}

function formatStatusTransition(
  fromStatus?: SupplyRequestStatus | null,
  toStatus?: SupplyRequestStatus | null,
) {
  if (fromStatus && toStatus) {
    return `${requestStatusLabels[fromStatus]} -> ${requestStatusLabels[toStatus]}`;
  }

  if (toStatus) {
    return requestStatusLabels[toStatus];
  }

  if (fromStatus) {
    return requestStatusLabels[fromStatus];
  }

  return "";
}

function formatHistoryDate(value: string) {
  return new Intl.DateTimeFormat("ru-KZ", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatQuantity(value?: string) {
  const numberValue = Number(value ?? 0);

  return Number.isFinite(numberValue)
    ? numberValue.toLocaleString("ru-KZ")
    : String(value ?? "");
}

function formatMoney(value?: string) {
  const numberValue = Number(value ?? 0);

  return Number.isFinite(numberValue)
    ? `${numberValue.toLocaleString("ru-KZ")} тг`
    : String(value ?? "");
}

function translateSystemComment(comment: string) {
  const systemComments: Record<string, string> = {
    "Material supply request created and sent to PTO":
      "Заявка на материалы создана и отправлена",
    "Transport request created and sent to supply":
      "Заявка на транспорт создана и отправлена",
    "Money request created and sent to director":
      "Заявка на деньги создана и отправлена",
  };

  return systemComments[comment] ?? comment;
}
