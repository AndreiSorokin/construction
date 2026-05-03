"use client";

import {
  ArrowLeft,
  Building2,
  Edit2,
  Factory,
  Save,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChangeEvent,
  FormEvent,
  ReactNode,
  useEffect,
  useState,
} from "react";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useSuccessMessage } from "@/hooks/use-success-message";
import { getCurrentUser } from "@/lib/auth-api";
import {
  createObjectMaterial,
  deleteObject,
  deleteObjectMaterial,
  downloadMaterialsTemplate,
  getObject,
  importObjectMaterials,
  updateObjectMaterial,
} from "@/lib/objects-api";
import { ObjectEntity, ObjectMaterial, User } from "@/lib/types";

const objectTypeLabels = {
  CONSTRUCTION_OBJECT: "Строительный объект",
  INTERNAL_DEPARTMENT: "Внутренний отдел",
};

type MaterialEditForm = {
  name: string;
  type: string;
  measurementUnit: string;
  estimatedPrice: string;
};

export function ObjectDetailsClient({ objectId }: { objectId: string }) {
  const router = useRouter();
  const [object, setObject] = useState<ObjectEntity | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(
    null,
  );
  const [editForm, setEditForm] = useState<MaterialEditForm>({
    name: "",
    type: "",
    measurementUnit: "",
    estimatedPrice: "",
  });
  const { errorMessage, showError, clearError } = useErrorMessage();
  const { successMessage, showSuccess, clearSuccess } = useSuccessMessage();

  const canAddMaterials =
    user?.role === "DIRECTOR" || user?.role === "CHIEF_ENGINEER";
  const canManageMaterials = user?.role === "DIRECTOR";
  const canDeleteObject = user?.role === "DIRECTOR";
  const materialsTotalAmount =
    object?.materials?.reduce(
      (total, material) => total + toNumber(material.estimatedPrice),
      0,
    ) ?? 0;
  const objectLimitAmount = toNumber(object?.closingLimit);
  const isMaterialsLimitExceeded =
    objectLimitAmount > 0 && materialsTotalAmount > objectLimitAmount;

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

  async function createMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearError();
    clearSuccess();

    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    try {
      await createObjectMaterial(objectId, {
        name: String(form.get("name")),
        type: String(form.get("type")),
        measurementUnit: String(form.get("measurementUnit")),
        estimatedPrice: String(form.get("estimatedPrice")),
      });
      formElement.reset();
      showSuccess("Материал добавлен");
      await loadPage();
    } catch (error) {
      showError(error);
    }
  }

  async function handleTemplateDownload() {
    clearError();

    try {
      await downloadMaterialsTemplate();
    } catch (error) {
      showError(error);
    }
  }

  async function handleImportMaterials(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    clearError();
    clearSuccess();

    try {
      const result = await importObjectMaterials(objectId, file);
      event.target.value = "";
      showSuccess(
        `Импортировано: ${result.imported}. Пропущено дублей: ${result.skipped}.`,
      );
      await loadPage();
    } catch (error) {
      showError(error);
    }
  }

  function startEditMaterial(material: ObjectMaterial) {
    clearError();
    clearSuccess();
    setEditingMaterialId(material.id);
    setEditForm({
      name: material.name,
      type: material.type,
      measurementUnit: material.measurementUnit,
      estimatedPrice: String(material.estimatedPrice),
    });
  }

  function cancelEditMaterial() {
    setEditingMaterialId(null);
  }

  async function saveMaterial(materialId: string) {
    clearError();
    clearSuccess();

    try {
      await updateObjectMaterial(objectId, materialId, editForm);
      setEditingMaterialId(null);
      showSuccess("Материал обновлен");
      await loadPage();
    } catch (error) {
      showError(error);
    }
  }

  async function handleDeleteMaterial(material: ObjectMaterial) {
    const confirmed = window.confirm(
      `Удалить материал "${material.name}"? Это действие нельзя отменить.`,
    );

    if (!confirmed) {
      return;
    }

    clearError();
    clearSuccess();

    try {
      await deleteObjectMaterial(objectId, material.id);
      showSuccess("Материал удален");
      await loadPage();
    } catch (error) {
      showError(error);
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
              <div className="text-sm text-slate-500">Объект</div>
            </div>
          </div>
          <Link
            className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
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
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex gap-4">
                  <span className="grid size-12 place-items-center rounded-md bg-slate-100 text-slate-700">
                    <Building2 size={22} />
                  </span>
                  <div>
                    <h1 className="text-2xl font-semibold text-slate-950">
                      {object.name}
                    </h1>
                    <p className="mt-1 text-sm text-slate-600">
                      {objectTypeLabels[object.type]} · лимит{" "}
                      {Number(object.closingLimit).toLocaleString("ru-KZ")} тг
                    </p>
                  </div>
                </div>

                {canDeleteObject ? (
                  <button
                    className="inline-flex h-10 items-center gap-2 rounded-md border border-red-200 bg-white px-3 text-sm font-medium text-red-700 hover:bg-red-50"
                    onClick={() => void handleDeleteObject()}
                  >
                    <Trash2 size={16} />
                    Удалить объект
                  </button>
                ) : null}
              </div>
            </section>

            <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="font-semibold text-slate-950">Материалы</h2>
                <div
                  className={
                    isMaterialsLimitExceeded
                      ? "mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3"
                      : "mt-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3"
                  }
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm text-slate-500">
                        Сумма материалов по объекту
                      </div>
                      <div className="mt-1 text-xl font-semibold text-slate-950">
                        {formatMoney(materialsTotalAmount)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-slate-500">
                        Лимит объекта
                      </div>
                      <div className="mt-1 font-medium text-slate-700">
                        {formatMoney(objectLimitAmount)}
                      </div>
                    </div>
                  </div>
                  {isMaterialsLimitExceeded ? (
                    <div className="mt-3 rounded-md bg-red-100 px-3 py-2 text-sm font-medium text-red-700">
                      Цена превышает лимит по объекту
                    </div>
                  ) : null}
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[760px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-slate-500">
                        <th className="py-2 pr-3 font-medium">Название</th>
                        <th className="py-2 pr-3 font-medium">Тип</th>
                        <th className="py-2 pr-3 font-medium">Ед.</th>
                        <th className="py-2 pr-3 font-medium">Цена</th>
                        {canManageMaterials ? (
                          <th className="py-2 text-right font-medium">
                            Действия
                          </th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {object.materials?.length ? (
                        object.materials.map((material) => {
                          const isEditing = editingMaterialId === material.id;

                          return (
                            <tr
                              className="border-b border-slate-100 align-top"
                              key={material.id}
                            >
                              <td className="py-3 pr-3 text-slate-950">
                                {isEditing ? (
                                  <TableInput
                                    value={editForm.name}
                                    onChange={(value) =>
                                      setEditForm((current) => ({
                                        ...current,
                                        name: value,
                                      }))
                                    }
                                  />
                                ) : (
                                  material.name
                                )}
                              </td>
                              <td className="py-3 pr-3 text-slate-600">
                                {isEditing ? (
                                  <TableInput
                                    value={editForm.type}
                                    onChange={(value) =>
                                      setEditForm((current) => ({
                                        ...current,
                                        type: value,
                                      }))
                                    }
                                  />
                                ) : (
                                  material.type
                                )}
                              </td>
                              <td className="py-3 pr-3 text-slate-600">
                                {isEditing ? (
                                  <TableInput
                                    value={editForm.measurementUnit}
                                    onChange={(value) =>
                                      setEditForm((current) => ({
                                        ...current,
                                        measurementUnit: value,
                                      }))
                                    }
                                  />
                                ) : (
                                  material.measurementUnit
                                )}
                              </td>
                              <td className="py-3 pr-3 text-slate-600">
                                {isEditing ? (
                                  <TableInput
                                    min="0"
                                    type="number"
                                    value={editForm.estimatedPrice}
                                    onChange={(value) =>
                                      setEditForm((current) => ({
                                        ...current,
                                        estimatedPrice: value,
                                      }))
                                    }
                                  />
                                ) : (
                                  <>
                                    {Number(
                                      material.estimatedPrice,
                                    ).toLocaleString("ru-KZ")}{" "}
                                    тг
                                  </>
                                )}
                              </td>
                              {canManageMaterials ? (
                                <td className="py-3 text-right">
                                  {isEditing ? (
                                    <div className="flex justify-end gap-2">
                                      <IconButton
                                        label="Сохранить"
                                        onClick={() =>
                                          void saveMaterial(material.id)
                                        }
                                      >
                                        <Save size={16} />
                                      </IconButton>
                                      <IconButton
                                        label="Отменить"
                                        onClick={cancelEditMaterial}
                                      >
                                        <X size={16} />
                                      </IconButton>
                                    </div>
                                  ) : (
                                    <div className="flex justify-end gap-2">
                                      <IconButton
                                        label="Редактировать"
                                        onClick={() =>
                                          startEditMaterial(material)
                                        }
                                      >
                                        <Edit2 size={16} />
                                      </IconButton>
                                      <IconButton
                                        danger
                                        label="Удалить"
                                        onClick={() =>
                                          void handleDeleteMaterial(material)
                                        }
                                      >
                                        <Trash2 size={16} />
                                      </IconButton>
                                    </div>
                                  )}
                                </td>
                              ) : null}
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td
                            className="py-6 text-sm text-slate-500"
                            colSpan={canManageMaterials ? 5 : 4}
                          >
                            Материалы еще не добавлены.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {canAddMaterials ? (
                <aside className="grid gap-4">
                  <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="font-semibold text-slate-950">
                      Excel импорт
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Скачайте шаблон, заполните материалы и загрузите файл.
                    </p>
                    <div className="mt-4 grid gap-3">
                      <button
                        className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        onClick={() => void handleTemplateDownload()}
                        type="button"
                      >
                        Скачать шаблон
                      </button>
                      <label className="grid cursor-pointer gap-1.5">
                        <span className="text-sm font-medium text-slate-700">
                          Загрузить Excel
                        </span>
                        <input
                          accept=".xlsx,.xls"
                          className="block w-full text-sm text-slate-600 file:mr-3 file:h-10 file:rounded-md file:border-0 file:bg-teal-700 file:px-3 file:text-sm file:font-medium file:text-white"
                          onChange={(event) =>
                            void handleImportMaterials(event)
                          }
                          type="file"
                        />
                      </label>
                    </div>
                  </section>

                  <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="font-semibold text-slate-950">
                      Добавить вручную
                    </h2>
                    <form className="mt-4 grid gap-3" onSubmit={createMaterial}>
                      <Field name="name" label="Название" />
                      <Field name="type" label="Тип материала" />
                      <Field name="measurementUnit" label="Ед. измерения" />
                      <Field
                        name="estimatedPrice"
                        label="Сметная стоимость"
                        type="number"
                      />
                      <button
                        className="h-10 rounded-md bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800"
                        type="submit"
                      >
                        Добавить
                      </button>
                    </form>
                  </section>
                </aside>
              ) : null}
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function toNumber(value: string | number | null | undefined) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatMoney(value: number) {
  return `${value.toLocaleString("ru-KZ")} тг`;
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

function TableInput({
  min,
  onChange,
  type = "text",
  value,
}: {
  min?: string;
  onChange: (value: string) => void;
  type?: string;
  value: string;
}) {
  return (
    <input
      className="h-9 w-full min-w-28 rounded-md border border-slate-300 px-2 text-sm outline-none focus:border-teal-700"
      min={min}
      onChange={(event) => onChange(event.target.value)}
      required
      type={type}
      value={value}
    />
  );
}

function IconButton({
  children,
  danger = false,
  label,
  onClick,
}: {
  children: ReactNode;
  danger?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className={
        danger
          ? "grid size-9 place-items-center rounded-md border border-red-200 text-red-700 hover:bg-red-50"
          : "grid size-9 place-items-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
      }
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}
