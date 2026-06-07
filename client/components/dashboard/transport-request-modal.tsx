"use client";

import { Send, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createTransportSupplyRequest } from "@/lib/supply-requests-api";
import { ObjectEntity } from "@/lib/types";

type TransportRequestModalProps = {
  isOpen: boolean;
  object: ObjectEntity;
  onClose: () => void;
  onError: (error: unknown) => void;
  onSuccess: (message: string) => void;
};

export function TransportRequestModal({
  isOpen,
  object,
  onClose,
  onError,
  onSuccess,
}: TransportRequestModalProps) {
  const [transportDate, setTransportDate] = useState("");
  const [transportHour, setTransportHour] = useState("");
  const [transportMinute, setTransportMinute] = useState("");
  const now = useMemo(() => new Date(), [isOpen]);
  const today = formatDateInput(now);
  const currentTime = formatTimeInput(now);
  const currentHour = Number(currentTime.split(":")[0]);
  const currentMinute = Number(currentTime.split(":")[1]);
  const isTodaySelected = transportDate === today;
  const transportTime =
    transportHour && transportMinute ? `${transportHour}:${transportMinute}` : "";

  useEffect(() => {
    if (!isOpen) {
      setTransportDate("");
      setTransportHour("");
      setTransportMinute("");
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

  async function submitTransportRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const transportObjectName = String(
      form.get("transportObjectName") ?? "",
    ).trim();
    const transportType = String(form.get("transportType") ?? "").trim();
    const selectedTransportDate = String(
      form.get("transportDate") ?? "",
    ).trim();
    const purpose = String(form.get("purpose") ?? "").trim();

    if (
      !transportObjectName ||
      !transportType ||
      !selectedTransportDate ||
      !transportTime ||
      !purpose
    ) {
      onError("Укажите объект, транспорт, дату, время и назначение");
      return;
    }

    if (isDateTimeInPast(selectedTransportDate, transportTime)) {
      onError("Нельзя выбрать прошедшую дату или время");
      return;
    }

    try {
      const request = await createTransportSupplyRequest({
        objectId: object.id,
        purpose,
        transportDate: selectedTransportDate,
        transportObjectName,
        transportTime,
        transportType,
      });

      formElement.reset();
      setTransportDate("");
      setTransportHour("");
      setTransportMinute("");
      onSuccess(`Заявка ${request.requestNumber} создана и отправлена`);
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
      <div className="mx-auto flex max-h-[92vh] w-full max-w-xl flex-col rounded-lg bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Заявка на транспорт
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Укажите объект, дату, время, транспорт и назначение.
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
          onSubmit={submitTransportRequest}
        >
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-slate-700">Объект</span>
            <input
              className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-teal-700"
              name="transportObjectName"
              placeholder="Наименование объекта"
              required
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-slate-700">Дата</span>
              <input
                className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-teal-700"
                min={today}
                name="transportDate"
                onChange={(event) => setTransportDate(event.target.value)}
                required
                type="date"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-slate-700">Время</span>
              <input name="transportTime" type="hidden" value={transportTime} />
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <select
                  className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-teal-700"
                  onChange={(event) => {
                    setTransportHour(event.target.value);
                    if (
                      isTodaySelected &&
                      Number(event.target.value) === currentHour &&
                      transportMinute &&
                      Number(transportMinute) < currentMinute
                    ) {
                      setTransportMinute("");
                    }
                  }}
                  required
                  value={transportHour}
                >
                  <option value="">Часы</option>
                  {Array.from({ length: 24 }, (_, hour) => {
                    const value = String(hour).padStart(2, "0");
                    const isDisabled = isTodaySelected && hour < currentHour;

                    return (
                      <option disabled={isDisabled} key={value} value={value}>
                        {value}
                      </option>
                    );
                  })}
                </select>
                <span className="text-center font-semibold text-slate-500">:</span>
                <select
                  className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-teal-700"
                  onChange={(event) => setTransportMinute(event.target.value)}
                  required
                  value={transportMinute}
                >
                  <option value="">Мин</option>
                  {Array.from({ length: 60 }, (_, minute) => {
                    const value = String(minute).padStart(2, "0");
                    const isDisabled =
                      isTodaySelected &&
                      Number(transportHour) === currentHour &&
                      minute < currentMinute;

                    return (
                      <option disabled={isDisabled} key={value} value={value}>
                        {value}
                      </option>
                    );
                  })}
                </select>
              </div>
            </label>
          </div>

          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-slate-700">
              Запрашиваемый транспорт
            </span>
            <input
              className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-teal-700"
              name="transportType"
              placeholder="Например: автокран"
              required
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-slate-700">
              Назначение
            </span>
            <textarea
              className="min-h-28 rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-teal-700"
              name="purpose"
              placeholder="Например: подача материалов на 3 этаж"
              required
            />
          </label>

          <div className="flex flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
            <button
              className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={onClose}
              type="button"
            >
              Отменить
            </button>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800"
              type="submit"
            >
              <Send size={16} />
              Отправить заявку
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatTimeInput(date: Date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${hours}:${minutes}`;
}

function isDateTimeInPast(date: string, time: string) {
  const dateTime = new Date(`${date}T${time}:00`);

  return Number.isNaN(dateTime.getTime()) || dateTime.getTime() < Date.now();
}
