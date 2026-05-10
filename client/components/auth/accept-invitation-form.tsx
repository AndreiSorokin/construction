"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useSuccessMessage } from "@/hooks/use-success-message";
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
      {!token ? (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {"\u0421\u0441\u044b\u043b\u043a\u0430 \u043f\u0440\u0438\u0433\u043b\u0430\u0448\u0435\u043d\u0438\u044f \u043d\u0435\u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u0430: \u043e\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u0435\u0442 token."}
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

      <Message text={errorMessage} tone="error" />
      <Message text={successMessage} tone="success" />

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

function Message({ text, tone }: { text: string; tone: "error" | "success" }) {
  if (!text) return null;

  return (
    <div
      className={
        tone === "error"
          ? "rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
          : "rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
      }
    >
      {text}
    </div>
  );
}
