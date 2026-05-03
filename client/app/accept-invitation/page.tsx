import { AuthShell } from "@/components/auth/auth-shell";
import { AcceptInvitationForm } from "@/components/auth/accept-invitation-form";
import { Suspense } from "react";

export default function AcceptInvitationPage() {
  return (
    <AuthShell
      title="Завершить регистрацию"
      description="Придумайте пароль, чтобы принять приглашение и войти в систему."
      switchHref="/login"
      switchText="Уже есть аккаунт? Войти"
    >
      <Suspense
        fallback={<div className="text-sm text-slate-500">Загружаем...</div>}
      >
        <AcceptInvitationForm />
      </Suspense>
    </AuthShell>
  );
}
