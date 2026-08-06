import { redirect } from 'next/navigation';

/** Любой несуществующий адрес (опечатка, чужая ссылка, сканер) уводит на основной сайт компании. */
export default function NotFound() {
  redirect('https://ck.interstil.kz/');
}
