\set ON_ERROR_STOP on
\set QUIET on
-- Isolated restored target only. No application rows, function bodies or passwords.
-- These observations cannot reconstruct uncaptured source function/initial ACLs.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '30s';
WITH scoped_schemas AS (
 SELECT oid,nspname,nspowner,nspacl
 FROM pg_namespace WHERE nspname IN ('graphql','graphql_public','extensions')
), scoped_functions AS (
 SELECT p.oid,p.pronamespace,p.proname,p.proowner,p.proacl,p.prokind
 FROM pg_proc p JOIN scoped_schemas n ON n.oid=p.pronamespace
), scoped_relations AS (
 SELECT c.oid,c.relnamespace,c.relname,c.relowner,c.relacl,c.relkind
 FROM pg_class c JOIN scoped_schemas n ON n.oid=c.relnamespace
 WHERE c.relkind IN ('r','p','v','m','f','S')
), checked_roles AS (
 SELECT oid,rolname FROM pg_roles
 WHERE rolname IN ('postgres','anon','authenticated','service_role','supabase_admin',
                  'authenticator','supabase_auth_admin','supabase_storage_admin')
), scoped_objects AS (
 SELECT 'pg_namespace'::regclass::oid AS classid,oid AS objid,
        format('SCHEMA %I',nspname) AS identity FROM scoped_schemas
 UNION ALL
 SELECT 'pg_proc'::regclass::oid,p.oid,
        format('FUNCTION %I.%I(%s)',n.nspname,p.proname,pg_get_function_identity_arguments(p.oid))
 FROM scoped_functions p JOIN scoped_schemas n ON n.oid=p.pronamespace
 UNION ALL
 SELECT 'pg_class'::regclass::oid,c.oid,
        format('RELATION %I.%I',n.nspname,c.relname)
 FROM scoped_relations c JOIN scoped_schemas n ON n.oid=c.relnamespace
)
SELECT json_build_object(
 'kind','isolated-target-privilege-observations',
 'sourceFunctionColumnInitialAclCaptured',false,
 'proceduralOrDynamicDependencyCoverageComplete',false,
 'zeroRegisteredDependenciesProvesUnused',false,
 'serverVersion',current_setting('server_version_num'),
 'readOnly',current_setting('transaction_read_only')='on',
 'schemas',COALESCE((SELECT json_agg(x ORDER BY name) FROM (
  SELECT n.nspname AS name,pg_get_userbyid(n.nspowner) AS owner,n.nspacl::text AS raw_acl,
   (SELECT json_agg(json_build_object(
     'grantor',pg_get_userbyid(a.grantor),
     'grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
     'privilege',a.privilege_type,'grantable',a.is_grantable)
     ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable)
    FROM aclexplode(COALESCE(n.nspacl,acldefault('n',n.nspowner))) a) AS expanded_acl,
   (SELECT json_agg(json_build_object('role',r.rolname,
     'usage',has_schema_privilege(r.oid,n.oid,'USAGE'),
     'create',has_schema_privilege(r.oid,n.oid,'CREATE')) ORDER BY r.rolname)
    FROM checked_roles r) AS role_privileges
  FROM scoped_schemas n
 ) x),'[]'::json),
 'functions',COALESCE((SELECT json_agg(x ORDER BY schema,name,arguments) FROM (
  SELECT n.nspname AS schema,p.proname AS name,
   pg_get_function_identity_arguments(p.oid) AS arguments,p.prokind::text AS kind,
   pg_get_userbyid(p.proowner) AS owner,p.proacl::text AS raw_acl,
   (SELECT json_agg(json_build_object(
     'grantor',pg_get_userbyid(a.grantor),
     'grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
     'privilege',a.privilege_type,'grantable',a.is_grantable)
     ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable)
    FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a) AS expanded_acl,
   (SELECT json_agg(json_build_object('role',r.rolname,
     'execute',has_function_privilege(r.oid,p.oid,'EXECUTE')) ORDER BY r.rolname)
    FROM checked_roles r) AS role_privileges
  FROM scoped_functions p JOIN scoped_schemas n ON n.oid=p.pronamespace
 ) x),'[]'::json),
 'relations',COALESCE((SELECT json_agg(x ORDER BY schema,name) FROM (
  SELECT n.nspname AS schema,c.relname AS name,c.relkind::text AS kind,
   pg_get_userbyid(c.relowner) AS owner,c.relacl::text AS raw_acl,
   (SELECT json_agg(json_build_object(
     'grantor',pg_get_userbyid(a.grantor),
     'grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
     'privilege',a.privilege_type,'grantable',a.is_grantable)
     ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable)
    FROM aclexplode(COALESCE(c.relacl,
      acldefault(CASE WHEN c.relkind='S' THEN 'S'::"char" ELSE 'r'::"char" END,c.relowner))) a
   ) AS expanded_acl,
   (SELECT json_agg(json_build_object('role',r.rolname,
     'select',CASE WHEN c.relkind='S' THEN has_sequence_privilege(r.oid,c.oid,'SELECT')
                   ELSE has_table_privilege(r.oid,c.oid,'SELECT') END,
     'usage',CASE WHEN c.relkind='S' THEN has_sequence_privilege(r.oid,c.oid,'USAGE') ELSE NULL END,
     'update',CASE WHEN c.relkind='S' THEN has_sequence_privilege(r.oid,c.oid,'UPDATE')
                   ELSE has_table_privilege(r.oid,c.oid,'UPDATE') END,
     'insert',CASE WHEN c.relkind='S' THEN NULL ELSE has_table_privilege(r.oid,c.oid,'INSERT') END,
     'delete',CASE WHEN c.relkind='S' THEN NULL ELSE has_table_privilege(r.oid,c.oid,'DELETE') END,
     'truncate',CASE WHEN c.relkind='S' THEN NULL ELSE has_table_privilege(r.oid,c.oid,'TRUNCATE') END,
     'references',CASE WHEN c.relkind='S' THEN NULL ELSE has_table_privilege(r.oid,c.oid,'REFERENCES') END,
     'trigger',CASE WHEN c.relkind='S' THEN NULL ELSE has_table_privilege(r.oid,c.oid,'TRIGGER') END
    ) ORDER BY r.rolname) FROM checked_roles r) AS role_privileges
  FROM scoped_relations c JOIN scoped_schemas n ON n.oid=c.relnamespace
 ) x),'[]'::json),
 'extension_dependencies',COALESCE((SELECT json_agg(x ORDER BY identity,extension) FROM (
  SELECT s.identity,e.extname AS extension,e.extversion AS version,d.deptype::text AS dependency_type
  FROM scoped_objects s JOIN pg_depend d ON d.classid=s.classid AND d.objid=s.objid
   AND d.objsubid=0 AND d.refclassid='pg_extension'::regclass AND d.deptype='e'
  JOIN pg_extension e ON e.oid=d.refobjid
 ) x),'[]'::json),
 'registered_inbound_dependencies',COALESCE((SELECT json_agg(x
  ORDER BY referenced_identity,referenced_subobject,dependent_class,dependent_identity,dependency_type) FROM (
  SELECT s.identity AS referenced_identity,d.refobjsubid AS referenced_subobject,
   d.classid::regclass::text AS dependent_class,
   pg_describe_object(d.classid,d.objid,d.objsubid) AS dependent_identity,
   d.deptype::text AS dependency_type
  FROM scoped_objects s JOIN pg_depend d ON d.refclassid=s.classid AND d.refobjid=s.objid
 ) x),'[]'::json),
 'initial_privileges',COALESCE((SELECT json_agg(x ORDER BY identity,subobject,privilege_kind) FROM (
  SELECT s.identity,i.objsubid AS subobject,i.privtype::text AS privilege_kind,i.initprivs::text AS raw_acl
  FROM scoped_objects s JOIN pg_init_privs i ON i.classoid=s.classid AND i.objoid=s.objid
 ) x),'[]'::json),
 'default_acls',COALESCE((SELECT json_agg(x ORDER BY owner,schema,object_kind) FROM (
  SELECT pg_get_userbyid(a.defaclrole) AS owner,
   CASE WHEN a.defaclnamespace=0 THEN NULL ELSE n.nspname END AS schema,
   a.defaclobjtype::text AS object_kind,a.defaclacl::text AS raw_acl
  FROM pg_default_acl a LEFT JOIN pg_namespace n ON n.oid=a.defaclnamespace
 ) x),'[]'::json),
 'roles',COALESCE((SELECT json_agg(x ORDER BY name) FROM (
  SELECT rolname AS name,rolsuper AS superuser,rolinherit AS inherit,rolcreaterole AS create_role,
   rolcreatedb AS create_database,rolcanlogin AS login,rolreplication AS replication,
   rolbypassrls AS bypass_rls,rolname='mw_restore_bootstrap' AS local_bootstrap
  FROM pg_roles
 ) x),'[]'::json),
 'role_memberships',COALESCE((SELECT json_agg(x ORDER BY role,member,grantor) FROM (
  SELECT pg_get_userbyid(m.roleid) AS role,pg_get_userbyid(m.member) AS member,
   pg_get_userbyid(m.grantor) AS grantor,m.admin_option,m.inherit_option,m.set_option
  FROM pg_auth_members m
 ) x),'[]'::json)
);
ROLLBACK;
