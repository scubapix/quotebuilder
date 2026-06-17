CREATE SEQUENCE IF NOT EXISTS "Quote_quoteNo_seq"
  AS integer
  START WITH 1001
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

SELECT setval(
  '"Quote_quoteNo_seq"',
  GREATEST(
    1000,
    COALESCE(
      MAX((substring("quoteNo" from '([0-9]+)$'))::integer),
      0
    )
  ),
  true
)
FROM "Quote"
WHERE "quoteNo" ~ '[0-9]+$';

CREATE UNIQUE INDEX IF NOT EXISTS "Quote_quoteNo_qt_unique_idx"
  ON "Quote"("quoteNo")
  WHERE "quoteNo" LIKE 'QT%';
