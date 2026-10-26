import {mkdir,copyFile,cp,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const from=(p)=>path.join(root,'node_modules','three',p);
const to=(p)=>path.join(root,'vendor','three',p);
async function copy(src,dest){await mkdir(path.dirname(dest),{recursive:true});await copyFile(src,dest);}
try{await access(from('build/three.module.js'));}catch{console.error('Missing three package. Run npm install first.');process.exit(2);}
await copy(from('build/three.module.js'),to('three.module.js'));
await copy(from('build/three.core.js'),to('three.core.js'));
for(const p of ['controls/OrbitControls.js','loaders/GLTFLoader.js','loaders/DRACOLoader.js']) {
  await copy(from('examples/jsm/'+p),to('addons/'+p));
}
await cp(from('examples/jsm/libs/draco'),to('draco'),{recursive:true,force:true});
console.log('Vendored Three.js + GLTF/Draco/OpenXR runtime.');
