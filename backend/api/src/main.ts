import rateLimit from 'express-rate-limit';
import compression from 'compression';
import helmet from 'helmet';
import * as fs from 'fs';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ApiKeyGuard } from './common/api-key.guard';

async function bootstrap() {
  // HTTPS opcional (DEV): export HTTPS=true y poné localhost.key/.crt en el root del api
  const httpsEnabled = process.env.HTTPS === 'true';
  const hasKey = fs.existsSync('localhost.key');
  const hasCrt = fs.existsSync('localhost.crt');
  const httpsOptions =
    httpsEnabled && hasKey && hasCrt
      ? { key: fs.readFileSync('localhost.key'), cert: fs.readFileSync('localhost.crt') }
      : undefined;

  const app = await NestFactory.create(AppModule, httpsOptions ? { httpsOptions } : {});

  // Helmet relajado para DEV (inline scripts del dashboard y fetch locales)
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );
  app.use(compression());
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 1000 }));

  // CORS: localhost/127.0.0.1 http/https y file:// (abrir el HTML local)
  const allowOrigins = [
    /^(http|https):\/\/localhost(?::\d+)?$/i,
    /^(http|https):\/\/127\.0\.0\.1(?::\d+)?$/i,
  ];
  app.enableCors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // curl/Postman/file://
      if (allowOrigins.some((rx) => rx.test(origin))) return cb(null, true);
      return cb(null, false);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'x-api-key', 'authorization', 'accept'],
    exposedHeaders: ['Content-Disposition'],
    credentials: false,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Guard global de API Key (después de crear app)
  app.useGlobalGuards(new ApiKeyGuard());

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('CMR API')
    .setDescription('Compras, Ventas, Producción, Stock, Cheques, Tesorería')
    .setVersion('0.1.0')
    .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'apiKey')
    .addTag('Reports')
  .build();
  const doc = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, doc, { swaggerOptions: { persistAuthorization: true } });

  const port = Number(process.env.PORT || 3000);
  await app.listen(port);

  const proto = httpsOptions ? 'https' : 'http';
  console.log(`🚀 API running on ${proto}://localhost:${port}`);
}
bootstrap();
