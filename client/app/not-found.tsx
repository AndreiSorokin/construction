import { redirect } from 'next/navigation';

/** Любой несуществующий адрес (опечатка, чужая ссылка, сканер) уводит на главную этого же приложения. */
export default function NotFound() {
  redirect('/');
}
