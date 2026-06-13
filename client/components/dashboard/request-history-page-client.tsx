"use client";

import { ArrowLeft, Factory } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApprovalHistoryList } from "@/components/dashboard/approval-history-list";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { RequestSummaryCard } from "@/components/dashboard/request-summary-card";
import { NotificationToasts } from "@/components/ui/notification-toasts";
import { useErrorMessage } from "@/hooks/use-error-message";
import { getStoredUser } from "@/lib/auth-storage";
import { getSupplyRequest } from "@/lib/supply-requests-api";
import { SupplyRequest } from "@/lib/types";

export function RequestHistoryPageClient({ requestId }: { requestId: string }) {
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
    <main className="min-h-screen bg-slate-100">
      <NotificationToasts
        errorMessage={errorMessage}
        onClearError={clearError}
      />
      <DashboardNav
        subtitle={`История согласования ${request?.requestNumber ?? ""}`.trim()}
      />
      <header className="hidden">
        <div className="mx-auto flex w-full max-w-none items-center justify-between gap-3 px-3 py-4 sm:px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-teal-700 text-white">
              <Factory size={20} />
            </span>
            <div className="min-w-0">
              <div className="truncate font-semibold text-slate-950">
                История согласования
              </div>
              <div className="text-sm text-slate-500">
                {request?.requestNumber ?? "Заявка"}
              </div>
            </div>
          </div>
          <Link
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            href="/dashboard/requests"
          >
            <ArrowLeft size={16} />
            Банк заявок
          </Link>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-none gap-4 px-3 py-5 sm:px-4 lg:px-6 lg:py-6">
        {isLoading ? (
          <div className="rounded-md border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
            Загружаем историю...
          </div>
        ) : null}

        {request ? (
          <>
            <RequestSummaryCard defaultOpen request={request}>
              <div className="grid gap-3 text-sm sm:grid-cols-3">
                <Info label="Автор" value={request.author?.name ?? request.authorId} />
                <Info label="Объект" value={request.object?.name ?? request.objectId} />
                <Info
                  label="Дата создания"
                  value={new Date(request.createdAt).toLocaleString("ru-KZ")}
                />
              </div>
            </RequestSummaryCard>

            <section className="rounded-md border border-slate-200 bg-white p-4">
              <ApprovalHistoryList history={request.approvalHistory} />
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <div className="text-slate-500">{label}</div>
      <div className="mt-1 break-words font-medium text-slate-950">{value}</div>
    </div>
  );
}
