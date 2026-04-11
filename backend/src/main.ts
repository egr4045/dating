import 'dotenv/config'; 
import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
async function bootstrap() {
  // ── Валидация критических переменных окружения ─────────────────────────────
  if (!process.env.JWT_SECRET) {
    throw new Error('❌  JWT_SECRET не задан. Запуск отклонён — это уязвимость безопасности.');
  }
  if (!process.env.FRONTEND_URL) {
    console.warn('⚠️   FRONTEND_URL не задан — CORS будет разрешать только localhost.');
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });
  
  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost)));

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // удаляет поля, которых нет в DTO
    forbidNonWhitelisted: true, // выбрасывает ошибку, если есть лишние поля
    transform: true, // автоматически преобразует типы на основе DTO
  }));

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Разрешаем запросы без origin (например, мобильные приложения или curl)
      if (!origin) {
        callback(null, true);
        return;
      }
      
      const allowedPatterns = [
        /^http:\/\/localhost(:\d+)?$/,
        /^http:\/\/127\.0\.0\.1(:\d+)?$/,
      ];

      const isAllowed = allowedPatterns.some(pattern => pattern.test(origin)) 
        || origin === process.env.FRONTEND_URL;

      if (isAllowed) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked request from origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

