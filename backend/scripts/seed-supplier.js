// scripts/seed-supplier.js
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
async function main() {
  const name = 'Proveedor Demo';
  const existing = await prisma.supplier.findFirst({ where: { name } });
  if (existing) return console.log('✅ Proveedor ya existe:', existing.name, existing.id);
  const s = await prisma.supplier.create({
    data:{ name, cuit:'30-12345678-9', address:'Calle Falsa 123', email:'proveedor@demo.com', phone:'+54 11 4444-4444' }
  });
  console.log('✅ Proveedor creado:', s.name, s.id);
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());