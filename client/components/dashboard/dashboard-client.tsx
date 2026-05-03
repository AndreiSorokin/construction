"use client";

import { Building2, Factory, LogOut, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { getCurrentUser, logout } from "@/lib/auth-api";
import {
  clearAuthSession,
  getStoredUser,
  saveAuthSession,
} from "@/lib/auth-storage";
import { apiClient } from "@/lib/api";
import { getMyObjects } from "@/lib/objects-api";
import { AuthResponse, User, UserObjectAccess } from "@/lib/types";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useSuccessMessage } from "@/hooks/use-success-message";

const roleLabels: Record<NonNullable<User["role"]>, string> = {
  FOREMAN: "Прораб",
  SITE_MANAGER: "Начальник участка",
  SUPPLY: "Снабжение",
  PTO: "ПТО",
  CHIEF_ENGINEER: "Главный инженер",
  DIRECTOR: "Директор",
};

const accessRoleLabels: Record<UserObjectAccess["role"], string> = {
  OWNER: "Владелец",
  RESPONSIBLE: "Ответственный",
  VIEWER: "Наблюдатель",
};

const objectTypeLabels = {
  CONSTRUCTION_OBJECT: "Строительный объект",
  INTERNAL_DEPARTMENT: "Внутренний отдел",
};

export function DashboardClient() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [objects, setObjects] = useState<UserObjectAccess[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { errorMessage, showError, clearError } = useErrorMessage();
  const { successMessage, showSuccess, clearSuccess } = useSuccessMessage();

  useEffect(() => {
    const storedUser = getStoredUser();

    if (!storedUser) {
      router.replace("/login");
      return;
    }

    setUser(storedUser);
    void refreshDashboard();
  }, [router]);

  async function refreshDashboard() {
    setIsLoading(true);
    clearError();

    try {
      const [currentUser, myObjects] = await Promise.all([
        getCurrentUser(),
        getMyObjects(),
      ]);

      setUser(currentUser);
      setObjects(myObjects);

      const accessToken = localStorage.getItem("construction_access_token");
      const refreshToken = localStorage.getItem("construction_refresh_token");

      if (accessToken && refreshToken) {
        saveAuthSession({
          accessToken,
          refreshToken,
          user: currentUser,
        } satisfies AuthResponse);
      }
    } catch (error) {
      showError(error);
    } finally {
      setIsLoading(false);
    }
  }

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
          closingLimit: String(form.get("closingLimit")),
        },
      });

      formElement.reset();
      showSuccess("Объект создан");
      await refreshDashboard();
    } catch (error) {
      showError(error);
    }
  }

  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-100">
        <div className="text-sm text-slate-500">Проверяем сессию...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-md bg-teal-700 text-white">
              <Factory size={20} />
            </span>
            <div>
              <div className="font-semibold text-slate-950">СтройКонтроль</div>
              <div className="text-sm text-slate-500">Dashboard</div>
            </div>
          </div>

          <button
            className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={handleLogout}
          >
            <LogOut size={16} />
            Выйти
          </button>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-6">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-slate-950">
                {user.name}
              </h1>
              <p className="mt-1 text-sm text-slate-600">{user.email}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
              {user.role ? roleLabels[user.role] : "Без роли"}
            </span>
          </div>

          {errorMessage ? (
            <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}
          {successMessage ? (
            <div className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {successMessage}
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_340px]">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold text-slate-950">Мои объекты</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Объекты и отделы, к которым у вас есть доступ.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                {objects.length}
              </span>
            </div>

            <div className="mt-4 grid gap-3">
              {objects.map((access) => (
                <Link
                  className="grid gap-2 rounded-md border border-slate-200 p-4 hover:border-teal-700 hover:bg-teal-50"
                  href={`/dashboard/objects/${access.object.id}`}
                  key={access.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-700">
                        <Building2 size={18} />
                      </span>
                      <div>
                        <div className="font-medium text-slate-950">
                          {access.object.name}
                        </div>
                        <div className="text-sm text-slate-600">
                          {objectTypeLabels[access.object.type]}
                        </div>
                      </div>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                      {accessRoleLabels[access.role]}
                    </span>
                  </div>
                  <div className="text-sm text-slate-600">
                    Лимит закрытия:{" "}
                    {Number(access.object.closingLimit).toLocaleString("ru-KZ")}{" "}
                    ₸
                  </div>
                </Link>
              ))}

              {!objects.length ? (
                <div className="rounded-md border border-dashed border-slate-300 p-5 text-sm text-slate-600">
                  Пока нет доступных объектов. Создайте первый объект или
                  попросите директора пригласить вас.
                </div>
              ) : null}
            </div>
          </section>

          <aside className="grid gap-4">

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-slate-950">Создать объект</h2>
              <p className="mt-1 text-sm text-slate-600">
                При первом создании объекта пользователь получает роль директора.
              </p>
              <form className="mt-4 grid gap-3" onSubmit={createObject}>
                <label className="grid gap-1.5">
                  <span className="text-sm font-medium text-slate-700">
                    Название
                  </span>
                  <input
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
                    <option value="CONSTRUCTION_OBJECT">
                      Строительный объект
                    </option>
                    <option value="INTERNAL_DEPARTMENT">
                      Внутренний отдел
                    </option>
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <span className="text-sm font-medium text-slate-700">
                    Лимит закрытия
                  </span>
                  <input
                    className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-teal-700"
                    name="closingLimit"
                    type="number"
                    min="0"
                    required
                  />
                </label>
                <button
                  className="h-10 rounded-md bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800"
                  type="submit"
                >
                  Создать
                </button>
              </form>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}
