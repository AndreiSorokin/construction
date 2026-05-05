import { Clock3 } from "lucide-react";
import {
  ApprovalAction,
  ApprovalHistoryEntry,
  SupplyRequestStatus,
} from "@/lib/types";

type ApprovalHistoryListProps = {
  history?: ApprovalHistoryEntry[];
  compact?: boolean;
};

const actionLabels: Record<ApprovalAction, string> = {
  CREATED: "Создана",
  APPROVED: "Согласована",
  REJECTED: "Отклонена",
  RETURNED: "Возвращена",
  SENT_TO_PTO: "Отправлена в ПТО",
  SENT_TO_CHIEF_ENGINEER: "Отправлена главному инженеру",
  SENT_TO_SUPPLY: "Отправлена в снабжение",
  SENT_TO_DIRECTOR: "Отправлена директору",
  MARKED_IN_PROGRESS: "Взята в работу",
  COMPLETED: "Исполнена",
  ARCHIVED: "Архивирована",
  COMMENTED: "Комментарий",
  PRICE_UPDATED: "Цена обновлена",
};

const statusLabels: Record<SupplyRequestStatus, string> = {
  CREATED: "Создана",
  PENDING_PTO: "В ПТО",
  PENDING_CHIEF_ENGINEER: "У главного инженера",
  PENDING_SUPPLY: "В снабжении",
  PENDING_DIRECTOR: "У директора",
  RETURNED_TO_SUPPLY: "Возвращена снабжению",
  REJECTED: "Отклонена",
  IN_PROGRESS: "В работе",
  COMPLETED: "Исполнена",
  ARCHIVED: "Архив",
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
              {entry.actor?.name ?? entry.actor?.email ?? entry.actorId}
              {entry.fromStatus || entry.toStatus ? (
                <>
                  {" "}
                  · {formatStatusTransition(entry.fromStatus, entry.toStatus)}
                </>
              ) : null}
            </div>
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

function formatStatusTransition(
  fromStatus?: SupplyRequestStatus | null,
  toStatus?: SupplyRequestStatus | null,
) {
  if (fromStatus && toStatus) {
    return `${statusLabels[fromStatus]} -> ${statusLabels[toStatus]}`;
  }

  if (toStatus) {
    return statusLabels[toStatus];
  }

  if (fromStatus) {
    return statusLabels[fromStatus];
  }

  return "";
}

function formatHistoryDate(value: string) {
  return new Intl.DateTimeFormat("ru-KZ", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function translateSystemComment(comment: string) {
  const systemComments: Record<string, string> = {
    "Material supply request created and sent to PTO":
      "Заявка на материалы создана и отправлена в ПТО",
    "Transport request created and sent to supply":
      "Заявка на транспорт создана и отправлена в снабжение",
    "Money request created and sent to director":
      "Заявка на деньги создана и отправлена директору",
  };

  return systemComments[comment] ?? comment;
}
