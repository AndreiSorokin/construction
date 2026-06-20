"use client";

import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { NotificationToasts } from "@/components/ui/notification-toasts";
import { useErrorMessage } from "@/hooks/use-error-message";
import { getStoredUser } from "@/lib/auth-storage";
import { getSupplyRequest } from "@/lib/supply-requests-api";
import {
  ApprovalAction,
  SupplyRequest,
  SupplyRequestStatus,
  SupplyRequestType,
  UserRole,
} from "@/lib/types";

const requestTypeLabels: Record<SupplyRequestType, string> = {
  MATERIAL: "ТМЦ",
  TRANSPORT: "Транспорт",
  MONEY: "Денежные средства",
  PRODUCTION: "Производство",
  QUARRY: "Карьер",
  EXPRESS_MATERIAL: "Экспресс ТМЦ",
  FUEL: "Топливо",
  BUSINESS_TRIP: "Командировочные",
  APPEAL: "Обращение",
};

const requestStatusLabels: Record<SupplyRequestStatus, string> = {
  PENDING_TRANSPORT_SUPPLY: "У транспортного снабженца",
  CREATED: "Создана",
  PENDING_PTO: "В ПТО",
  PENDING_CHIEF_ENGINEER: "У главного инженера",
  PENDING_DEPUTY_PRODUCTION_DIRECTOR: "У зам. директора по производству",
  PENDING_DEPUTY_TRANSPORT_DIRECTOR: "У зам. директора по транспорту",
  PENDING_SUPPLY_MANAGER: "У начальника снабжения",
  PENDING_SUPPLY_MANAGER_REVIEW: "У начальника снабжения на проверке",
  PENDING_SUPPLY: "У снабженца",
  PENDING_DIRECTOR: "У директора",
  PENDING_GARAGE_MANAGER: "У заведующего гаражом",
  PENDING_WAREHOUSE_MANAGER: "У начальника складского хозяйства",
  PENDING_STOREKEEPER: "У кладовщика",
  PENDING_ACCOUNTANT: "У бухгалтера",
  PENDING_TRANSPORT_AUTHOR: "У автора заявки",
  PENDING_WORKSHOP_MANAGER: "У начальника цеха",
  PENDING_PRODUCTION_AUTHOR: "У автора заявки",
  PENDING_REQUEST_AUTHOR: "У автора заявки",
  RETURNED_TO_SUPPLY: "Возвращена снабжению",
  REJECTED: "Отклонена",
  IN_PROGRESS: "В работе",
  COMPLETED: "Исполнена",
  ARCHIVED: "Архив",
};

const actionLabels: Record<ApprovalAction, string> = {
  SENT_TO_TRANSPORT_SUPPLY: "Передано транспортному снабженцу",
  CREATED: "Создание",
  APPROVED: "Согласование",
  REJECTED: "Отклонение",
  RETURNED: "Возврат",
  SENT_TO_PTO: "Передано в ПТО",
  SENT_TO_CHIEF_ENGINEER: "Передано главному инженеру",
  SENT_TO_SUPPLY_MANAGER: "Передано начальнику снабжения",
  SENT_TO_SUPPLY: "Передано снабженцу",
  SENT_TO_GARAGE_MANAGER: "Передано заведующему гаражом",
  SENT_TO_WAREHOUSE_MANAGER: "Передано начальнику складского хозяйства",
  SENT_TO_STOREKEEPER: "Передано кладовщику",
  SENT_TO_ACCOUNTANT: "Передано бухгалтеру",
  SENT_TO_WORKSHOP_MANAGER: "Передано начальнику цеха",
  SENT_TO_AUTHOR: "Передано автору",
  ASSIGNED_TO_SUPPLY: "Назначен снабженец",
  SENT_TO_DIRECTOR: "Передано директору",
  MARKED_IN_PROGRESS: "Взято в работу",
  COMPLETED: "Исполнено",
  ARCHIVED: "В архив",
  COMMENTED: "Комментарий",
  PRICE_UPDATED: "Изменение цены",
  REQUEST_ITEM_UPDATED: "Изменение позиции",
  REQUEST_ITEM_DELETED: "Удаление позиции",
};

