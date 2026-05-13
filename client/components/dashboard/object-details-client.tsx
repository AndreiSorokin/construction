"use client";

import {
  ArrowLeft,
  Building2,
  Factory,
  Send,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { MaterialRequestModal } from "@/components/dashboard/material-request-modal";
import { MoneyRequestModal } from "@/components/dashboard/money-request-modal";
import { TransportRequestModal } from "@/components/dashboard/transport-request-modal";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useSuccessMessage } from "@/hooks/use-success-message";
import { getCurrentUser } from "@/lib/auth-api";
import {
  deleteObject,
  deleteObjectUserAccess,
  getObject,
  inviteObjectUser,
  updateObjectUserRole,
} from "@/lib/objects-api";
import { ObjectEntity, User, UserRole } from "@/lib/types";

const objectTypeLabels = {
  CONSTRUCTION_OBJECT: "Строительный объект",
  INTERNAL_DEPARTMENT: "Внутренний отдел",
  WORKSHOP: "Цех",
};

const inviteRoleLabels: Record<UserRole, string> = {
  FOREMAN: "Прораб",
  SITE_MANAGER: "Начальник участка",
  WORKSHOP_MANAGER: "Начальник цеха",
  DEPUTY_PRODUCTION_DIRECTOR: "Зам. директора по производству",
  SUPPLY_MANAGER: "Начальник снабжения",
  SUPPLY: "Снабженец",
  PTO: "ПТО",
  CHIEF_ENGINEER: "Главный инженер",
  GARAGE_MANAGER: "Заведующий гаражом",
  WAREHOUSE_MANAGER: "Начальник складского хозяйства",
  STOREKEEPER: "Кладовщик",
  SECRETARY: "Секретарь",
  DIRECTOR: "Директор",
};

const userRoleValues = Object.keys(inviteRoleLabels) as UserRole[];

type RoleEditTarget = {
  role: UserRole;
  userId: string;
};

