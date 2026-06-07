"use client";

import {
  ArrowLeft,
  Building2,
  Check,
  Factory,
  Pencil,
  Send,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AppealRequestModal } from "@/components/dashboard/appeal-request-modal";
import { BusinessTripRequestModal } from "@/components/dashboard/business-trip-request-modal";
import { MaterialRequestModal } from "@/components/dashboard/material-request-modal";
import { FuelRequestModal } from "@/components/dashboard/fuel-request-modal";
import { MoneyRequestModal } from "@/components/dashboard/money-request-modal";
import { ProductionRequestModal } from "@/components/dashboard/production-request-modal";
import { TransportRequestModal } from "@/components/dashboard/transport-request-modal";
import { NotificationToasts } from "@/components/ui/notification-toasts";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useSuccessMessage } from "@/hooks/use-success-message";
import { getCurrentUser } from "@/lib/auth-api";
import {
  copyObjectAccesses,
  deleteObject,
  deleteObjectUserAccess,
  getObject,
  getMyObjects,
  inviteObjectUser,
  updateObjectName,
  updateObjectUserRole,
} from "@/lib/objects-api";
import { canCreateRequestType } from "@/lib/request-route-config";
import { ObjectEntity, User, UserObjectAccess, UserRole } from "@/lib/types";

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

