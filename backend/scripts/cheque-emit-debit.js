// scripts/cheque-emit-debit.js
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();

async function main(){
  await prisma.$transaction( async (tx)=>{
    // Tomo el último cheque emitido ENTREGADO (no debitado)
    const ch = await tx.cheque.findFirst({
      where:{ type:'emitido', status:'ENTREGADO' },
      orderBy:{ createdAt:'desc' }
    });
    if(!ch) throw new Error('No hay cheques ENTREGADOS para debitar');

    // 1) Limpiar ChequesEmitidos (HABER)
    await tx.ledgerEntry.create({
      data:{
        account:'ChequesEmitidos', type:'HABER',
        amount: ch.amount.toString(),
        refType:'cheque', refId: ch.id,
        description:'Débito de cheque (limpia ChequesEmitidos)'
      }
    });
    // 2) Salida de Banco (DEBE)
    await tx.ledgerEntry.create({
      data:{
        account:'Banco', type:'DEBE',
        amount: ch.amount.toString(),
        refType:'cheque', refId: ch.id,
        description:'Débito de cheque'
      }
    });

    await tx.cheque.update({ where:{ id: ch.id }, data:{ status:'DEBITADO' }});
    console.log('🏦 Cheque DEBITADO:', ch.id);
  });
}
main().catch(e=>{console.error('❌ Error débito:', e.message||e);process.exit(1)}).finally(()=>prisma.$disconnect());