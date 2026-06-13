"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { RequestsBankPanel } from "@/components/dashboard/requests-bank-panel";
import { getStoredUser } from "@/lib/auth-storage";
import { User } from "@/lib/types";

export function RequestsBankPageClient() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const storedUser = getStoredUser();

    if (!storedUser) {
      router.replace("/login");
      return;
    }

    setUser(storedUser);
  }, [router]);

  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-100">
        <div className="text-sm text-slate-500">Проверяем сессию...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <DashboardNav subtitle="Банк заявок" />

      <section className="mx-auto grid w-full max-w-none gap-4 px-3 py-5 sm:px-4 lg:px-6 lg:py-6">
        <RequestsBankPanel />
      </section>
    </main>
  );
}
