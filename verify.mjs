import assert from 'node:assert/strict';
import {range,totals,validate} from './lib/ledger.ts';
assert.deepEqual(range('week','2026-01-01'),['2025-12-29','2026-01-04']);
assert.deepEqual(range('month','2024-02-15'),['2024-02-01','2024-02-29']);
assert.deepEqual(range('month','2026-02-15'),['2026-02-01','2026-02-28']);
assert.deepEqual(totals([{type:'income',amount:1010},{type:'expense',amount:999}]),{income:1010,expense:999,balance:11});
assert.equal(validate({type:'income',amount:1,date:'2026-10-13',description:'Ramo',category:'Ramos y arreglos',payment:'Efectivo'}),true);
assert.equal(validate({type:'income',amount:1,date:'2026-02-30',description:'Ramo',category:'Ramos y arreglos',payment:'Efectivo'}),false);
assert.equal(validate({type:'income',amount:-1,date:'2026-10-13',description:'Ramo',category:'Ramos y arreglos',payment:'Efectivo'}),false);
console.log('PASS: semanas entre años, febrero bisiesto, centavos, fecha y monto inválidos.');
const root='http://127.0.0.1:5173';
assert.equal((await fetch(root)).status,200);
assert.equal((await fetch(root+'/api/movements')).status,401);
const headers={'Content-Type':'application/json','Cookie':'__sites_local_auth=1','Origin':root};
const entry={type:'income',amount:125050,date:'2026-10-13',description:'PRUEBA LOCAL',category:'Ramos y arreglos',payment:'Efectivo'};
let r=await fetch(root+'/api/movements',{method:'POST',headers,body:JSON.stringify(entry)});
assert.equal(r.status,201);const saved=await r.json();
try{
r=await fetch(root+'/api/movements',{headers});assert((await r.json()).some(x=>x.id===saved.id));
r=await fetch(root+'/api/movements',{method:'PUT',headers,body:JSON.stringify({...saved,amount:150025})});assert.equal(r.status,200);assert.equal((await r.json()).amount,150025);
r=await fetch(root+'/api/movements',{method:'POST',headers,body:JSON.stringify({...entry,amount:0})});assert.equal(r.status,400);
r=await fetch(root+'/api/movements',{method:'POST',headers:{...headers,Origin:'https://invalid.example'},body:JSON.stringify(entry)});assert([401,403].includes(r.status));
}finally{r=await fetch(root+'/api/movements',{method:'DELETE',headers,body:JSON.stringify({id:saved.id})});assert.equal(r.status,200);}
r=await fetch(root+'/api/movements',{headers});assert(!(await r.json()).some(x=>x.id===saved.id));
console.log('PASS: HTTP, autenticación, crear, leer, editar, validación, origen y eliminar.');

