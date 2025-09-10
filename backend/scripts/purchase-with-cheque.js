// scripts/purchase-with-cheque.js
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();

async function getOnHand(tx, productId){
  const moves = await tx.inventoryMove.findMany({ where:{ productId } });
  return moves.reduce((a,m)=>a+(m.direction==='IN'?m.qty:-m.qty),0);
}

async function main(){
  await prisma.$transaction(async (tx)=>{
    const supplier = await tx.supplier.findFirst({ where:{ name:'Proveedor Demo' }});
    const mp = await tx.product.findUnique({ where:{ sku:'MP-MASA-BASE' }});
    if(!supplier || !mp) throw new Error('Falta proveedor o MP');

    const qty = 5;                 // 5 kg
    const price = 500;             // ARS por kg
    const total = qty * price;

    // Compra
    const purchase = await tx.purchase.create({
      data:{
        supplierId: supplier.id,
        pm: 'Cheque',
        total: String(total),
        status: 'EMITIDA',
        notes: 'Compra demo con cheque',
        items:{ create:[{ productId: mp.id, qty, price: String(price) }] }
      },
      include:{ items:true }
    });

    // IN de MP (kárdex)
    const onHandMP = await getOnHand(tx, mp.id);
    await tx.inventoryMove.create({
      data:{
        productId: mp.id, qty, direction:'IN',
        reason:'compra', refType:'purchase', refId: purchase.id,
        locationTo:'MP', onHandAfter: onHandMP + qty
      }
    });

    // Cheque emitido (queda EMITIDO)
    const ch = await tx.cheque.create({
      data:{
        type:'emitido',
        bank:'Banco Demo',
        number:'900001',
        issueDate: new Date(),
        payDate: new Date(Date.now()+7*24*60*60*1000), // a 7 días
        amount: String(total),
        status:'EMITIDO',
        refType:'purchase',
        refId: purchase.id,
        purchaseId: purchase.id
      }
    });

    // Asiento en ChequesEmitidos (DEBE)
    await tx.ledgerEntry.create({
      data:{
        account:'ChequesEmitidos', type:'DEBE',
        amount:String(total),
        refType:'cheque', refId: ch.id,
        description:`Cheque emitido por compra ${purchase.id}`
      }
    });

    console.log('✅ Compra registrada:', purchase.id, 'Total', total);
    console.log('💳 Cheque emitido:', ch.id, 'estado EMITIDO');
  });
}

main().catch(e=>{console.error('❌ Error compra:', e.message||e);process.exit(1)}).finally(()=>prisma.$disconnect());