const compactActionLabels: Record<ApprovalAction, string> = {
  SENT_TO_TRANSPORT_SUPPLY: "Согласовано",
  CREATED: "Создано",
  APPROVED: "Согласовано",
  REJECTED: "Отклонено",
  RETURNED: "Возвращено",
  SENT_TO_PTO: "Согласовано",
  SENT_TO_CHIEF_ENGINEER: "Согласовано",
  SENT_TO_SUPPLY_MANAGER: "Согласовано",
  SENT_TO_SUPPLY: "Назначен снабженец",
  SENT_TO_GARAGE_MANAGER: "Согласовано",
  SENT_TO_WAREHOUSE_MANAGER: "Согласовано",
  SENT_TO_STOREKEEPER: "Передано кладовщику",
  SENT_TO_ACCOUNTANT: "Передано бухгалтеру",
  SENT_TO_WORKSHOP_MANAGER: "Назначен начальник цеха",
  SENT_TO_AUTHOR: "Возвращено автору",
  ASSIGNED_TO_SUPPLY: "Назначен снабженец",
  SENT_TO_DIRECTOR: "Согласовано",
  MARKED_IN_PROGRESS: "Взято в работу",
  COMPLETED: "Исполнено",
  ARCHIVED: "Отправлено в архив",
  COMMENTED: "Комментарий",
  PRICE_UPDATED: "Изменена цена",
  REQUEST_ITEM_UPDATED: "Изменена позиция",
  REQUEST_ITEM_DELETED: "Удалена позиция",
};

const userRoleLabels: Record<UserRole, string> = {
  TRANSPORT_SUPPLY: "Транспортный снабженец",
  MECHANIC: "Механик",
  FOREMAN: "Прораб",
  SITE_MANAGER: "Начальник участка",
  WORKSHOP_MANAGER: "Начальник цеха",
  DEPUTY_PRODUCTION_DIRECTOR: "Зам. директора по производству",
  DEPUTY_TRANSPORT_DIRECTOR: "Зам. директора по транспорту",
  SUPPLY_MANAGER: "Начальник снабжения",
  SUPPLY: "Снабженец",
  PTO: "ПТО",
  CHIEF_ENGINEER: "Главный инженер",
  GARAGE_MANAGER: "Заведующий гаражом",
  WAREHOUSE_MANAGER: "Начальник складского хозяйства",
  STOREKEEPER: "Кладовщик",
  ACCOUNTANT: "Бухгалтер",
  SECRETARY: "Секретарь",
  DIRECTOR: "Директор",
};

const itemBackedRequestTypes = new Set<SupplyRequestType>([
  "MATERIAL",
  "PRODUCTION",
  "QUARRY",
  "EXPRESS_MATERIAL",
]);

