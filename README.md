# CMR Alkimyk — Estructura Base (solo carpetas y documentación)
Este zip contiene **estructura** (sin implementación) para un CMR/CRM con:
- **Backend** (NestJS + Prisma + PostgreSQL) — aún sin código de negocio.
- **Frontend** (Vanilla JS + Tailwind) — placeholders.
- **Docs** (contratos de API, estados, modelo de datos, roadmap).
- **Infra**: `docker-compose.yml` y `.env.example` para Postgres.

> Objetivo: abrir el proyecto, revisar la **planificación** y completar los módulos paso a paso.

## Cómo usar
1. Descomprimir este zip.
2. Crear `.env` copiando desde `.env.example` y ajustar `DATABASE_URL` si hace falta.
3. (Opcional) Levantar Postgres local:
   ```bash
   docker compose up -d
   ```
4. Leer `/docs/API-v1.md` y `/docs/DataModel.md` para implementar los módulos por fases.

> Esta estructura **no trae código ejecutable**, solo base documental y carpetas listas para empezar.
