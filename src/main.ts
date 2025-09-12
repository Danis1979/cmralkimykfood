import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.enableCors({
  origin: [
    'http://localhost:3001',
    'https://alkimyk-front.onrender.com'
  ],
  credentials: true,
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  allowedHeaders: 'Content-Type,Authorization',
  exposedHeaders: 'Content-Disposition',
});
const port = Number(process.env.PORT||3000);
  app.enableCors({
    origin: [
      /http:\/\/localhost:\d+$/,           // dev local (3000, 3001, etc.)
      /\.onrender\.com$/                   // front en Render
    ],
    credentials: true,                     // si vas a usar cookies; si no, puede ser false
    methods: ['GET','HEAD','PUT','PATCH','POST','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization'],
    exposedHeaders: ['Content-Disposition'],
  });
  await app.listen(port, '0.0.0.0');
}
bootstrap();
