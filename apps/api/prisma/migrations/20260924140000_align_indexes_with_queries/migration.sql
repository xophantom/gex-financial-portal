-- A lista filtra por solicitante e ordena por vencimento; o índice por
-- created_at não atendia a nenhuma consulta.
DROP INDEX "requests_requester_id_created_at_idx";
CREATE INDEX "requests_requester_id_due_date_idx" ON "requests"("requester_id", "due_date");
