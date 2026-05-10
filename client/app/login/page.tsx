import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <AuthShell
      title="Вход"
      description="Войдите, чтобы продолжить работу с заявками и объектами."
      switchHref="/register"
      switchText="Нет аккаунта? Зарегистрируйтесь"
    >
      <LoginForm />
    </AuthShell>
  );
}
