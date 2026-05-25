"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useSuccessMessage } from "@/hooks/use-success-message";
import { NotificationToasts } from "@/components/ui/notification-toasts";
import { acceptInvitation } from "@/lib/auth-api";
import { saveAuthSession } from "@/lib/auth-storage";

export function AcceptInvitationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { errorMessage, showError, clearError } = useErrorMessage();
  const { successMessage, showSuccess, clearSuccess } = useSuccessMessage();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    clearError();
    clearSuccess();

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    const passwordConfirm = String(form.get("passwordConfirm"));

    if (!token) {
      showError("!AK;:0 ?@83;0H5=8O =5:>@@5:B=0: >BACBAB2C5B token");
      setIsSubmitting(false);
      return;
    }

    if (password !== passwordConfirm) {
      showError("Пароли не совпадают");
      setIsSubmitting(false);
      return;
    }

    try {
      const auth = await acceptInvitation({
        token,
        password,
      });

      saveAuthSession(auth);
      showSuccess("Приглашение принято");
      router.replace("/dashboard");
    } catch (error) {
      showError(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <NotificationToasts
        errorMessage={errorMessage}
        successMessage={successMessage}
        onClearError={clearError}
        onClearSuccess={clearSuccess}
      />
      {!token ? (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {"Ссылка приглашения некорректна: отсутствует token."}
        </div>
      ) : null}

      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-slate-700">Пароль</span>
        <input
          autoComplete="new-password"
          className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-teal-700"
          minLength={6}
          name="password"
          required
          type="password"
        />
      </label>

      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-slate-700">
          Повторите пароль
        </span>
        <input
          autoComplete="new-password"
          className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-teal-700"
          minLength={6}
          name="passwordConfirm"
          required
          type="password"
        />
      </label>

      <button
        className="h-10 rounded-md bg-teal-700 px-4 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting || !token}
        type="submit"
      >
        {isSubmitting ? "Принимаем..." : "Принять приглашение"}
      </button>
    </form>
  );
}
