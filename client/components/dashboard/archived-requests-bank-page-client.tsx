"use client";

import { ArrowLeft, Factory } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArchivedRequestsBankPanel } from "@/components/dashboard/archived-requests-bank-panel";
import { getStoredUser } from "@/lib/auth-storage";
import { User } from "@/lib/types";

export function ArchivedRequestsBankPageClient() {
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
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-teal-700 text-white">
              <Factory size={20} />
            </span>
            <div className="min-w-0">
              <div className="truncate font-semibold text-slate-950">
                {"\u0421\u0442\u0440\u043e\u0439\u043a\u043e\u043d\u0442\u0440\u043e\u043b\u044c"}
              </div>
              <div className="text-sm text-slate-500">Банк заявок</div>
            </div>
          </div>
          <Link
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            href="/dashboard"
          >
            <ArrowLeft size={16} />
            Dashboard
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-6">
        <ArchivedRequestsBankPanel />
      </section>
   </main>
  )
}