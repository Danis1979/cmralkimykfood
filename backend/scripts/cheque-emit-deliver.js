// scripts/cheque-emit-deliver.js
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
async function main(){
  const ch = await prisma.cheque.findFirst({
    where:{ type:'emitido', status:'EMITIDO' },
    orderBy:{ createdAt:'desc' }
  });
  if(!ch) throw new Error('No hay cheques EMITIDOS');
  await prisma.cheque.update({ where:{ id: ch.id }, data:{ status:'ENTREGADO' }});
  console.log('📤 Cheque ENTREGADO:', ch.id);
}
main().catch(e=>{console.error('❌ Error:', e.message||e);process.exit(1)}).finally(()=>prisma.$disconnect());