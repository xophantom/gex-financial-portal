-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PAID');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('REQUESTER', 'FINANCE');

-- CreateEnum
CREATE TYPE "RequestCategory" AS ENUM ('SOFTWARE', 'SERVIÇOS', 'MARKETING', 'INFRAESTRUTURA');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requests" (
    "id" UUID NOT NULL,
    "requester_id" UUID NOT NULL,
    "supplier_name" TEXT NOT NULL,
    "supplier_cnpj" CHAR(14) NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "competence" CHAR(7) NOT NULL,
    "due_date" DATE NOT NULL,
    "category" "RequestCategory" NOT NULL,
    "description" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "rejection_reason" TEXT,
    "paid_at" TIMESTAMPTZ(3),
    "payment_reference" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_status_events" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "previous_status" "RequestStatus",
    "new_status" "RequestStatus" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "requests_status_due_date_idx" ON "requests"("status", "due_date");

-- CreateIndex
CREATE INDEX "requests_requester_id_created_at_idx" ON "requests"("requester_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "requests_cnpj_invoice_unique" ON "requests"("supplier_cnpj", "invoice_number");

-- CreateIndex
CREATE INDEX "request_status_events_request_id_created_at_idx" ON "request_status_events"("request_id", "created_at");

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_status_events" ADD CONSTRAINT "request_status_events_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_status_events" ADD CONSTRAINT "request_status_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE "requests"
  ADD CONSTRAINT "requests_amount_positive" CHECK ("amount_cents" > 0),
  ADD CONSTRAINT "requests_competence_format"
    CHECK ("competence" ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  ADD CONSTRAINT "requests_rejected_needs_reason"
    CHECK ("status" <> 'REJECTED' OR "rejection_reason" IS NOT NULL),
  ADD CONSTRAINT "requests_paid_needs_payment"
    CHECK ("status" <> 'PAID'
           OR ("paid_at" IS NOT NULL AND "payment_reference" IS NOT NULL));

CREATE INDEX "requests_paid_at_idx" ON "requests" ("paid_at") WHERE "status" = 'PAID';

CREATE INDEX "requests_supplier_name_trgm_idx"
  ON "requests" USING GIN ("supplier_name" gin_trgm_ops);
