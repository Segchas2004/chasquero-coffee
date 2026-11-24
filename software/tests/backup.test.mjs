import test from 'node:test';import assert from 'node:assert/strict';import path from 'node:path';
import {mkdirSync,writeFileSync,mkdtempSync,rmSync,utimesSync} from 'node:fs';
import {checkedBackupPaths,findLocalBackup,newBackupDirectory,validBackup} from '../scripts/backup-io.mjs';
test('La copia rechaza la raíz y destinos fuera del proyecto antes de escribir',()=>{
 const root=path.resolve('backup-test-workspace');for(const target of ['.','..',path.resolve(root,'../otro-proyecto')])assert.throws(()=>checkedBackupPaths(root,target),/subcarpeta/);
 assert.equal(checkedBackupPaths(root,'backups/copia').target,path.join(root,'backups','copia'));
});
function fixture(fn){
 const parent=path.resolve('tests'),folder=mkdtempSync(path.join(parent,'.backup-fixture-'));
 try{fn(folder);}finally{assert.equal(path.dirname(folder),parent);assert.ok(path.basename(folder).startsWith('.backup-fixture-'));rmSync(folder,{recursive:true,force:true});}
}
function complete(folder){
 mkdirSync(path.join(folder,'auth_export'),{recursive:true});mkdirSync(path.join(folder,'firestore_export'),{recursive:true});writeFileSync(path.join(folder,'auth_export/accounts.json'),'{"users":[]}');writeFileSync(path.join(folder,'auth_export/config.json'),'{}');writeFileSync(path.join(folder,'firestore_export/data.metadata'),'export');
 writeFileSync(path.join(folder,'firebase-export-metadata.json'),JSON.stringify({auth:{path:'auth_export'},firestore:{metadata_file:'firestore_export/data.metadata'}}));
}
test('La copia más reciente se restaura sin mover la anterior y omite exportaciones incompletas',()=>fixture(root=>{
 const target=path.join(root,'.emulator-data');complete(target);const olderMeta=path.join(target,'firebase-export-metadata.json');utimesSync(olderMeta,new Date(0),new Date(0));const fresh=newBackupDirectory(target);complete(fresh);const broken=newBackupDirectory(target);mkdirSync(broken,{recursive:true});writeFileSync(path.join(broken,'firebase-export-metadata.json'),'{');
 assert.equal(findLocalBackup(target),fresh);assert.equal(validBackup(target),true);assert.equal(validBackup(broken),false);
}));
test('Los formatos anteriores se conservan y una ruta manipulada no se importa',()=>fixture(root=>{
 const target=path.join(root,'.emulator-data');complete(target);assert.equal(findLocalBackup(target),target);writeFileSync(path.join(target,'firebase-export-metadata.json'),JSON.stringify({auth:{path:'../outside'},firestore:{metadata_file:'../outside'}}));assert.equal(findLocalBackup(target),null);
}));
