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
  app.enableCors({ origin: config.get('webOrigin'), credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Глобально требуем JWT; публичные ручки помечаются @Public()
  app.useGlobalGuards(new JwtAuthGuard(app.get(Reflector)));

  const port = config.get<number>('port') || 4001;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API запущен: http://localhost:${port}/api`);
}
bootstrap();