export function ObjectDetailsClient({ objectId }: { objectId: string }) {
  const router = useRouter();
  const [object, setObject] = useState<ObjectEntity | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isMaterialRequestOpen, setIsMaterialRequestOpen] = useState(false);
  const [isTransportRequestOpen, setIsTransportRequestOpen] = useState(false);
  const [isMoneyRequestOpen, setIsMoneyRequestOpen] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [roleEditTarget, setRoleEditTarget] =
    useState<RoleEditTarget | null>(null);
  const { errorMessage, showError, clearError } = useErrorMessage();
  const { successMessage, showSuccess, clearSuccess } = useSuccessMessage();

  const currentObjectRole = object?.userAccesses?.find(
    (access) => access.userId === user?.id,
  )?.role;
  const canCreateRequests = Boolean(currentObjectRole);
  const canInviteUsers = currentObjectRole === "DIRECTOR";
  const canDeleteObject = currentObjectRole === "DIRECTOR";

  useEffect(() => {
    void loadPage();
  }, [objectId]);

  async function loadPage() {
    clearError();

    try {
      const [nextObject, currentUser] = await Promise.all([
        getObject(objectId),
        getCurrentUser(),
      ]);
      setObject(nextObject);
      setUser(currentUser);
    } catch (error) {
      showError(error);
    }
  }

  async function inviteUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearError();
    clearSuccess();

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const email = String(form.get("email")).trim();

    if (user?.email.trim().toLowerCase() === email.toLowerCase()) {
      showError("Нельзя пригласить самого себя");
      return;
    }

    try {
      setIsInviting(true);
      const result = await inviteObjectUser(objectId, {
        email,
        name: String(form.get("name")),
        userRole: String(form.get("userRole")) as UserRole,
      });

      formElement.reset();

      if (result.mail?.sent === false) {
        showSuccess(
          result.inviteLink
            ? `@83;0H5=85 A>740=>, => ?8AL<> >B?@028BL =5 C40;>AL. !AK;:0: ${result.inviteLink}`
            : "Доступ выдан, но письмо-уведомление не отправлено. Пользователь может войти в свой аккаунт.",
        );
      } else {
        showSuccess(
          result.type === "existing_user_access_granted"
            ? "Доступ пользователю выдан"
            : "Приглашение отправлено",
        );
      }

      await loadPage();
    } catch (error) {
      showError(error);
    } finally {
      setIsInviting(false);
    }
  }

  async function handleDeleteObject() {
    const confirmed = window.confirm(
      "Удалить объект? Это действие нельзя отменить.",
    );

    if (!confirmed) {
      return;
    }

    clearError();
    clearSuccess();

    try {
      await deleteObject(objectId);
      router.replace("/dashboard");
    } catch (error) {
      showError(error);
    }
  }

  function openRoleEditModal(
    userId: string,
    currentRole: UserRole,
  ) {
    setRoleEditTarget({ userId, role: currentRole });
  }

  async function submitRoleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!roleEditTarget) {
      return;
    }

    const form = new FormData(event.currentTarget);
    const nextRole = String(form.get("role")) as UserRole;

    if (!userRoleValues.includes(nextRole)) {
      showError("Выберите корректную роль");
      return;
    }

    clearError();
    clearSuccess();

    try {
      await updateObjectUserRole(objectId, roleEditTarget.userId, nextRole);
      showSuccess(" >;L ?>;L7>20B5;O >1=>2;5=0");
      setRoleEditTarget(null);
      await loadPage();
    } catch (error) {
      showError(error);
    }
  }

  async function deleteObjectUser(userId: string) {
    const confirmed = window.confirm("Удалить пользователя из объекта?");

    if (!confirmed) {
      return;
    }

    clearError();
    clearSuccess();

    try {
      await deleteObjectUserAccess(objectId, userId);
      showSuccess("Пользователь удален из объекта");
      await loadPage();
    } catch (error) {
      showError(error);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-teal-700 text-white">
              <Factory size={20} />
            </span>
            <div className="min-w-0">
              <div className="truncate font-semibold text-slate-950">
                {"Стройконтроль"}
              </div>
              <div className="text-sm text-slate-500">Объект</div>
            </div>
          </div>
          <Link
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            href="/dashboard"
          >
            <ArrowLeft size={16} />
            Dashboard
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-6">
        {errorMessage ? (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}
        {successMessage ? (
          <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {successMessage}
          </div>
        ) : null}

        {!object ? (
          <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
            Загружаем объект...
          </div>
        ) : (
          <>
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 gap-4">
                  <span className="grid size-12 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-700">
                    <Building2 size={22} />
                  </span>
                  <div className="min-w-0">
                    <h1 className="break-words text-2xl font-semibold text-slate-950">
                      {object.name}
                    </h1>
                    <p className="mt-1 text-sm text-slate-600">
                      {objectTypeLabels[object.type]}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  {canCreateRequests ? (
                    <button
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800"
                      onClick={() => setIsMaterialRequestOpen(true)}
                      type="button"
                    >
                      <Send size={16} />
                      Заявка на материалы
                    </button>
                  ) : null}

                  {canCreateRequests ? (
                    <button
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-teal-200 bg-white px-3 text-sm font-medium text-teal-700 hover:bg-teal-50"
                      onClick={() => setIsTransportRequestOpen(true)}
                      type="button"
                    >
                      <Send size={16} />
                      Заявка на транспорт
                    </button>
                  ) : null}

                  {canCreateRequests ? (
                    <button
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-amber-200 bg-white px-3 text-sm font-medium text-amber-700 hover:bg-amber-50"
                      onClick={() => setIsMoneyRequestOpen(true)}
                      type="button"
                    >
                      <Send size={16} />
                      Заявка на деньги
                    </button>
                  ) : null}

                  {canDeleteObject ? (
                    <button
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-red-200 bg-white px-3 text-sm font-medium text-red-700 hover:bg-red-50"
                      onClick={() => void handleDeleteObject()}
                      type="button"
                    >
                      <Trash2 size={16} />
                      Удалить объект
                    </button>
                  ) : null}
                </div>
              </div>
            </section>

            <div className="mx-auto grid w-full max-w-md gap-4">
              {canInviteUsers ? (
                <aside className="grid min-w-0 gap-4 self-start">
                  <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                      <h2 className="font-semibold text-slate-950">
                        Пригласить пользователя
                      </h2>
                      <p className="mt-1 text-sm text-slate-600">
                        Назначьте роль и доступ к этому объекту или отделу.
                      </p>
                      <form className="mt-4 grid gap-3" onSubmit={inviteUser}>
                        <Field name="email" label="Email" type="email" />
                        <Field name="name" label="Имя" />
                        <label className="grid gap-1.5">
                          <span className="text-sm font-medium text-slate-700">
                            {"Роль в системе"}
                          </span>
                          <select
                            className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-teal-700"
                            defaultValue="FOREMAN"
                            name="userRole"
                            required
                          >
                            {Object.entries(inviteRoleLabels).map(
                              ([role, label]) => (
                                <option key={role} value={role}>
                                  {label}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                        <button
                          className="h-10 rounded-md bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                          disabled={isInviting}
                          type="submit"
                        >
                          {isInviting ? "Отправляем..." : "Пригласить"}
                        </button>
                      </form>
                  </section>

                </aside>
              ) : null}
            </div>

            {canInviteUsers ? (
              <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <h2 className="font-semibold text-slate-950">
                  Пользователи объекта
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {"Список пользователей, у которых есть роль на этом объекте."}
                </p>
                <ObjectUsersList
                  currentUserId={user?.id}
                  object={object}
                  onDelete={deleteObjectUser}
                  onEditRole={openRoleEditModal}
                />
              </section>
            ) : null}

            <MaterialRequestModal
              isOpen={isMaterialRequestOpen}
              object={object}
              onClose={() => setIsMaterialRequestOpen(false)}
              onError={showError}
              onSuccess={showSuccess}
            />
            <TransportRequestModal
              isOpen={isTransportRequestOpen}
              object={object}
              onClose={() => setIsTransportRequestOpen(false)}
              onError={showError}
              onSuccess={showSuccess}
            />
            <MoneyRequestModal
              isOpen={isMoneyRequestOpen}
              object={object}
              onClose={() => setIsMoneyRequestOpen(false)}
              onError={showError}
              onSuccess={showSuccess}
            />
            <RoleEditModal
              isOpen={Boolean(roleEditTarget)}
              onClose={() => setRoleEditTarget(null)}
              onSubmit={submitRoleEdit}
              role={roleEditTarget?.role}
            />
          </>
        )}
      </section>
    </main>
  );
}

function ObjectUsersList({
  currentUserId,
  object,
  onDelete,
  onEditRole,
}: {
  currentUserId?: string;
  object: ObjectEntity;
  onDelete: (userId: string) => void;
  onEditRole: (userId: string, currentRole: UserRole) => void;
}) {
  const accesses = [...(object.userAccesses ?? [])].sort((first, second) => {
    const firstName = first.user?.name ?? "";
    const secondName = second.user?.name ?? "";

    return firstName.localeCompare(secondName, "ru");
  });

  if (!accesses.length) {
    return (
      <div className="mt-4 rounded-md border border-dashed border-slate-300 p-3 text-sm text-slate-500">
        Пользователи еще не добавлены.
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="py-2 pr-3 font-medium">Имя</th>
            <th className="py-2 pr-3 font-medium">Email</th>
            <th className="py-2 pr-3 font-medium">{"Роль"}</th>
            <th className="py-2 pr-3 font-medium">Действия</th>
          </tr>
        </thead>
        <tbody>
      {accesses.map((access) => (
        <tr className="border-b border-slate-100" key={access.id}>
          <td className="py-3 pr-3 font-medium text-slate-950">
            {access.user?.name ?? "Без имени"}
          </td>
          <td className="py-3 pr-3 text-slate-600">
            {access.user?.email ?? "Email не указан"}
          </td>
          <td className="py-3 pr-3">
            <span className="inline-flex rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700">
              {inviteRoleLabels[access.role]}
            </span>
          </td>
          <td className="py-3 pr-3">
            <div className="flex flex-wrap gap-2">
              <button
                className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={access.userId === currentUserId}
                onClick={() => onEditRole(access.userId, access.role)}
                type="button"
              >
                {"Редактировать роль"}
              </button>
              <button
                className="h-9 rounded-md border border-red-200 bg-white px-3 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={access.userId === currentUserId}
                onClick={() => onDelete(access.userId)}
                type="button"
              >
                Удалить
              </button>
            </div>
          </td>
        </tr>
      ))}
        </tbody>
      </table>
    </div>
  );
}

function RoleEditModal({
  isOpen,
  onClose,
  onSubmit,
  role,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  role?: UserRole;
}) {
  if (!isOpen || !role) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4">
      <form
        className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"
        onSubmit={onSubmit}
      >
        <h2 className="font-semibold text-slate-950">{"Редактировать роль"}</h2>
        <p className="mt-1 text-sm text-slate-600">
          Выберите новую роль пользователя на этом объекте.
        </p>

        <label className="mt-4 grid gap-1.5">
          <span className="text-sm font-medium text-slate-700">{"Роль"}</span>
          <select
            className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-teal-700"
            defaultValue={role}
            name="role"
            required
          >
            {userRoleValues.map((roleValue) => (
              <option key={roleValue} value={roleValue}>
                {inviteRoleLabels[roleValue]}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
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
            {"Сохранить"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
}: {
  name: string;
  label: string;
  type?: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-teal-700"
        min={type === "number" ? "0" : undefined}
        name={name}
        required
        type={type}
      />
    </label>
  );
}
