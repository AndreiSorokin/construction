import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use(cookieParser());

  const staticOrigins = config.get<string[]>('webOrigin') || [];
  const rootDomain = config.get<string>('org.rootDomain') || '';
  app.enableCors({
    // помимо статического списка WEB_ORIGIN, разрешаем любой поддомен корневого домена —
    // {slug}.<rootDomain> (в деве rootDomain=localhost, в проде interstil.kz)
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // curl/сервер-сервер, без Origin
      try {
        const hostname = new URL(origin).hostname;
        const allowed =
          staticOrigins.includes(origin) ||
          (!!rootDomain && (hostname === rootDomain || hostname.endsWith(`.${rootDomain}`)));
        cb(null, allowed);
      } catch {
        cb(null, false);
      }
    },
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Глобально требуем JWT; публичные ручки помечаются @Public()
  app.useGlobalGuards(new JwtAuthGuard(app.get(Reflector)));

  const port = config.get<number>('port') || 4001;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API запущен: http://localhost:${port}/api`);
}
bootstrap();
