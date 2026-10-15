import 'reflect-metadata';
import { join } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GameExceptionFilter } from './infrastructure/http/game-exception.filter';

export async function createApp() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const publicDirectory =
    process.env.NODE_ENV === 'development' ? join(process.cwd(), 'public') : join(__dirname, '..', 'public');
  app.useStaticAssets(publicDirectory);
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new GameExceptionFilter());
  const swagger = new DocumentBuilder().setTitle('The Vault Algorithm').setVersion('1.0').build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));
  return app;
}

async function bootstrap(): Promise<void> {
  const app = await createApp();
  await app.listen(Number(process.env.PORT ?? 3000));
}

if (require.main === module) {
  void bootstrap();
}
