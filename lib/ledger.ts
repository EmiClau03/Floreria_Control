export type Movement={id:string;type:'income'|'expense';amount:number;date:string;description:string;category:string;payment:string;createdAt:string};
export const categories={income:['Ramos y arreglos','Plantas','Eventos','Otros ingresos'],expense:['Flores e insumos','Packaging','Alquiler','Servicios','Envíos','Otros egresos']};
export const payments=['Efectivo','Transferencia','Tarjeta'];
export function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export function dateValid(s:unknown):s is string {if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T12:00:00Z');return !isNaN(+d)&&d.toISOString().slice(0,10)===s;}
export function validate(m:Partial<Movement>){return !!m && (m.type==='income'||m.type==='expense')&&Number.isSafeInteger(m.amount)&&m.amount!>0&&m.amount!<=100000000000&&dateValid(m.date)&&typeof m.description==='string'&&m.description.trim().length>0&&m.description.length<=160&&categories[m.type].includes(m.category||'')&&payments.includes(m.payment||'');}
export function range(period:string,anchor:string):[string,string]{const d=new Date(anchor+'T12:00:00Z');const f=(x:Date)=>x.toISOString().slice(0,10);if(period==='day')return [anchor,anchor];if(period==='week'){const day=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-day);const a=f(d);d.setUTCDate(d.getUTCDate()+6);return [a,f(d)];}if(period==='year')return [anchor.slice(0,4)+'-01-01',anchor.slice(0,4)+'-12-31'];return [anchor.slice(0,7)+'-01',f(new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0,12)))];}
export function totals(rows:Movement[]){const income=rows.filter(r=>r.type==='income').reduce((s,r)=>s+r.amount,0);const expense=rows.filter(r=>r.type==='expense').reduce((s,r)=>s+r.amount,0);return {income,expense,balance:income-expense};}


export function inRange(rows:Movement[],start:string,end:string){return rows.filter(r=>r.date>=start&&r.date<=end);}
export function chartBuckets(rows:Movement[],start:string,end:string){
 const first=Date.parse(start+'T12:00:00Z'),days=Math.round((Date.parse(end+'T12:00:00Z')-first)/86400000)+1;
 if(!Number.isFinite(days)||days<1)return [];
 const step=Math.max(1,Math.ceil(days/31)),iso=(n:number)=>new Date(first+n*86400000).toISOString().slice(0,10);
 return Array.from({length:Math.ceil(days/step)},(_,i)=>{const a=iso(i*step),b=iso(Math.min(days-1,(i+1)*step-1));return {key:a,start:a,end:b,label:new Intl.DateTimeFormat('es-AR',{day:'numeric',month:'short'}).format(new Date(a+'T12:00:00Z')),...totals(inRange(rows,a,b))};});
}