const inviteRoleLabels: Record<UserRole, string> = {
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
  const [isQuarryRequestOpen, setIsQuarryRequestOpen] = useState(false);
  const [isExpressMaterialRequestOpen, setIsExpressMaterialRequestOpen] =
    useState(false);
  const [isTransportRequestOpen, setIsTransportRequestOpen] = useState(false);
  const [isMoneyRequestOpen, setIsMoneyRequestOpen] = useState(false);
  const [isFuelRequestOpen, setIsFuelRequestOpen] = useState(false);
  const [isBusinessTripRequestOpen, setIsBusinessTripRequestOpen] =
    useState(false);
  const [isProductionRequestOpen, setIsProductionRequestOpen] = useState(false);
  const [isAppealRequestOpen, setIsAppealRequestOpen] = useState(false);
  const [isCopyStaffOpen, setIsCopyStaffOpen] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [isEditingObjectName, setIsEditingObjectName] = useState(false);
  const [myObjectAccesses, setMyObjectAccesses] = useState<UserObjectAccess[]>(
    [],
  );
  const [roleEditTarget, setRoleEditTarget] =
    useState<RoleEditTarget | null>(null);
  const { errorMessage, showError, clearError } = useErrorMessage();
  const { successMessage, showSuccess, clearSuccess } = useSuccessMessage();

  const currentObjectRole = object?.userAccesses?.find(
    (access) => access.userId === user?.id,
  )?.role;
  const currentObjectDirection = object?.direction;
  const canCreateMaterialRequest = canCreateRequestType(
    currentObjectRole,
    "MATERIAL",
    currentObjectDirection,
  );
  const canCreateQuarryRequest = canCreateRequestType(
    currentObjectRole,
    "QUARRY",
    currentObjectDirection,
  );
  const canCreateExpressMaterialRequest = canCreateRequestType(
    currentObjectRole,
    "EXPRESS_MATERIAL",
    currentObjectDirection,
  );
  const canCreateTransportRequest = canCreateRequestType(
    currentObjectRole,
    "TRANSPORT",
    currentObjectDirection,
  );
  const canCreateMoneyRequest = canCreateRequestType(
    currentObjectRole,
    "MONEY",
    currentObjectDirection,
  );
  const canCreateFuelRequest = canCreateRequestType(
    currentObjectRole,
    "FUEL",
    currentObjectDirection,
  );
  const canCreateBusinessTripRequest = canCreateRequestType(
    currentObjectRole,
    "BUSINESS_TRIP",
    currentObjectDirection,
  );
  const canCreateProductionRequest = canCreateRequestType(
    currentObjectRole,
    "PRODUCTION",
    currentObjectDirection,
  );
  const canCreateAppealRequest = canCreateRequestType(
    currentObjectRole,
    "APPEAL",
    currentObjectDirection,
  );
  const canInviteUsers = currentObjectRole === "DIRECTOR";
  const canDeleteObject = currentObjectRole === "DIRECTOR";

  useEffect(() => {
    void loadPage();
  }, [objectId]);

  async function loadPage() {
    clearError();

    try {
      const [nextObject, currentUser, nextObjectAccesses] = await Promise.all([
        getObject(objectId),
        getCurrentUser(),
        getMyObjects(),
      ]);
      setObject(nextObject);
      setUser(currentUser);
      setMyObjectAccesses(nextObjectAccesses);
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

  async function submitObjectNameEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!object) {
      return;
    }

    clearError();
    clearSuccess();

    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();

    if (!name) {
      showError("Укажите название объекта");
      return;
    }

    try {
      const updatedObject = await updateObjectName(object.id, name);
      setObject(updatedObject);
      setIsEditingObjectName(false);
      showSuccess("Название объекта обновлено");
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
      showSuccess("Роль пользователя обновлена");
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

  async function copyStaffFromObject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearError();
    clearSuccess();

    const form = new FormData(event.currentTarget);
    const sourceObjectId = String(form.get("sourceObjectId") ?? "");
    const mode = String(form.get("mode") ?? "SKIP_EXISTING") as
      | "OVERWRITE_ROLES"
      | "SKIP_EXISTING";

    if (!sourceObjectId) {
      showError("Выберите объект-источник");
      return;
    }

    try {
      const result = await copyObjectAccesses(objectId, {
        mode,
        sourceObjectId,
      });
      showSuccess(
        `Штат скопирован: добавлено ${result.created}, обновлено ${result.updated}, Оставлено ${result.skipped}`,
      );
      setIsCopyStaffOpen(false);
      await loadPage();
    } catch (error) {
      showError(error);
    }
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
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
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

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:py-6">
        {!object ? (
          <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
            Загружаем объект...
          </div>
        ) : (
          <>
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                <div className="flex min-w-0 gap-3 sm:gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-700 sm:size-12">
                    <Building2 size={22} />
                  </span>
                  <div className="min-w-0">
                    {isEditingObjectName ? (
                      <form
                        className="flex min-w-0 flex-wrap items-center gap-2"
                        onSubmit={submitObjectNameEdit}
                      >
                        <input
                          autoFocus
                          className="h-10 min-w-0 flex-1 rounded-md border border-slate-300 px-3 text-lg font-semibold text-slate-950 outline-none focus:border-teal-700"
                          defaultValue={object.name}
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
                          onClick={() => setIsEditingObjectName(false)}
                          title="Отменить"
                          type="button"
                        >
                          <X size={16} />
                        </button>
                      </form>
                    ) : (
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <h1 className="break-words text-xl font-semibold text-slate-950 sm:text-2xl">
                          {object.name}
                        </h1>
                        {canInviteUsers ? (
                          <button
                            className="grid size-9 place-items-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                            onClick={() => setIsEditingObjectName(true)}
                            title="Редактировать название"
                            type="button"
                          >
                            <Pencil size={16} />
                          </button>
                        ) : null}
                      </div>
                    )}
                    <p className="mt-1 text-sm text-slate-600">
                      {objectTypeLabels[object.type]} ·{" "}
                      {objectDirectionLabels[object.direction]}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:min-w-[28rem] xl:grid-cols-3">
                  {canCreateMaterialRequest ? (
                    <button
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800"
                      onClick={() => setIsMaterialRequestOpen(true)}
                      type="button"
                    >
                      <Send size={16} />
                      Заявка на ТМЦ
                    </button>
                  ) : null}

                  {canCreateTransportRequest ? (
                    <button
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-teal-200 bg-white px-3 text-sm font-medium text-teal-700 hover:bg-teal-50"
                      onClick={() => setIsTransportRequestOpen(true)}
                      type="button"
                    >
                      <Send size={16} />
                      Заявка на транспорт
                    </button>
                  ) : null}

                  {canCreateQuarryRequest ? (
                    <button
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-stone-200 bg-white px-3 text-sm font-medium text-stone-700 hover:bg-stone-50"
                      onClick={() => setIsQuarryRequestOpen(true)}
                      type="button"
                    >
                      <Send size={16} />
                      Заявка на карьер
                    </button>
                  ) : null}

                  {canCreateExpressMaterialRequest ? (
                    <button
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-cyan-200 bg-white px-3 text-sm font-medium text-cyan-700 hover:bg-cyan-50"
                      onClick={() => setIsExpressMaterialRequestOpen(true)}
                      type="button"
                    >
                      <Send size={16} />
                      Экспресс ТМЦ
                    </button>
                  ) : null}

                  {canCreateMoneyRequest ? (
                    <button
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-amber-200 bg-white px-3 text-sm font-medium text-amber-700 hover:bg-amber-50"
                      onClick={() => setIsMoneyRequestOpen(true)}
                      type="button"
                    >
                      <Send size={16} />
                      Заявка на деньги
                    </button>
                  ) : null}

                  {canCreateFuelRequest ? (
                    <button
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-yellow-200 bg-white px-3 text-sm font-medium text-yellow-700 hover:bg-yellow-50"
                      onClick={() => setIsFuelRequestOpen(true)}
                      type="button"
                    >
                      <Send size={16} />
                      Заявка на топливо
                    </button>
                  ) : null}

                  {canCreateBusinessTripRequest ? (
                    <button
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-fuchsia-200 bg-white px-3 text-sm font-medium text-fuchsia-700 hover:bg-fuchsia-50"
                      onClick={() => setIsBusinessTripRequestOpen(true)}
                      type="button"
                    >
                      <Send size={16} />
                      Командировочные
                    </button>
                  ) : null}

                  {canCreateProductionRequest ? (
                    <button
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-indigo-200 bg-white px-3 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
                      onClick={() => setIsProductionRequestOpen(true)}
                      type="button"
                    >
                      <Send size={16} />
                      Заявка на производство
                    </button>
                  ) : null}

                  {canCreateAppealRequest ? (
                    <button
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      onClick={() => setIsAppealRequestOpen(true)}
                      type="button"
                    >
                      <Send size={16} />
                      Обращение
                    </button>
                  ) : null}

                  {canDeleteObject ? (
                    <button
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-red-200 bg-white px-3 text-sm font-medium text-red-700 hover:bg-red-50 sm:col-span-2 xl:col-span-1"
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

            <div className="grid gap-4 lg:grid-cols-[minmax(20rem,24rem)_minmax(0,1fr)] lg:items-start">
              {canInviteUsers ? (
                <aside className="grid min-w-0 gap-4 self-start">
                  <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between lg:block">
                      <div>
                        <h2 className="font-semibold text-slate-950">
                        Пригласить пользователя
                        </h2>
                        <p className="mt-1 text-sm text-slate-600">
                          Назначьте роль и доступ к этому объекту или отделу.
                        </p>
                      </div>
                      <button
                        className="h-10 shrink-0 rounded-md border border-teal-200 bg-white px-3 text-sm font-medium text-teal-700 hover:bg-teal-50 lg:mt-4 lg:w-full"
                        onClick={() => setIsCopyStaffOpen(true)}
                        type="button"
                      >
                        Копировать из объекта
                      </button>
                    </div>
                      <form className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1" onSubmit={inviteUser}>
                        <Field name="email" label="Email" type="email" />
                        <Field name="name" label="Имя" />
                        <label className="grid gap-1.5 sm:col-span-2 lg:col-span-1">
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
                          className="h-10 rounded-md bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:col-span-2 lg:col-span-1"
                          disabled={isInviting}
                          type="submit"
                        >
                          {isInviting ? "Отправляем..." : "Пригласить"}
                        </button>
                      </form>
                  </section>

                </aside>
              ) : null}

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
            </div>

            <MaterialRequestModal
              isOpen={isMaterialRequestOpen}
              object={object}
              onClose={() => setIsMaterialRequestOpen(false)}
              onError={showError}
              onSuccess={showSuccess}
            />
            <MaterialRequestModal
              isOpen={isQuarryRequestOpen}
              object={object}
              onClose={() => setIsQuarryRequestOpen(false)}
              onError={showError}
              onSuccess={showSuccess}
              variant="quarry"
            />
            <MaterialRequestModal
              isOpen={isExpressMaterialRequestOpen}
              object={object}
              onClose={() => setIsExpressMaterialRequestOpen(false)}
              onError={showError}
              onSuccess={showSuccess}
              variant="express"
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
            <FuelRequestModal
              isOpen={isFuelRequestOpen}
              object={object}
              onClose={() => setIsFuelRequestOpen(false)}
              onError={showError}
              onSuccess={showSuccess}
            />
            <BusinessTripRequestModal
              isOpen={isBusinessTripRequestOpen}
              object={object}
              onClose={() => setIsBusinessTripRequestOpen(false)}
              onError={showError}
              onSuccess={showSuccess}
            />
            <ProductionRequestModal
              isOpen={isProductionRequestOpen}
              object={object}
              onClose={() => setIsProductionRequestOpen(false)}
              onError={showError}
              onSuccess={showSuccess}
            />
            <AppealRequestModal
              isOpen={isAppealRequestOpen}
              object={object}
              onClose={() => setIsAppealRequestOpen(false)}
              onError={showError}
              onSuccess={showSuccess}
            />
            <RoleEditModal
              isOpen={Boolean(roleEditTarget)}
              onClose={() => setRoleEditTarget(null)}
              onSubmit={submitRoleEdit}
              role={roleEditTarget?.role}
            />
            <CopyStaffModal
              currentObjectId={objectId}
              isOpen={isCopyStaffOpen}
              objectAccesses={myObjectAccesses}
              onClose={() => setIsCopyStaffOpen(false)}
              onSubmit={copyStaffFromObject}
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
    <>
      <div className="mt-4 grid gap-3 md:hidden">
        {accesses.map((access) => (
          <article
            className="rounded-md border border-slate-200 bg-white p-3"
            key={access.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="break-words font-medium text-slate-950">
                  {access.user?.name ?? "Без имени"}
                </div>
                <div className="mt-1 break-all text-sm text-slate-600">
                  {access.user?.email ?? "Email не указан"}
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700">
                {inviteRoleLabels[access.role]}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={access.userId === currentUserId}
                onClick={() => onEditRole(access.userId, access.role)}
                type="button"
              >
                Роль
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
          </article>
        ))}
      </div>

      <div className="mt-4 hidden overflow-x-auto md:block">
      <table className="w-full min-w-[720px] border-collapse text-sm">
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
        <tr className="border-b border-slate-100 align-top" key={access.id}>
          <td className="max-w-[14rem] break-words py-3 pr-3 font-medium text-slate-950">
            {access.user?.name ?? "Без имени"}
          </td>
          <td className="max-w-[16rem] break-all py-3 pr-3 text-slate-600">
            {access.user?.email ?? "Email не указан"}
          </td>
          <td className="py-3 pr-3">
            <span className="inline-flex rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700">
              {inviteRoleLabels[access.role]}
            </span>
          </td>
          <td className="py-3 pr-3">
            <div className="flex flex-wrap justify-end gap-2 lg:justify-start">
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
    </>
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
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/40 px-4 py-4">
      <form
        className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl sm:p-5"
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

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
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

function CopyStaffModal({
  currentObjectId,
  isOpen,
  objectAccesses,
  onClose,
  onSubmit,
}: {
  currentObjectId: string;
  isOpen: boolean;
  objectAccesses: UserObjectAccess[];
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (!isOpen) {
    return null;
  }

  const sourceObjects = objectAccesses.filter(
    (access) =>
      access.objectId !== currentObjectId &&
      access.role === "DIRECTOR" &&
      access.object,
  );

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/40 px-4 py-4">
      <form
        className="w-full max-w-lg rounded-lg bg-white p-4 shadow-xl sm:p-5"
        onSubmit={onSubmit}
      >
        <h2 className="font-semibold text-slate-950">
          Копировать штат из объекта
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Пользователи и их роли будут скопированы из выбранного объекта в
          текущий объект.
        </p>

        <label className="mt-4 grid gap-1.5">
          <span className="text-sm font-medium text-slate-700">
            Объект-источник
          </span>
          <select
            className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-teal-700"
            name="sourceObjectId"
            required
          >
            <option value="">Выберите объект</option>
            {sourceObjects.map((access) => (
              <option key={access.objectId} value={access.objectId}>
                {access.object.name}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-4 grid gap-1.5">
          <span className="text-sm font-medium text-slate-700">
            Если пользователь уже есть
          </span>
          <select
            className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-teal-700"
            defaultValue="SKIP_EXISTING"
            name="mode"
            required
          >
            <option value="SKIP_EXISTING">Оставить существующую роль</option>
            <option value="OVERWRITE_ROLES">Обновить роль</option>
          </select>
        </label>

        {!sourceObjects.length ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Нет других объектов, где у вас есть роль директора.
          </div>
        ) : null}

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={onClose}
            type="button"
          >
            Отмена
          </button>
          <button
            className="h-10 rounded-md bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={!sourceObjects.length}
            type="submit"
          >
            Скопировать
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
