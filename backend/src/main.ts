import 'dotenv/config'; 
import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
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
        /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/
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

