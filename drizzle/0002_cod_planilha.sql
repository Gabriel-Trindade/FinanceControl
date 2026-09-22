ALTER TABLE "lancamentos" ADD COLUMN "cod_planilha" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "lancamentos_cod_planilha_unico" ON "lancamentos" USING btree ("cod_planilha");--> statement-breakpoint
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_cod_planilha_positivo" CHECK ("lancamentos"."cod_planilha" >= 1);