// Copies the game into www/ for GitHub Pages and Capacitor.
// The cache name in sw.js is stamped with a hash of every shipped file, so any
// change produces a new service worker and players get the update.
import {createHash} from 'node:crypto';
import {cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {dirname, join, relative, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const out=join(root,'www');
const entries=['index.html','manifest.webmanifest','src','styles','icons'];

rmSync(out,{recursive:true,force:true});
mkdirSync(out);
for(const entry of entries)cpSync(join(root,entry),join(out,entry),{recursive:true});

const files=[];
(function walk(dir){for(const name of readdirSync(dir).sort()){const path=join(dir,name);if(statSync(path).isDirectory())walk(path);else files.push(path);}})(out);

const hash=createHash('sha256');
for(const file of files)hash.update(relative(out,file)).update(readFileSync(file));
const version=JSON.parse(readFileSync(join(root,'package.json'),'utf8')).version;
const assets=['./',...files.map(file=>'./'+relative(out,file).split(sep).join('/'))];

const sw=readFileSync(join(root,'sw.js'),'utf8')
  .replace('__CACHE_NAME__',`wildland-${version}-${hash.digest('hex').slice(0,10)}`)
  .replace('__ASSETS__',JSON.stringify(assets));
writeFileSync(join(out,'sw.js'),sw);

console.log(`www/ ready: ${files.length+1} files`);
