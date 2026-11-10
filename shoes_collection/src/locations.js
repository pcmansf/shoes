import {validLocationIcon} from '../ui/location-icons.js';
const fail=(message,status=400)=>Object.assign(new Error(message),{status});

function checkedIcon(value){
  if(!validLocationIcon(value))throw fail('Choose an icon from the location icon picker.');
  return value;
}

export function locationDefinition(value){
  if(typeof value==='string')return {name:locationName(value)};
  if(!value||typeof value!=='object'||Array.isArray(value))throw fail('The backup location is invalid.');
  return {name:locationName(value.name),...(value.icon!==undefined?{icon:checkedIcon(value.icon)}:{})};
}

export function locationName(value){
  if(typeof value!=='string'||!value.trim())throw fail('Enter a location name.');
  const name=value.trim();
  if(name.length>120)throw fail('Use at most 120 characters for a location.');
  return name;
}

export function locationInserts(db,owner,values,overwrite=false){
  return values.filter(Boolean).map(value=>{
    const {name,icon}=locationDefinition(value);
    const conflict=overwrite&&icon!==undefined
      ? ' ON CONFLICT(owner,name) DO UPDATE SET icon=excluded.icon,revision=locations.revision+1 WHERE locations.icon<>excluded.icon'
      : ' ON CONFLICT(owner,name) DO NOTHING';
    return db.prepare('INSERT INTO locations (id,owner,name,icon,revision) VALUES (?,?,?,?,1)'+conflict)
      .bind(crypto.randomUUID(),owner,name,icon||'pin');
  });
}

// Additive migration: the original shoe JSON and photo references stay untouched.
export function migrateLocations(db){
  db.exec('BEGIN IMMEDIATE');
  try{
    if(!db.prepare('PRAGMA table_info(locations)').all().some(column=>column.name==='icon')){
      db.exec("ALTER TABLE locations ADD COLUMN icon TEXT NOT NULL DEFAULT 'pin'");
    }
    const insert=db.prepare('INSERT OR IGNORE INTO locations (id,owner,name,revision) VALUES (?,?,?,1)');
    for(const row of db.prepare('SELECT owner,data FROM shoes').all()){
      const name=JSON.parse(row.data).location?.trim();
      if(name)insert.run(crypto.randomUUID(),row.owner,name);
    }
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
}

export async function listLocations(db,owner){
  return (await db.prepare(`SELECT l.id,l.name,l.icon,l.revision,
    (SELECT COUNT(*) FROM shoes s WHERE s.owner=l.owner
      AND trim(json_extract(s.data,'$.location'))=l.name COLLATE NOCASE) AS count
    FROM locations l WHERE l.owner=? ORDER BY l.name COLLATE NOCASE`).bind(owner).all()).results;
}

export async function changeLocation(db,owner,id,input,method){
  if(method==='POST'){
    const name=locationName(input.name);
    const icon=checkedIcon(input.icon??'pin');
    await db.prepare('INSERT INTO locations (id,owner,name,icon,revision) VALUES (?,?,?,?,1)')
      .bind(crypto.randomUUID(),owner,name,icon).run();
    return {updates:[]};
  }
  const existing=await db.prepare('SELECT * FROM locations WHERE id=? AND owner=?').bind(id,owner).first();
  if(!existing)throw fail('Location not found. Reopen Locations to refresh the list.',404);
  if(input.revision!==existing.revision)throw fail('This location changed in another window. Reopen Locations and try again.',409);
  const refs="owner=? AND trim(json_extract(data,'$.location'))=? COLLATE NOCASE";
  if(method==='DELETE'){
    const result=await db.prepare(`DELETE FROM locations WHERE id=? AND owner=? AND revision=?
      AND NOT EXISTS (SELECT 1 FROM shoes WHERE ${refs})`)
      .bind(id,owner,input.revision,owner,existing.name).run();
    if(result.meta?.changes!==1)throw fail('This location is still in use or has changed. Move its pairs to another location before deleting it; archived pairs count too.',409);
    return {updates:[]};
  }
  const name=locationName(input.name??existing.name),icon=checkedIcon(input.icon??existing.icon);
  if(name===existing.name){
    if(icon===existing.icon)return {updates:[]};
    const result=await db.prepare('UPDATE locations SET icon=?,revision=revision+1 WHERE id=? AND owner=? AND revision=?')
      .bind(icon,id,owner,input.revision).run();
    if(result.meta?.changes!==1)throw fail('This location changed in another window. Reopen Locations and try again.',409);
    return {updates:[]};
  }
  const before=(await db.prepare(`SELECT id,revision FROM shoes WHERE ${refs}`).bind(owner,existing.name).all()).results;
  const now=new Date().toISOString();
  // Both statements share one transaction. A stale registry revision makes both no-ops.
  const results=await db.batch([
    db.prepare(`UPDATE shoes SET data=json_set(data,'$.location',?),revision=revision+1,updated_at=?
      WHERE ${refs} AND EXISTS (SELECT 1 FROM locations WHERE id=? AND owner=? AND revision=?)`)
      .bind(name,now,owner,existing.name,id,owner,input.revision),
    db.prepare('UPDATE locations SET name=?,icon=?,revision=revision+1 WHERE id=? AND owner=? AND revision=?')
      .bind(name,icon,id,owner,input.revision)
  ]);
  if(results[1].meta?.changes!==1)throw fail('This location changed in another window. Reopen Locations and try again.',409);
  return {renamed:{from:existing.name,to:name},updates:before.map(row=>({id:row.id,previousRevision:row.revision}))};
}
