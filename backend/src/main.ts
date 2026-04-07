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

  app.enableCors({ origin: process.env.FRONTEND_URL || '*' });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

