import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import * as express from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set in environment');
  }

  // bodyParser: false because NestFactory.create() would otherwise register
  // its own express.json()/urlencoded() with the 100kb default FIRST, and
  // that copy — not the higher-limit one below — is what actually parses
  // every request. Needed for the website admin's image/PDF uploads, which
  // arrive as base64 data URLs in the request body (same no-file-storage
  // pattern Settings already uses for the store QR image) — images are
  // resized client-side first, but PDFs and several images together can
  // still add up.
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  app.use(helmet());
  app.use(cookieParser());
  app.use(express.json({ limit: '30mb' }));
  app.use(express.urlencoded({ limit: '30mb', extended: true }));
  app.setGlobalPrefix('api/v1');
  const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) cb(null, true);
      else cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT || 4000);
}

bootstrap();
