// Compare pg_dump object blocks without changing function/policy SQL semantics.
// ACL statements are single-line pg_dump statements; only their order is ignored.
export function schemaBlocks(sql){
 return sql.replaceAll('\r\n','\n').split(/\n--\n-- Name: /).slice(1).map(x=>({header:x.split('\n')[0],body:x.slice(x.indexOf('\n')+1)}));
}
export function blockMeaning(block){
 const lines=block.body.replaceAll('\r\n','\n').split('\n');
 // pg_dump emits these database-wide SETs at the first TABLE boundary. The
 // caller must compare their exact global values separately, not ignore them.
 // Only strip dump delimiters at the block's edges, never inside a function.
 const delimiter=x=>!x.trim()||x==='--'||x==='-- PostgreSQL database dump complete'||/^\\(?:un)?restrict\b/.test(x);
 while(lines.length&&delimiter(lines[0]))lines.shift();
 while(lines.length&&delimiter(lines.at(-1)))lines.pop();
 while(lines.length&&/^SET default_(?:tablespace|table_access_method) = /.test(lines.at(-1))){lines.pop();while(lines.length&&!lines.at(-1).trim())lines.pop()}
 const body=lines.join('\n').trim();
 if(/; Type: (?:ACL|DEFAULT ACL);/.test(block.header)){
  const statements=body.split('\n').filter(x=>x.trim());
  if(!statements.every(x=>/^(?:GRANT |REVOKE |ALTER DEFAULT PRIVILEGES )/.test(x)))throw new Error('unsupported-acl-serialization');
  return statements.sort().join('\n');
 }
 return body;
}
export function boundarySettings(sql){return sql.replaceAll('\r\n','\n').split('\n').filter(x=>/^SET default_(?:tablespace|table_access_method) = /.test(x)).sort()}
export function catalogRows(rows){
 return rows.map(({acl,...row})=>row).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b),'en'));
}
