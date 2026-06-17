ALTER TABLE "Quote" ADD COLUMN "isTemplate" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Quote_isTemplate_idx" ON "Quote"("isTemplate");
