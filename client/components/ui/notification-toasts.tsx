"use client";

import { CheckCircle2, X, XCircle } from "lucide-react";
import type { ReactNode } from "react";

type NotificationToastsProps = {
  errorMessage?: string;
  successMessage?: string;
  onClearError?: () => void;
  onClearSuccess?: () => void;
};

export function NotificationToasts({
  errorMessage,
  successMessage,
  onClearError,
  onClearSuccess,
}: NotificationToastsProps) {
  if (!errorMessage && !successMessage) {
    return null;
  }

  return (
    <div className="fixed right-4 top-20 z-[1000] grid w-[calc(100vw-2rem)] max-w-sm gap-3 sm:right-6 sm:top-6">
      {errorMessage ? (
        <Toast
          icon={<XCircle size={20} />}
          message={errorMessage}
          onClose={onClearError}
          tone="error"
        />
      ) : null}
      {successMessage ? (
        <Toast
          icon={<CheckCircle2 size={20} />}
          message={successMessage}
          onClose={onClearSuccess}
          tone="success"
        />
      ) : null}
    </div>
  );
}

function Toast({
  icon,
  message,
  onClose,
  tone,
}: {
  icon: ReactNode;
  message: string;
  onClose?: () => void;
  tone: "error" | "success";
}) {
  const toneClasses =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-emerald-200 bg-emerald-50 text-emerald-800";

  const iconClasses = tone === "error" ? "text-red-600" : "text-emerald-600";

  return (
    <div
      className={`flex items-start gap-3 rounded-md border px-4 py-3 shadow-lg shadow-slate-900/10 ${toneClasses}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <span className={`mt-0.5 shrink-0 ${iconClasses}`}>{icon}</span>
      <div className="min-w-0 flex-1 break-words text-sm font-medium leading-5">
        {message}
      </div>
      {onClose ? (
        <button
          aria-label="Close notification"
          className="grid size-6 shrink-0 place-items-center rounded-md text-current opacity-70 hover:bg-white/60 hover:opacity-100"
          onClick={onClose}
          type="button"
        >
          <X size={16} />
        </button>
      ) : null}
    </div>
  );
}
