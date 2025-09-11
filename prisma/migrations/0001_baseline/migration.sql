-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."alembic_version" (
    "version_num" VARCHAR(32) NOT NULL,

    CONSTRAINT "alembic_version_pkc" PRIMARY KEY ("version_num")
);

-- CreateTable
CREATE TABLE "public"."compras" (
    "id" SERIAL NOT NULL,
    "usuario_email" VARCHAR(100) NOT NULL,
    "ingrediente" VARCHAR(100) NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "proveedor" VARCHAR(100) NOT NULL,
    "forma_pago" VARCHAR(50) NOT NULL,
    "fecha_pago" DATE NOT NULL,

    CONSTRAINT "compras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."costos_fijos" (
    "id" SERIAL NOT NULL,
    "usuario_email" VARCHAR(100) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "costos_fijos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."precios_ingredientes" (
    "id" SERIAL NOT NULL,
    "usuario_email" VARCHAR(100) NOT NULL,
    "ingrediente" VARCHAR(100) NOT NULL,
    "precio_unitario" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "precios_ingredientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."precios_venta_sabor" (
    "id" SERIAL NOT NULL,
    "usuario_email" VARCHAR(100) NOT NULL,
    "sabor" VARCHAR(100) NOT NULL,
    "precio" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "precios_venta_sabor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."produccion" (
    "id" SERIAL NOT NULL,
    "usuario_email" VARCHAR(100) NOT NULL,
    "fecha" TIMESTAMP(6),
    "sabor" VARCHAR(50) NOT NULL,
    "canastos" INTEGER NOT NULL,

    CONSTRAINT "produccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."produccion_diaria" (
    "id" SERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "sabor" VARCHAR(100) NOT NULL,
    "cantidad_canastos" INTEGER NOT NULL,

    CONSTRAINT "produccion_diaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."proveedores" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,

    CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."resumen_historico" (
    "id" SERIAL NOT NULL,
    "usuario_email" VARCHAR(100) NOT NULL,
    "fecha" TIMESTAMP(6),
    "total_canastos" INTEGER,
    "total_cajas" INTEGER,
    "total_facturar" DOUBLE PRECISION,
    "total_con_iva" DOUBLE PRECISION,
    "ganancia_total" DOUBLE PRECISION,
    "rentabilidad" DOUBLE PRECISION,

    CONSTRAINT "resumen_historico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."usuarios" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "password" VARCHAR(200) NOT NULL,
    "rol" VARCHAR(50) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ventas" (
    "id" SERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "tipo_comprobante" VARCHAR(20) NOT NULL,
    "numero" VARCHAR(50) NOT NULL,
    "cliente" VARCHAR(100) NOT NULL,
    "importe_bruto" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ventas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "public"."usuarios"("email" ASC);

