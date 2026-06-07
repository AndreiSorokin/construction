"use client";

import { Building2, Check, Factory, KeyRound, LogOut, Pencil, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { SupplyRequestsPanel } from "@/components/dashboard/supply-requests-panel";
import { NotificationToasts } from "@/components/ui/notification-toasts";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useSuccessMessage } from "@/hooks/use-success-message";
import { apiClient } from "@/lib/api";
import {
  getCurrentUser,
  logout,
  updateCurrentUserName,
  updateCurrentUserPassword,
} from "@/lib/auth-api";
import {
  clearAuthSession,
  getStoredUser,
  saveAuthSession,
} from "@/lib/auth-storage";
import { getMyObjects } from "@/lib/objects-api";
import { AuthResponse, User, UserObjectAccess } from "@/lib/types";

const accessRoleLabels: Record<UserObjectAccess["role"], string> = {
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
  MECHANIC: "Механик",
  DIRECTOR: "Директор",
};

const objectTypeLabels = {
  CONSTRUCTION_OBJECT: "Строительный объект",
  INTERNAL_DEPARTMENT: "Внутренний отдел",
  WORKSHOP: "Цех",
};

const objectDirectionLabels = {
  CONSTRUCTION: "Строительный отдел",
  TRANSPORT: "Транспортный отдел",
  PRODUCTION: "Производственный отдел",
};

