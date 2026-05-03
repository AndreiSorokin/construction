import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <AuthShell
      title="Регистрация"
      description="Самостоятельная регистрация создает аккаунт без роли."
      switchHref="/login"
      switchText="Уже есть аккаунт"
    >
      <RegisterForm />
    </AuthShell>
  );
}
