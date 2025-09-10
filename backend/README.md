# Backend (estructura) — NestJS + Prisma + PostgreSQL
> **Nota:** Esta carpeta contiene **estructura y documentación**, no implementación. La idea es completar los módulos según los contratos de `/docs`.

## Estructura sugerida
- `src/modules/*`: módulos de dominio (orders, sales, deliveries, etc.).
- `prisma/schema.prisma`: modelos a definir según `/docs/DataModel.md`.
- `docker-compose.yml`: Postgres listo para usar.
- `.env.example`: plantilla de variables.

## Tech Stack recomendado
- Node 20+, TypeScript, NestJS, Prisma ORM.
- PostgreSQL gestionado (Render/Supabase) o local vía Docker.
- Autenticación con Firebase Auth (verificación de token en el backend).

## Próximos pasos
1. Definir `schema.prisma` a partir de `/docs/DataModel.md`.
2. Inicializar NestJS y Prisma.
3. Implementar endpoints de `/docs/API-v1.md` por módulos.
