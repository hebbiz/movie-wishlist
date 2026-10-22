// Offline restore reconciliation only. The original inventory remains baseline.
// Fail closed unless both captured source ACLs have this reviewed exact shape.
import {normalizeAcl} from './recovery-local.mjs';
export function graphqlAclSupplement(inventory){
 const expected='{supabase_admin=UC/supabase_admin,postgres=U*/supabase_admin,anon=U/supabase_admin,authenticated=U/supabase_admin,service_role=U/supabase_admin}';
 let sql='BEGIN;\nSET LOCAL ROLE supabase_admin;\n';
 for(const name of ['graphql','graphql_public']){
  const source=inventory.schemas.filter(x=>x.nspname===name);
  if(source.length!==1||source[0].owner!=='supabase_admin'||JSON.stringify(normalizeAcl(source[0].acl))!==JSON.stringify(normalizeAcl(expected)))throw new Error('unreviewed-source-schema-acl');
  // Never replace a non-default, independently configured target ACL blindly.
  sql+=`DO $check$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='${name}' AND nspowner='supabase_admin'::regrole AND (nspacl IS NULL OR NOT EXISTS ((SELECT * FROM aclexplode(nspacl) EXCEPT ALL SELECT * FROM aclexplode('${expected}'::aclitem[])) UNION ALL (SELECT * FROM aclexplode('${expected}'::aclitem[]) EXCEPT ALL SELECT * FROM aclexplode(nspacl))))) THEN RAISE EXCEPTION 'unreviewed-target-schema-acl'; END IF; END $check$;\n`;
  sql+=`GRANT USAGE ON SCHEMA ${name} TO postgres WITH GRANT OPTION;\nGRANT USAGE ON SCHEMA ${name} TO anon,authenticated,service_role;\n`;
 }
 return sql+'COMMIT;\n';
}
