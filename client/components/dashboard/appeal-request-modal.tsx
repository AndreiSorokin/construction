"use client";

import { Send, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
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

  async function submitAppealRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const text = String(form.get("text") ?? "").trim();

    if (!text) {
      onError("Укажите текст обращения");
      return;
    }

    try {
      setIsSubmitting(true);
      const request = await createAppealSupplyRequest({
        objectId: object.id,
        text,
      });

      formElement.reset();
      onSuccess(`Обращение ${request.requestNumber} создано и отправлено`);
      onClose();
    } catch (error) {
      onError(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end bg-slate-950/45 px-3 py-3 sm:items-center sm:px-6"
      role="dialog"
    >
      <div className="mx-auto flex max-h-[92vh] w-full max-w-xl flex-col rounded-lg bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Обращение
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {object.name}: напишите текст обращения.
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
          className="grid gap-4 px-4 py-4 sm:px-5"
          onSubmit={submitAppealRequest}
        >
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-slate-700">
              Текст обращения
            </span>
            <textarea
              className="min-h-40 rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-teal-700"
              name="text"
              placeholder="Опишите обращение"
              required
            />
          </label>

          <div className="flex flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
            <button
              className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={onClose}
              type="button"
            >
              Отмена
            </button>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={isSubmitting}
              type="submit"
            >
              <Send size={16} />
              {isSubmitting ? "Отправляем..." : "Отправить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
