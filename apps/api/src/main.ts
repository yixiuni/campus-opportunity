import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { readEnvironment } from './database/load-environment';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: [/^http:\/\/(localhost|127\.0\.0\.1):\d+$/],
    credentials: true,
  });

  app.enableShutdownHooks();
  const port = Number(readEnvironment('API_PORT') ?? 3000);
  const devLogin = readEnvironment('NODE_ENV') === 'development' && readEnvironment('DEV_AUTH_ENABLED') === 'true';
  await app.listen(port, devLogin ? '127.0.0.1' : '0.0.0.0');
  console.log(`Campus Opportunity API listening on http://localhost:${port}/api`);
}

void bootstrap();
