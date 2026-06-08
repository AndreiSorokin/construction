"use client";

import { FormEvent, useState } from "react";
import { createAppealSupplyRequest } from "@/lib/supply-requests-api";
import { ObjectEntity } from "@/lib/types";

type AppealRequestModalProps = {
  isOpen: boolean;
  object: ObjectEntity;
  onClose: () => void;
  onError: (error: unknown) => void;
  onSuccess: (message: string) => void;
};

export function AppealRequestModal({
  isOpen,
  object,
  onClose,
  onError,
  onSuccess,
}: AppealRequestModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) {
    return null;
  }

  async function submitAppeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const text = String(form.get("text") ?? "").trim();

    if (!text) {
      onError("Укажите текст обращения");
      return;
    }

    try {
      setIsSubmitting(true);
      await createAppealSupplyRequest({
        objectId: object.id,
        text,
      });
      onSuccess("Обращение отправлено");
      onClose();
    } catch (error) {
      onError(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/40 px-4 py-4">
      <form
        className="w-full max-w-xl rounded-lg bg-white p-4 shadow-xl sm:p-5"
        onSubmit={submitAppeal}
      >
        <h2 className="font-semibold text-slate-950">Обращение</h2>
        <p className="mt-1 text-sm text-slate-600">{object.name}</p>

        <label className="mt-4 grid gap-1.5">
          <span className="text-sm font-medium text-slate-700">
            Текст обращения
          </span>
          <textarea
            className="min-h-40 rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-teal-700"
            name="text"
            required
          />
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
            className="h-10 rounded-md bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Отправляем..." : "Отправить"}
          </button>
        </div>
      </form>
    </div>
  );
}
