import { Factory } from "lucide-react";
import Link from "next/link";
import { ReactNode } from "react";

type AuthShellProps = {
  title: string;
  description: string;
  switchHref: string;
  switchText: string;
  children: ReactNode;
};

export function AuthShell({
  title,
  description,
  switchHref,
  switchText,
  children,
}: AuthShellProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-md bg-teal-700 text-white">
            <Factory size={20} />
          </span>
          <div>
            <div className="font-semibold text-slate-950">{"Стройконтроль"}</div>
            <div className="text-sm text-slate-500"></div>
          </div>
        </div>

        <div className="mb-5">
          <h1 className="text-2xl font-semibold tracking-normal text-slate-950">
            {title}
          </h1>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>

        {children}

        <Link
          className="mt-5 inline-flex text-sm font-medium text-teal-700 hover:text-teal-800"
          href={switchHref}
        >
          {switchText}
        </Link>
      </section>
    </main>
  );
}
