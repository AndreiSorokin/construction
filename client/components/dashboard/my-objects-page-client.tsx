"use client";

import { Building2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { NotificationToasts } from "@/components/ui/notification-toasts";
import { useErrorMessage } from "@/hooks/use-error-message";
import { getStoredUser } from "@/lib/auth-storage";
import { getMyObjects } from "@/lib/objects-api";
import { UserObjectAccess } from "@/lib/types";

const accessRoleLabels: Record<UserObjectAccess["role"], string> = {
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

const objectTypeLabels = {
  CONSTRUCTION_OBJECT: "Строительный объект",
  INTERNAL_DEPARTMENT: "Внутренний отдел",
  WORKSHOP: "Цех",
};

export function MyObjectsPageClient() {
  const router = useRouter();
  const [objects, setObjects] = useState<UserObjectAccess[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { errorMessage, showError, clearError } = useErrorMessage();

  useEffect(() => {
    const storedUser = getStoredUser();

    if (!storedUser) {
      router.replace("/login");
      return;
    }

    void loadObjects();
  }, [router]);

  async function loadObjects() {
    setIsLoading(true);
    clearError();

    try {
      setObjects(await getMyObjects());
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
      <DashboardNav onObjectCreated={loadObjects} subtitle="Мои объекты" />

      <section className="mx-auto grid w-full max-w-none gap-4 px-3 py-5 sm:px-4 lg:px-6 lg:py-6">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="font-semibold text-slate-950">Мои объекты</h1>
              <p className="mt-1 text-sm text-slate-600">
                Объекты и отделы, к которым у вас есть доступ.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
              {objects.length}
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {objects.map((access) => (
              <Link
                className="grid gap-2 rounded-md border border-slate-200 p-4 hover:border-teal-700 hover:bg-teal-50"
                href={`/dashboard/objects/${access.object.id}`}
                key={access.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-700">
                      <Building2 size={18} />
                    </span>
                    <div className="min-w-0">
                      <div className="break-words font-medium text-slate-950">
                        {access.object.name}
                      </div>
                      <div className="text-sm text-slate-600">
                        {objectTypeLabels[access.object.type]}
                      </div>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                    {accessRoleLabels[access.role]}
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {!objects.length && !isLoading ? (
            <div className="mt-4 rounded-md border border-dashed border-slate-300 p-5 text-sm text-slate-600">
              Пока нет доступных объектов. Создайте первый объект или попросите
              директора пригласить вас.
            </div>
          ) : null}

          {isLoading ? (
            <div className="mt-4 rounded-md border border-dashed border-slate-300 p-5 text-sm text-slate-600">
              Загружаем объекты...
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}
