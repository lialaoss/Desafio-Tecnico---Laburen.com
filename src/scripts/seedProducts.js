import { PrismaClient } from '@prisma/client';
import pkg from 'xlsx';
const XLSX = pkg;
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();

async function seedProducts() {
  try {
    console.log('🚀 Iniciando importación de productos...');


    const filePath = join(__dirname, '../../products.xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`📊 Se encontraron ${data.length} productos en el archivo`);


    await prisma.product.deleteMany({});
    console.log('🗑️  Productos existentes eliminados');

    let importedCount = 0;
    
    for (const row of data) {
      const disponible = typeof row.DISPONIBLE === 'string' 
        ? row.DISPONIBLE.toLowerCase() === 'si' || row.DISPONIBLE.toLowerCase() === 'sí' || row.DISPONIBLE.toLowerCase() === 'true'
        : Boolean(row.DISPONIBLE);

      const name = `${row.TIPO_PRENDA} ${row.COLOR} - Talla ${row.TALLA}`;
      
      await prisma.product.create({
        data: {
          name,
          description: row.DESCRIPCIÓN || `${row.TIPO_PRENDA} ${row.COLOR} en talla ${row.TALLA}`,
          price: Number(row.PRECIO_50_U),
          stock: Number(row.CANTIDAD_DISPONIBLE),
          tipo: row.TIPO_PRENDA,
          talla: row.TALLA,
          color: row.COLOR,
          precio50: Number(row.PRECIO_50_U),
          precio100: Number(row.PRECIO_100_U),
          precio200: Number(row.PRECIO_200_U),
          disponible,
          categoria: row.CATEGORÍA,
        },
      });
      
      importedCount++;
    }
    const stats = await prisma.product.groupBy({
      by: ['categoria'],
      _count: true,
    });
    
    stats.forEach(stat => {
      console.log(`   ${stat.categoria}: ${stat._count} productos`);
    });

  } catch (error) {
    console.error('Error al importar productos:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedProducts()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });