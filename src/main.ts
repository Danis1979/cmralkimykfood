import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: (origin, cb) => {
      const allow = [
        /^https?:\/\/localhost:3001$/,
        /^https?:\/\/alkimyk-front\.onrender\.com$/,
      ];
      if (!origin) return cb(null, true); // curl / mismo origen, etc.
      cb(allow.some(rx => rx.test(origin)) ? null : new Error('Not allowed by CORS'), true);
    },
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization',
    exposedHeaders: 'Content-Disposition',
    optionsSuccessStatus: 204,
  });

  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true }));

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
