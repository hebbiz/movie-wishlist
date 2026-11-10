\set ON_ERROR_STOP on
-- Local restored DB only. No row values or names are printed.
-- Non-NULL foreign keys are checked independently of their validation flag.
DO $test$
DECLARE k record; predicates text; nonnull text; total bigint;
BEGIN
 FOR k IN SELECT * FROM pg_constraint WHERE contype='f' LOOP
  SELECT string_agg(format('c.%I = p.%I',ca.attname,pa.attname),' AND ' ORDER BY z.ord),
         string_agg(format('c.%I IS NOT NULL',ca.attname),' AND ' ORDER BY z.ord)
   INTO predicates,nonnull
   FROM unnest(k.conkey,k.confkey) WITH ORDINALITY AS z(c,p,ord)
   JOIN pg_attribute ca ON ca.attrelid=k.conrelid AND ca.attnum=z.c
   JOIN pg_attribute pa ON pa.attrelid=k.confrelid AND pa.attnum=z.p;
  EXECUTE format('SELECT count(*) FROM %s c WHERE %s AND NOT EXISTS (SELECT 1 FROM %s p WHERE %s)',k.conrelid::regclass,nonnull,k.confrelid::regclass,predicates) INTO total;
  IF total<>0 THEN RAISE EXCEPTION 'RESTORED_FK_ORPHANS'; END IF;
 END LOOP;
END $test$;
