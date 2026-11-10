// Compare logical grants/grantors/options natively; NULL is acldefault(), not [].
const literal=x=>"'"+x.replaceAll("'","''")+"'";
const ident=x=>'"'+x.replaceAll('"','""')+'"';
export function nativeAclChecks(inventory){
 let sql="\\set ON_ERROR_STOP on\nSET standard_conforming_strings=on;\nSET default_transaction_read_only=on;\n";
 function expected(row,type){return row.acl===null?`acldefault('${type}',${literal(ident(row.owner))}::regrole::oid)`:literal(row.acl)+'::aclitem[]'}
 function equal(a,b){return `NOT EXISTS ((SELECT * FROM aclexplode(${a}) EXCEPT ALL SELECT * FROM aclexplode(${b})) UNION ALL (SELECT * FROM aclexplode(${b}) EXCEPT ALL SELECT * FROM aclexplode(${a})))`}
 for(const s of inventory.schemas){
  sql+=`SELECT json_build_object('scope','schemas','key',json_build_array(n.nspname),'matched',${equal(expected(s,'n'),"COALESCE(n.nspacl,acldefault('n',n.nspowner))")}) FROM pg_namespace n WHERE n.nspname=${literal(s.nspname)};\n`;
 }
 for(const t of inventory.tables){
  sql+=`SELECT json_build_object('scope','tables','key',json_build_array(n.nspname,c.relname),'matched',${equal(expected(t,'r'),"COALESCE(c.relacl,acldefault('r',c.relowner))")}) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=${literal(t.schema)} AND c.relname=${literal(t.name)} AND c.relkind IN ('r','p');\n`;
 }
 return sql;
}
