// Generated test records only. Never derived from a real shoe collection.
export function seedTestCollection(runtime) {
  const owner='local-owner';
  if(runtime.db.prepare('SELECT owner FROM collection_settings WHERE owner=?').get(owner))return;
  const now='2020-01-01T00:00:00.000Z';
  const insert=runtime.db.prepare('INSERT INTO shoes (id,owner,shoe_id,data,revision,created_at,updated_at) VALUES (?,?,?,?,1,?,?)');
  for(let i=1;i<=14;i++){
    const data={shoeId:String(i),name:'Test pair '+i,category:'Other',brand:'',location:'',notes:'Synthetic test fixture',season:'All-season',storageStatus:'stored',reviewed:false,archived:false,seeded:true,shoeCrop:[0,0,64,64],boxCrop:[64,0,64,64],shoePhoto:null,boxPhoto:null};
    insert.run(crypto.randomUUID(),owner,data.shoeId,JSON.stringify(data),now,now);
  }
  runtime.db.prepare('INSERT INTO collection_settings (owner) VALUES (?)').run(owner);
}
