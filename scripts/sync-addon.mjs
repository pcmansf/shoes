import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dest=path.join(root,'shoes_collection');
const check=process.argv.includes('--check');
const files=['server.mjs','run.mjs','LUCIDE-LICENSE.txt'];
// Explicit source allowlist: never copy a working collection or a backup into the image.
for(const folder of ['src','ui','drizzle'])for(const entry of await readdir(path.join(root,folder),{withFileTypes:true})){
  if(entry.isFile()&&(/\.(js|html|css|sql)$/.test(entry.name)||entry.name==='drive-config.example.json'))files.push(folder+'/'+entry.name);
}
async function output(relative,bytes){
  const target=path.join(dest,relative);
  if(check){if(!bytes.equals(await readFile(target)))throw new Error('Add-on is out of date: '+relative);}
  else{await mkdir(path.dirname(target),{recursive:true});await writeFile(target,bytes);}
}
for(const file of files)await output(file,await readFile(path.join(root,file)));
const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
await output('package.json',Buffer.from(JSON.stringify({name:pkg.name,version:pkg.version,private:true,type:'module',engines:pkg.engines,scripts:{start:'node run.mjs'}},null,2)+'\n'));
console.log(check?'PASS: add-on runtime matches the canonical source.':'Prepared add-on runtime from source allowlist.');
