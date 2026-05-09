import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <AuthShell
      title="Регистрация"
      description="Зарегистрируйтесь, чтобы начать работу в системе."
      switchHref="/login"
      switchText="Уже есть аккаунт"
    >
      <RegisterForm />
    </AuthShell>
  );
}
