import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Интерстиль — снабжение и наряды',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body className="bg-stone-100 text-stone-900 antialiased">{children}</body>
    </html>
  );
}
