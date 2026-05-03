"use client";

import { Plus, Send, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { createMaterialSupplyRequest } from "@/lib/supply-requests-api";
import { ObjectEntity } from "@/lib/types";

type MaterialRequestFormItem = {
  objectMaterialId: string;
  quantity: string;
};

type MaterialRequestModalProps = {
  isOpen: boolean;
  object: ObjectEntity;
  onClose: () => void;
  onError: (error: unknown) => void;
  onSuccess: (message: string) => void;
};

export function MaterialRequestModal({
  isOpen,
  object,
  onClose,
  onError,
  onSuccess,
}: MaterialRequestModalProps) {
  const [requestItems, setRequestItems] = useState<MaterialRequestFormItem[]>([
    { objectMaterialId: "", quantity: "1" },
  ]);

  const requestTotalAmount = requestItems.reduce((total, item) => {
    const material = object.materials?.find(
      (current) => current.id === item.objectMaterialId,
    );

    return total + toNumber(material?.estimatedPrice) * toNumber(item.quantity);
  }, 0);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  function updateRequestItem(
    index: number,
    field: keyof MaterialRequestFormItem,
    value: string,
  ) {
    setRequestItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  }

  function addRequestItem() {
    setRequestItems((current) => [
      ...current,
      { objectMaterialId: "", quantity: "1" },
    ]);
  }

  function removeRequestItem(index: number) {
    setRequestItems((current) =>
      current.length === 1
        ? [{ objectMaterialId: "", quantity: "1" }]
        : current.filter((_, itemIndex) => itemIndex !== index),
    );
  }

  async function submitMaterialRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const items = requestItems
      .map((item) => ({
        objectMaterialId: item.objectMaterialId,
        quantity: item.quantity,
      }))
      .filter((item) => item.objectMaterialId && toNumber(item.quantity) > 0);

    if (!items.length) {
      onError("Добавьте хотя бы один материал в заявку");
      return;
    }

    try {
      const request = await createMaterialSupplyRequest({
        objectId: object.id,
        items,
      });

      setRequestItems([{ objectMaterialId: "", quantity: "1" }]);
      onSuccess(`Заявка ${request.requestNumber} создана и отправлена в ПТО`);
      onClose();
    } catch (error) {
      onError(error);
    }
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end bg-slate-950/45 px-3 py-3 sm:items-center sm:px-6"
      role="dialog"
    >
      <div className="mx-auto flex max-h-[92vh] w-full max-w-4xl flex-col rounded-lg bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Заявка на материалы
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {object.name}: выберите материалы из справочника объекта.
            </p>
          </div>
          <button
            aria-label="Закрыть"
            className="grid size-9 shrink-0 place-items-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
            onClick={onClose}
            title="Закрыть"
            type="button"
          >
            <X size={16} />
          </button>
        </div>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={submitMaterialRequest}
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            <div className="mb-4 rounded-md bg-slate-100 px-3 py-2 text-sm">
              <span className="text-slate-500">Итого по заявке: </span>
              <span className="font-semibold text-slate-950">
                {formatMoney(requestTotalAmount)}
              </span>
            </div>

            <div className="grid gap-3">
              {requestItems.map((item, index) => {
                const selectedMaterial = object.materials?.find(
                  (material) => material.id === item.objectMaterialId,
                );
                const rowAmount =
                  toNumber(selectedMaterial?.estimatedPrice) *
                  toNumber(item.quantity);

                return (
                  <div
                    className="grid min-w-0 gap-3 rounded-md border border-slate-200 p-3 md:grid-cols-[minmax(0,1fr)_130px_130px_40px]"
                    key={`${index}-${item.objectMaterialId}`}
                  >
                    <label className="grid min-w-0 gap-1.5">
                      <span className="text-sm font-medium text-slate-700">
                        Материал
                      </span>
                      <select
                        className="h-10 w-full min-w-0 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-teal-700"
                        onChange={(event) =>
                          updateRequestItem(
                            index,
                            "objectMaterialId",
                            event.target.value,
                          )
                        }
                        required
                        value={item.objectMaterialId}
                      >
                        <option value="">Выберите материал</option>
                        {object.materials?.map((material) => (
                          <option key={material.id} value={material.id}>
                            {material.name} · {material.measurementUnit} ·{" "}
                            {formatMoney(toNumber(material.estimatedPrice))}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="grid min-w-0 gap-1.5">
                      <span className="text-sm font-medium text-slate-700">
                        Количество
                      </span>
                      <input
                        className="h-10 w-full min-w-0 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-teal-700"
                        min="0.001"
                        onChange={(event) =>
                          updateRequestItem(index, "quantity", event.target.value)
                        }
                        required
                        step="0.001"
                        type="number"
                        value={item.quantity}
                      />
                    </label>

                    <div className="grid min-w-0 gap-1.5">
                      <span className="text-sm font-medium text-slate-700">
                        Сумма
                      </span>
                      <div className="flex h-10 items-center rounded-md bg-slate-50 px-3 text-sm font-medium text-slate-700">
                        {formatMoney(rowAmount)}
                      </div>
                    </div>

                    <button
                      aria-label="Удалить позицию"
                      className="grid size-10 place-items-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 md:mt-6"
                      onClick={() => removeRequestItem(index)}
                      title="Удалить позицию"
                      type="button"
                    >
                      <X size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:justify-between sm:px-5">
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={addRequestItem}
              type="button"
            >
              <Plus size={16} />
              Добавить позицию
            </button>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={!object.materials?.length}
              type="submit"
            >
              <Send size={16} />
              Отправить в ПТО
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function toNumber(value: string | number | null | undefined) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatMoney(value: number) {
  return `${value.toLocaleString("ru-KZ")} ₸`;
}
