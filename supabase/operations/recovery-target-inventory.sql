\set ON_ERROR_STOP on
SELECT json_build_object(
 'schemas',(SELECT json_agg(x ORDER BY nspname) FROM (
 SELECT nspname,pg_get_userbyid(nspowner) AS owner,nspacl::text AS acl FROM pg_namespace
 WHERE nspname NOT LIKE 'pg_%' AND nspname<>'information_schema') x),
 'extensions',(SELECT json_agg(x ORDER BY extname) FROM (
 SELECT extname,extversion,extnamespace::regnamespace::text AS schema FROM pg_extension) x),
 'tables',(SELECT json_agg(x ORDER BY schema,name) FROM (
 SELECT n.nspname AS schema,c.relname AS name,c.relkind,c.relrowsecurity,c.relforcerowsecurity,
 pg_get_userbyid(c.relowner) AS owner,c.relacl::text AS acl,e.extname AS extension
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 LEFT JOIN pg_depend d ON d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='e'
 LEFT JOIN pg_extension e ON e.oid=d.refobjid
 WHERE c.relkind IN ('r','p') AND n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema') x),
 'constraints',(SELECT json_agg(x ORDER BY schema,table_name,conname) FROM (
 SELECT n.nspname AS schema,c.relname AS table_name,x.conname,x.contype,x.convalidated,pg_get_constraintdef(x.oid,true) AS definition
 FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema') x)
);
