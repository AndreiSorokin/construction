/** @type {import('next').NextConfig} */
const nextConfig = {
  // локальная проверка мультитенантности через {slug}.localhost — без этого Next.js dev-сервер
  // (начиная с определённой версии) считает запросы с другого поддомена межсайтовыми и в будущей
  // мажорной версии будет их блокировать; *.localhost уже разрешён по умолчанию, но конфигурируем
  // явно, чтобы не полагаться на неявный дефолт
  allowedDevOrigins: ['*.localhost', '*.interstil.kz'],
};

module.exports = nextConfig;
