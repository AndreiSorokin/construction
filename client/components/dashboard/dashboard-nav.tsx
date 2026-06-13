"use client";

import {
  Archive,
  Building2,
  Factory,
  FileText,
  Home,
  LogOut,
  Plus,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { NotificationToasts } from "@/components/ui/notification-toasts";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useSuccessMessage } from "@/hooks/use-success-message";
import { apiClient } from "@/lib/api";
import { logout } from "@/lib/auth-api";
import { clearAuthSession } from "@/lib/auth-storage";
import { getPendingSupplyRequestsCount } from "@/lib/supply-requests-api";

type DashboardNavProps = {
  onObjectCreated?: () => Promise<void> | void;
  subtitle?: string;
};

export function DashboardNav({
  onObjectCreated,
  subtitle = "Панель управления",
}: DashboardNavProps) {
  const router = useRouter();
  const [isCreateObjectOpen, setIsCreateObjectOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const { errorMessage, showError, clearError } = useErrorMessage();
  const { successMessage, showSuccess, clearSuccess } = useSuccessMessage();

  useEffect(() => {
    let isMounted = true;

    async function loadPendingCount() {
      try {
        const response = await getPendingSupplyRequestsCount();

        if (isMounted) {
          setPendingCount(response.count);
        }
      } catch {
        if (isMounted) {
          setPendingCount(0);
        }
      }
    }

    void loadPendingCount();
    const intervalId = window.setInterval(loadPendingCount, 60_000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    document.title =
      pendingCount > 0 ? `(${pendingCount}) Интерстиль` : "Интерстиль";
  }, [pendingCount]);

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // Local logout still matters even if the token is already invalid.
    } finally {
      clearAuthSession();
      router.replace("/login");
    }
  }

  async function createObject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearError();
    clearSuccess();

    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    try {
      await apiClient("/objects", {
        method: "POST",
        body: {
          name: String(form.get("name")),
          type: String(form.get("type")),
        },
      });

      formElement.reset();
      setIsCreateObjectOpen(false);
      showSuccess("Объект создан");
      await onObjectCreated?.();
    } catch (error) {
      showError(error);
    }
  }

  return (
    <>
      <NotificationToasts
        errorMessage={errorMessage}
        successMessage={successMessage}
        onClearError={clearError}
        onClearSuccess={clearSuccess}
      />
      <header className="relative z-[200] border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-none flex-col gap-3 px-3 py-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-md bg-teal-700 text-white">
                <Factory size={20} />
              </span>
              <div className="min-w-0">
                <div className="text-sm text-slate-500">{subtitle}</div>
                <div className="truncate font-semibold text-slate-950">
                  {"Интерстиль"}
                </div>
              </div>
            </div>

            <button
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 lg:hidden"
              onClick={handleLogout}
              type="button"
            >
              <LogOut size={16} />
              Выйти
            </button>
          </div>

          <nav className="flex min-w-0 flex-wrap items-center gap-2">
            <Link
              className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:border-teal-700 hover:bg-teal-50"
              href="/dashboard"
            >
              <Home size={16} />
              {pendingCount > 0 ? <PendingBadge count={pendingCount} /> : null}
              Главная
            </Link>
            <Link
              className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:border-teal-700 hover:bg-teal-50"
              href="/dashboard/objects"
            >
              <Building2 size={16} />
              Мои объекты
            </Link>
            <Link
              className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:border-teal-700 hover:bg-teal-50"
              href="/dashboard/requests"
            >
              <FileText size={16} />
              Банк заявок
            </Link>
            <Link
              className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:border-teal-700 hover:bg-teal-50"
              href="/dashboard/archived-requests"
            >
              <Archive size={16} />
              Архив
            </Link>
            <button
              className="inline-flex h-10 items-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800"
              onClick={() => setIsCreateObjectOpen(true)}
              type="button"
            >
              <Plus size={16} />
              Создать объект
            </button>
            <button
              className="hidden h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 lg:inline-flex"
              onClick={handleLogout}
              type="button"
            >
              <LogOut size={16} />
              Выйти
            </button>
          </nav>
        </div>
      </header>

      {isCreateObjectOpen ? (
        <CreateObjectModal
          onClose={() => setIsCreateObjectOpen(false)}
          onSubmit={createObject}
        />
      ) : null}
    </>
  );
}

function CreateObjectModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="fixed inset-0 z-[300] grid place-items-center overflow-y-auto bg-slate-950/40 px-3 py-4">
      <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-950">Создать объект</h2>
            <p className="mt-1 text-sm text-slate-600">
              При создании объекта пользователь получает роль директора.
            </p>
          </div>
          <button
            className="grid size-9 shrink-0 place-items-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            onClick={onClose}
            title="Закрыть"
            type="button"
          >
            <X size={16} />
          </button>
        </div>

        <form className="mt-4 grid gap-3" onSubmit={onSubmit}>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-slate-700">
              Название
            </span>
            <input
              autoFocus
              className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-teal-700"
              name="name"
              required
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-slate-700">Тип</span>
            <select
              className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-teal-700"
              name="type"
              required
            >
              <option value="CONSTRUCTION_OBJECT">Строительный объект</option>
              <option value="INTERNAL_DEPARTMENT">Внутренний отдел</option>
              <option value="WORKSHOP">Цех</option>
            </select>
          </label>

          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <button
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={onClose}
              type="button"
            >
              Отмена
            </button>
            <button
              className="h-10 rounded-md bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800"
              type="submit"
            >
              Создать
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PendingBadge({ count }: { count: number }) {
  return (
    <span className="ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
      +{count > 99 ? "99" : count}
    </span>
  );
}
