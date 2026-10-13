import {getChatGPTUser} from '../../chatgpt-auth';
import {getDb} from '../../../db';
import {movements} from '../../../db/schema';
import {desc,eq} from 'drizzle-orm';
import {validate, Movement} from '../../../lib/ledger';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function permitted(request:Request,write=false){if(!await getChatGPTUser())return false;if(write&&request.headers.get('origin')!==new URL(request.url).origin)return false;return true;}
export async function GET(request:Request){if(!await permitted(request))return json({error:'Iniciá sesión para ver las cuentas.'},401);try{return json(await getDb().select().from(movements).orderBy(desc(movements.date),desc(movements.createdAt)));}catch{return json({error:'No pudimos cargar los movimientos. Intentá nuevamente.'},500);}}
async function save(request:Request,edit:boolean){if(!await permitted(request,true))return json({error:'Tu sesión no está disponible. Volvé a iniciar sesión.'},401);try{const m=await request.json() as Movement;if(!validate(m))return json({error:'Revisá el monto, la fecha y los datos del movimiento.'},400);const data={type:m.type,amount:m.amount,date:m.date,description:m.description.trim(),category:m.category,payment:m.payment};if(edit){if(typeof m.id!=='string')return json({error:'Movimiento inválido.'},400);const rows=await getDb().update(movements).set(data).where(eq(movements.id,m.id)).returning();if(!rows.length)return json({error:'El movimiento ya no existe.'},404);return json(rows[0]);}const record={...data,id:crypto.randomUUID(),createdAt:new Date().toISOString()};await getDb().insert(movements).values(record);return json(record,201);}catch{return json({error:'No se pudo guardar. Intentá nuevamente.'},500);}}
export async function POST(request:Request){return save(request,false);}
export async function PUT(request:Request){return save(request,true);}
export async function DELETE(request:Request){if(!await permitted(request,true))return json({error:'Iniciá sesión nuevamente.'},401);try{const {id}=await request.json() as {id:unknown};if(typeof id!=='string')return json({error:'Movimiento inválido.'},400);const result=await getDb().delete(movements).where(eq(movements.id,id)).returning();if(!result.length)return json({error:'El movimiento ya no existe.'},404);return json({ok:true});}catch{return json({error:'No se pudo eliminar. Intentá nuevamente.'},500);}}

