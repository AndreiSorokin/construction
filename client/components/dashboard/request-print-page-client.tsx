"use client";

import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { NotificationToasts } from "@/components/ui/notification-toasts";
import { useErrorMessage } from "@/hooks/use-error-message";
import { getStoredUser } from "@/lib/auth-storage";
import { getSupplyRequest } from "@/lib/supply-requests-api";
import {
  ApprovalAction,
  SupplyRequest,
  SupplyRequestStatus,
  SupplyRequestType,
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

      <header className="border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
          <Link
            className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            href="/dashboard"
          >
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

      <section className="mx-auto max-w-6xl px-4 py-6 print:max-w-none print:px-0 print:py-0">
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
  const ptoTotal = useMemo(
    () =>
      request.items.reduce(
        (total, item) => total + toNumber(item.ptoLimitPrice ?? "0"),
        0,
      ),
    [request.items],
  );

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
        <Info label="Дата создания" value={formatDateTime(request.createdAt)} />
        <Info label="Текущий статус" value={requestStatusLabels[request.status]} />
        <Info
          label="Назначенный снабженец"
          value={
            request.assignedSupplyUser
              ? formatUser(request.assignedSupplyUser, request.assignedSupplyUserId)
              : "Не назначен"
          }
        />
        <Info label="Итого по цене ПТО" value={formatMoney(ptoTotal)} />
      </section>

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
                  <PrintTh>Цена ПТО</PrintTh>
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
                      {item.ptoLimitPrice
                        ? formatMoney(toNumber(item.ptoLimitPrice))
                        : "-"}
                    </PrintTd>
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

      <section>
        <SectionTitle>Путь согласования</SectionTitle>
        {request.approvalHistory?.length ? (
          <div className="grid gap-2">
            {request.approvalHistory.map((entry, index) => (
              <div
                className="break-inside-avoid rounded-md border border-slate-200 p-3 text-sm"
                key={entry.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="font-medium">
                    {index + 1}. {actionLabels[entry.action]}
                  </div>
                  <div className="text-slate-500">{formatDateTime(entry.createdAt)}</div>
                </div>
                <div className="mt-1 text-slate-700">
                  {formatUser(entry.actor, entry.actorId)}
                </div>
                <div className="mt-1 text-slate-600">
                  {formatStatusTransition(entry.fromStatus, entry.toStatus)}
                </div>
                {entry.comment ? (
                  <div className="mt-2 whitespace-pre-wrap rounded-md bg-slate-50 p-2 text-slate-700 print:bg-white print:p-0">
                    {entry.comment}
                  </div>
                ) : null}
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 p-3 print:border-slate-300">
      <div className="text-xs uppercase text-slate-500">{label}</div>
      <div className="mt-1 break-words font-medium">{value}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h2 className="mb-3 border-b border-slate-300 pb-2 text-base font-semibold">
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
  ].filter(([, value]) => value?.trim());

  if (!comments.length) {
    return <span>-</span>;
  }

  return (
    <div className="grid gap-1">
      {comments.map(([label, value]) => (
        <div key={label}>
          <span className="font-medium">
            {getItemCommentLabel(value, {
              chiefEngineerComment,
              ptoComment,
              supplyComment,
              supplyManagerComment,
              supplierComment,
            })}
            :{" "}
          </span>
          <span className="whitespace-pre-wrap">{value}</span>
        </div>
      ))}
    </div>
  );
}

function getItemCommentLabel(
  value: string | null | undefined,
  comments: {
    chiefEngineerComment?: string | null;
    ptoComment?: string | null;
    supplyComment?: string | null;
    supplyManagerComment?: string | null;
    supplierComment?: string | null;
  },
) {
  if (value === comments.chiefEngineerComment) {
    return "Главный инженер";
  }

  if (value === comments.supplierComment) {
    return "Снабжение";
  }

  if (value === comments.supplyManagerComment) {
    return "Начальник снабжения";
  }

  if (value === comments.ptoComment) {
    return "ПТО";
  }

  return "Снабжение (старый комментарий)";
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

  return `${user.name ?? "Без имени"}${user.email ? ` · ${user.email}` : ""}`;
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
