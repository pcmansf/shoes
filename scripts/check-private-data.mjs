import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const files=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
const forbidden=/(^|\/)(data|photos|uploads|backups)\/|\.(sqlite|db)(-|$)|(^|\/)(options|google-drive)\.json$|(^|\/)shoes-backup[^/]*\.json$|(^|\/)\.env(?:\.|$)|\.(zip|tar|gz|jpg|jpeg|png|webp|gif|heic|mp4|mov|pem|key)$/i;
const bad=[];
for(const file of files){
  if(forbidden.test(file)){bad.push(file);continue;}
  const text=await readFile(path.join(root,file),'utf8');
  // Large embedded images also occur in exported JSON. Tiny synthetic test PNGs are allowed.
  if(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]{2048}/.test(text)||/https:\/\/chatgpt\.com\/api\/library\/files\//.test(text))bad.push(file);
}
if(bad.length)throw new Error('Private-data check failed for tracked paths: '+bad.join(', '));
console.log('PASS: no tracked collection data, photos, private configuration, archives, or private collage links.');