export function DashboardClient() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [objects, setObjects] = useState<UserObjectAccess[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
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
          direction: String(form.get("direction")),
        },
      });

      formElement.reset();
      showSuccess("Объект создан");
      await refreshDashboard();
    } catch (error) {
      showError(error);
    }
  }

  async function updateProfileName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user) {
      return;
    }

    clearError();
    clearSuccess();

    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();

    if (!name) {
      showError("Укажите имя");
      return;
    }

    try {
      const updatedUser = await updateCurrentUserName(name);
      setUser(updatedUser);

      const accessToken = localStorage.getItem("construction_access_token");
      const refreshToken = localStorage.getItem("construction_refresh_token");

      if (accessToken && refreshToken) {
        saveAuthSession({
          accessToken,
          refreshToken,
          user: updatedUser,
        } satisfies AuthResponse);
      }

      setIsEditingName(false);
      showSuccess("Имя обновлено");
    } catch (error) {
      showError(error);
    }
  }

  async function updateProfilePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearError();
    clearSuccess();

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const currentPassword = String(form.get("currentPassword") ?? "");
    const newPassword = String(form.get("newPassword") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    if (newPassword.length < 6) {
      showError("Новый пароль должен быть не короче 6 символов");
      return;
    }

    if (newPassword !== confirmPassword) {
      showError("Новый пароль и подтверждение не совпадают");
      return;
    }

    try {
      await updateCurrentUserPassword({
        currentPassword,
        newPassword,
      });
      formElement.reset();
      setIsChangingPassword(false);
      showSuccess("Пароль обновлен");
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
      <NotificationToasts
        errorMessage={errorMessage}
        successMessage={successMessage}
        onClearError={clearError}
        onClearSuccess={clearSuccess}
      />
      <header className="relative z-[200] border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-md bg-teal-700 text-white">
              <Factory size={20} />
            </span>
            <div>
              <div className="font-semibold text-slate-950">{"Стройконтроль"}</div>
              <div className="text-sm text-slate-500">Панель управления</div>
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
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
            <div className="min-w-0">
              {isEditingName ? (
                <form
                  className="flex min-w-0 flex-wrap items-center gap-2"
                  onSubmit={updateProfileName}
                >
                  <input
                    autoFocus
                    className="h-10 min-w-0 rounded-md border border-slate-300 px-3 text-xl font-semibold text-slate-950 outline-none focus:border-teal-700"
                    defaultValue={user.name}
                    name="name"
                    required
                  />
                  <button
                    className="grid size-10 place-items-center rounded-md bg-teal-700 text-white hover:bg-teal-800"
                    title="Сохранить"
                    type="submit"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    className="grid size-10 place-items-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    onClick={() => setIsEditingName(false)}
                    title="Отменить"
                    type="button"
                  >
                    <X size={16} />
                  </button>
                </form>
              ) : (
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h1 className="break-words text-2xl font-semibold text-slate-950">
                    {user.name}
                  </h1>
                  <button
                    className="grid size-9 place-items-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    onClick={() => setIsEditingName(true)}
                    title="Редактировать имя"
                    type="button"
                  >
                    <Pencil size={16} />
                  </button>
                </div>
              )}
              <p className="mt-1 text-sm text-slate-600">{user.email}</p>
            </div>

            <section className="rounded-md border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-950">
                    Безопасность
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Обновление пароля аккаунта.
                  </p>
                </div>
                {!isChangingPassword ? (
                  <button
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    onClick={() => setIsChangingPassword(true)}
                    type="button"
                  >
                    <KeyRound size={16} />
                    Сменить пароль
                  </button>
                ) : null}
              </div>

              {isChangingPassword ? (
                <form
                  className="mt-4 grid gap-3"
                  onSubmit={updateProfilePassword}
                >
                  <label className="grid gap-1.5">
                    <span className="text-sm font-medium text-slate-700">
                      Текущий пароль
                    </span>
                    <input
                      className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-teal-700"
                      name="currentPassword"
                      required
                      type="password"
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-sm font-medium text-slate-700">
                      Новый пароль
                    </span>
                    <input
                      className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-teal-700"
                      minLength={6}
                      name="newPassword"
                      required
                      type="password"
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-sm font-medium text-slate-700">
                      Повторите новый пароль
                    </span>
                    <input
                      className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-teal-700"
                      minLength={6}
                      name="confirmPassword"
                      required
                      type="password"
                    />
                  </label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      onClick={() => setIsChangingPassword(false)}
                      type="button"
                    >
                      Отмена
                    </button>
                    <button
                      className="h-10 rounded-md bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800"
                      type="submit"
                    >
                      Сохранить пароль
                    </button>
                  </div>
                </form>
              ) : null}
            </section>
          </div>
        </div>

        <SupplyRequestsPanel
          objectAccesses={objects}
          user={user}
          onError={showError}
          onSuccess={showSuccess}
        />

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
                          {objectTypeLabels[access.object.type]} ·{" "}
                          {objectDirectionLabels[access.object.direction]}
                        </div>
                      </div>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                      {accessRoleLabels[access.role]}
                    </span>
                  </div>
                </Link>
              ))}

              {!objects.length && !isLoading ? (
                <div className="rounded-md border border-dashed border-slate-300 p-5 text-sm text-slate-600">
                  {"Пока нет доступных объектов. Создайте первый объект или попросите директора пригласить вас."}

                </div>
              ) : null}
            </div>
          </section>

          <aside className="grid gap-4">
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-slate-950">Банк заявок</h2>
              <Link
                className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                href="/dashboard/requests"
              >
                Открыть банк заявок
              </Link>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-slate-950">Архив</h2>
              <Link
                className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                href="/dashboard/archived-requests"
              >
                Открыть архив
              </Link>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-slate-950">{"Создать объект"}</h2>
              <p className="mt-1 text-sm text-slate-600">
                При создании объекта пользователь получает роль директора на
                этом объекте.
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
                      {"Строительный объект"}
                    </option>
                    <option value="INTERNAL_DEPARTMENT">
                      Внутренний отдел
                    </option>
                    <option value="WORKSHOP">Цех</option>
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <span className="text-sm font-medium text-slate-700">
                    Направление
                  </span>
                  <select
                    className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-teal-700"
                    name="direction"
                    required
                  >
                    <option value="CONSTRUCTION">Строительный отдел</option>
                    <option value="TRANSPORT">Транспортный отдел</option>
                    <option value="PRODUCTION">Производственный отдел</option>
                  </select>
                </label>
                <button
                  className="h-10 rounded-md bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800"
                  type="submit"
                >
                  {"Создать"}
                </button>
              </form>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}
