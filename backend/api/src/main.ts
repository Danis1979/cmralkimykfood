import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,OPTIONS',
    exposedHeaders: ['Content-Length', 'Last-Modified', 'Content-Disposition'],
  });
  
  // Garantiza Last-Modified en el CSV (sirve para GET y HEAD)
  app.use('/reports/stock.csv', (req, res, next) => {
    if (!res.getHeader('Last-Modified')) {
      res.setHeader('Last-Modified', new Date().toUTCString());
    }
    next();
  });
  app.enableCors({
  origin: [
    /^https?:\/\/localhost:3001$/,
    /^https?:\/\/alkimyk-front\.onrender\.com$/
  ],
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