export function RequestPrintPageClient({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [request, setRequest] = useState<SupplyRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { errorMessage, showError, clearError } = useErrorMessage();

  useEffect(() => {
    const storedUser = getStoredUser();

    if (!storedUser) {
      router.replace("/login");
      return;
    }

    void loadRequest();
  }, [requestId, router]);

  async function loadRequest() {
    setIsLoading(true);
    clearError();

    try {
      setRequest(await getSupplyRequest(requestId));
    } catch (error) {
      showError(error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950 print:bg-white">
      <NotificationToasts errorMessage={errorMessage} onClearError={clearError} />

      <div className="print:hidden">
        <DashboardNav />
      </div>

      <header className="border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex w-full max-w-none items-center justify-end gap-3 px-3 py-3 sm:px-4 lg:px-6">
          <Link className="hidden" href="/dashboard">
            <ArrowLeft size={16} />
            Назад
          </Link>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-800"
            onClick={() => window.print()}
            type="button"
          >
            <Printer size={16} />
            Печать
          </button>
        </div>
      </header>

      <section className="mx-auto w-full max-w-none px-3 py-5 sm:px-4 lg:px-6 lg:py-6 print:max-w-none print:px-0 print:py-0">
        {isLoading ? (
          <div className="rounded-md border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
            Загружаем заявку...
          </div>
        ) : null}

        {request ? <PrintDocument request={request} /> : null}
      </section>
    </main>
  );
}

function PrintDocument({ request }: { request: SupplyRequest }) {
  const requestDetails = getRequestDetails(request);
  const shouldShowItems = request.items.length > 0 || itemBackedRequestTypes.has(request.type);

  return (
    <article className="grid gap-5 rounded-md bg-white p-6 shadow-sm print:gap-4 print:p-0 print:shadow-none">
      <div className="border-b border-slate-300 pb-4">
        <div className="text-center text-xl font-semibold uppercase">
          Заявка {request.requestNumber}
        </div>
        <div className="mt-1 text-center text-sm text-slate-600">
          {requestTypeLabels[request.type]} · {requestStatusLabels[request.status]}
        </div>
      </div>

      <section className="grid gap-3 text-sm sm:grid-cols-3 print:grid-cols-3">
        <Info label="Объект" value={request.object?.name ?? request.objectId} />
        <Info label="Автор" value={formatUser(request.author, request.authorId)} />
        <Info label="Дата создания" value={formatDate(request.createdAt)} />
        <Info
          label="Назначенный снабженец"
          value={
            request.assignedSupplyUser
              ? formatUser(request.assignedSupplyUser, request.assignedSupplyUserId)
              : "Не назначен"
          }
        />
      </section>

      {requestDetails.length ? (
        <section>
          <SectionTitle>Данные заявки</SectionTitle>
          <div className="grid gap-3 text-sm sm:grid-cols-2 print:grid-cols-2">
            {requestDetails.map((detail) => (
              <Info key={detail.label} label={detail.label} value={detail.value} />
            ))}
          </div>
        </section>
      ) : null}

      {shouldShowItems ? (
        <section>
          <SectionTitle>Позиции заявки</SectionTitle>
          {request.items.length ? (
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-100 text-left print:bg-white">
                    <PrintTh>ТМЦ</PrintTh>
                    <PrintTh>Кол-во</PrintTh>
                    <PrintTh>Ед.</PrintTh>
                    <PrintTh>Остаток на складе</PrintTh>
                    <PrintTh>Комментарии</PrintTh>
                  </tr>
                </thead>
                <tbody>
                  {request.items.map((item) => (
                    <tr className="break-inside-avoid border-b border-slate-200" key={item.id}>
                      <PrintTd>
                        <div className="font-medium">{item.materialNameSnapshot}</div>
                      </PrintTd>
                      <PrintTd>{formatQuantity(item.quantity)}</PrintTd>
                      <PrintTd>{item.measurementUnitSnapshot}</PrintTd>
                      <PrintTd>{formatQuantity(item.stockQuantity ?? "0")}</PrintTd>
                      <PrintTd>
                        <ItemComments
                          chiefEngineerComment={item.chiefEngineerComment}
                          ptoComment={item.ptoComment}
                          supplyComment={item.supplyComment}
                          supplyManagerComment={item.supplyManagerComment}
                          supplierComment={item.supplierComment}
                        />
                      </PrintTd>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-md border border-slate-200 p-3 text-sm text-slate-600">
              В заявке нет позиций.
            </div>
          )}
        </section>
      ) : null}

      <section className="mx-auto w-full max-w-6xl px-2 sm:px-6 print:w-3/4 print:max-w-none print:px-0">
        <SectionTitle className="text-center">
          Путь согласования
        </SectionTitle>
        {request.approvalHistory?.length ? (
          <div className="grid gap-1 text-left text-sm">
            {request.approvalHistory.map((entry, index) => (
              <div className="break-inside-avoid" key={entry.id}>
                <ApprovalHistoryPrintRow
                  entry={entry}
                  index={index}
                  request={request}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-slate-200 p-3 text-sm text-slate-600">
            История согласования пока пуста.
          </div>
        )}
      </section>
    </article>
  );
}

function getRequestDetails(request: SupplyRequest) {
  const details: Array<{ label: string; value: string }> = [];

  if (request.type === "MONEY") {
    details.push(
      { label: "Сумма", value: formatMoney(toNumber(request.amount)) },
      { label: "Тип оплаты", value: formatPaymentType(request.paymentType) },
      { label: "Назначение", value: request.paymentPurpose ?? "-" },
    );
  }

  if (request.type === "BUSINESS_TRIP") {
    details.push(
      { label: "Сумма", value: formatMoney(toNumber(request.amount)) },
      { label: "Назначение", value: request.paymentPurpose ?? request.purpose ?? "-" },
    );
  }

  if (request.type === "FUEL") {
    details.push(
      { label: "Вид топлива", value: request.transportType ?? "-" },
      { label: "Назначение", value: request.purpose ?? "-" },
    );
  }

  if (request.type === "APPEAL") {
    details.push({ label: "Текст обращения", value: request.purpose ?? "-" });
  }

  if (request.type === "TRANSPORT") {
    details.push(
      { label: "Объект", value: request.transportObjectName ?? request.object?.name ?? "-" },
      { label: "Дата", value: request.transportDate ?? "-" },
      { label: "Время", value: request.transportTime ?? "-" },
      { label: "Запрашиваемый транспорт", value: request.transportType ?? "-" },
      { label: "Назначение техники", value: request.purpose ?? "-" },
    );
  }

  if (request.type === "PRODUCTION" && request.purpose) {
    details.push({ label: "Задача на производство", value: request.purpose });
  }

  return details;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 p-3 print:border-slate-300">
      <div className="text-xs uppercase text-slate-500">{label}</div>
      <div className="mt-1 break-words whitespace-pre-wrap font-medium">{value}</div>
    </div>
  );
}

function SectionTitle({
  children,
  className = "",
}: {
  children: string;
  className?: string;
}) {
  return (
    <h2
      className={`mb-3 border-b border-slate-300 pb-2 text-base font-semibold ${className}`}
    >
      {children}
    </h2>
  );
}

function PrintTh({ children }: { children: string }) {
  return <th className="border border-slate-300 px-2 py-2 font-medium">{children}</th>;
}

function PrintTd({ children }: { children: React.ReactNode }) {
  return <td className="align-top border border-slate-300 px-2 py-2">{children}</td>;
}

function ItemComments({
  chiefEngineerComment,
  ptoComment,
  supplyComment,
  supplyManagerComment,
  supplierComment,
}: {
  chiefEngineerComment?: string | null;
  ptoComment?: string | null;
  supplyComment?: string | null;
  supplyManagerComment?: string | null;
  supplierComment?: string | null;
}) {
  const comments = [
    ["Главный инженер", chiefEngineerComment],
    ["ПТО", ptoComment],
    ["Снабжение", supplyComment],
    ["Начальник снабжения", supplyManagerComment],
    ["Снабженец", supplierComment],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]?.trim()));

  if (!comments.length) {
    return <span>-</span>;
  }

  return (
    <div className="grid gap-1">
      {comments.map(([label, value]) => (
        <div key={label}>
          <span className="font-medium">{label}: </span>
          <span className="whitespace-pre-wrap">{value}</span>
        </div>
      ))}
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

  return "-";
}

function ApprovalHistoryPrintRow({
  entry,
  index,
  request,
}: {
  entry: NonNullable<SupplyRequest["approvalHistory"]>[number];
  index: number;
  request: SupplyRequest;
}) {
  const row = getCompactApprovalHistoryEntryParts(request, entry);

  return (
    <div className="grid grid-cols-[32px_1fr_1.5fr_1.5fr_1fr] items-start gap-x-4 leading-5">
      <div>{index + 1}.</div>
      <div>{row.action}</div>
      <div>{row.userName}</div>
      <div>{row.roleLabel}</div>
      <div>{row.dateTime}</div>
    </div>
  );
}

function getCompactApprovalHistoryEntryParts(
  request: SupplyRequest,
  entry: NonNullable<SupplyRequest["approvalHistory"]>[number],
) {
  const userName = formatApprovalHistoryUser(request, entry);
  const role = getApprovalHistoryRole(request, entry);
  const roleLabel = role ? userRoleLabels[role] : "Должность не указана";

  return {
    action: compactActionLabels[entry.action],
    userName,
    roleLabel,
    dateTime: formatDateTime(entry.createdAt),
  };
}

function formatApprovalHistoryUser(
  request: SupplyRequest,
  entry: NonNullable<SupplyRequest["approvalHistory"]>[number],
) {
  if (entry.action === "CREATED" || !entry.toStatus) {
    return formatUser(entry.actor, entry.actorId);
  }

  const recipient = getApprovalHistoryRecipient(request, entry.toStatus);

  return recipient ?? formatUser(entry.actor, entry.actorId);
}

function getApprovalHistoryRole(
  request: SupplyRequest,
  entry: NonNullable<SupplyRequest["approvalHistory"]>[number],
): UserRole | null {
  if (entry.action === "CREATED" || !entry.toStatus) {
    return request.authorObjectRole ?? getObjectAccessRole(request, entry.actorId);
  }

  if (
    entry.toStatus === "PENDING_TRANSPORT_AUTHOR" ||
    entry.toStatus === "PENDING_PRODUCTION_AUTHOR" ||
    entry.toStatus === "PENDING_REQUEST_AUTHOR"
  ) {
    return request.authorObjectRole ?? getObjectAccessRole(request, request.authorId);
  }

  if (entry.toStatus === "PENDING_SUPPLY") {
    return "SUPPLY";
  }

  if (entry.toStatus === "PENDING_STOREKEEPER") {
    return "STOREKEEPER";
  }

  if (entry.toStatus === "PENDING_WORKSHOP_MANAGER") {
    return "WORKSHOP_MANAGER";
  }

  return getRoleForStatus(entry.toStatus);
}

function getObjectAccessRole(request: SupplyRequest, userId?: string | null) {
  if (!userId) {
    return null;
  }

  return (
    request.object?.userAccesses?.find((objectAccess) => objectAccess.userId === userId)
      ?.role ?? null
  );
}

function getApprovalHistoryRecipient(
  request: SupplyRequest,
  status: SupplyRequestStatus,
) {
  if (
    status === "PENDING_TRANSPORT_AUTHOR" ||
    status === "PENDING_PRODUCTION_AUTHOR" ||
    status === "PENDING_REQUEST_AUTHOR"
  ) {
    return formatUser(request.author, request.authorId);
  }

  if (status === "PENDING_SUPPLY" && request.assignedSupplyUser) {
    return formatUser(request.assignedSupplyUser, request.assignedSupplyUserId);
  }

  if (status === "PENDING_STOREKEEPER" && request.assignedStorekeeper) {
    return formatUser(request.assignedStorekeeper, request.assignedStorekeeperId);
  }

  if (status === "PENDING_WORKSHOP_MANAGER" && request.assignedWorkshopManager) {
    return formatUser(
      request.assignedWorkshopManager,
      request.assignedWorkshopManagerId,
    );
  }

  const role = getRoleForStatus(status);

  if (!role) {
    return null;
  }

  const access = request.object?.userAccesses?.find(
    (objectAccess) => objectAccess.role === role,
  );

  return access ? formatUser(access.user, access.userId) : null;
}

function getRoleForStatus(status: SupplyRequestStatus): UserRole | null {
  const roleByStatus: Partial<Record<SupplyRequestStatus, UserRole>> = {
    PENDING_TRANSPORT_SUPPLY: "TRANSPORT_SUPPLY",
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

  return roleByStatus[status] ?? null;
}

function formatStatusTransition(
  fromStatus?: SupplyRequestStatus | null,
  toStatus?: SupplyRequestStatus | null,
) {
  if (fromStatus && toStatus && fromStatus !== toStatus) {
    return `${requestStatusLabels[fromStatus]} -> ${requestStatusLabels[toStatus]}`;
  }

  if (toStatus) {
    return requestStatusLabels[toStatus];
  }

  if (fromStatus) {
    return requestStatusLabels[fromStatus];
  }

  return "Без изменения статуса";
}

function formatUser(
  user: { email?: string; name?: string } | null | undefined,
  fallback?: string | null,
) {
  if (!user) {
    return fallback ?? "Не указан";
  }

  return `${user.name ?? "Без имени"}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("ru-KZ");
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("ru-KZ");
}

function formatQuantity(value?: string | null) {
  const numberValue = Number(value ?? 0);

  if (!Number.isFinite(numberValue)) {
    return value ?? "0";
  }

  return new Intl.NumberFormat("ru-KZ", {
    maximumFractionDigits: 3,
  }).format(numberValue);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("ru-KZ", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
    currency: "KZT",
  }).format(value);
}

function toNumber(value?: string | null) {
  const numberValue = Number(value ?? 0);

  return Number.isFinite(numberValue) ? numberValue : 0;
}
