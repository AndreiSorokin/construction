"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { login } from "@/lib/auth-api";
import { saveAuthSession } from "@/lib/auth-storage";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useSuccessMessage } from "@/hooks/use-success-message";
import { NotificationToasts } from "@/components/ui/notification-toasts";

export function LoginForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { errorMessage, showError, clearError } = useErrorMessage();
  const { successMessage, showSuccess, clearSuccess } = useSuccessMessage();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    clearError();
    clearSuccess();

    const form = new FormData(event.currentTarget);

    try {
      const auth = await login({
        email: String(form.get("email")),
        password: String(form.get("password")),
      });

      saveAuthSession(auth);
      showSuccess("Вход выполнен");
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
      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-slate-700">Email</span>
        <input
          className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-teal-700"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </label>

      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-slate-700">Пароль</span>
        <input
          className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-teal-700"
          name="password"
          type="password"
          autoComplete="current-password"
          minLength={6}
          required
        />
      </label>

      <button
        className="h-10 rounded-md bg-teal-700 px-4 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Входим..." : "Войти"}
      </button>
    </form>
  );
}
