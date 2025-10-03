import prisma from '../config/database.js';

export const getProducts = async (req, res) => {
  try {
    const { q } = req.query;
    
    const where = q ? {
      OR: [
        { name: { contains: q } },
        { description: { contains: q } },
        { tipo: { contains: q } },
        { color: { contains: q } },
        { categoria: { contains: q } },
      ]
    } : {};
    const products = await prisma.product.findMany({
      where,
      orderBy: { id: 'asc' },
    });
    
    res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    console.error('Error al obtener productos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener los productos',
      error: error.message,
    });
  }
};


export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) },
    });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Producto con ID ${id} no encontrado`,
      });
    }
    
    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error('Error al obtener producto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el producto',
      error: error.message,
    });
  }
};