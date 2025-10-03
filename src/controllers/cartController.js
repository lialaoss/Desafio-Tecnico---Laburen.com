import prisma from '../config/database.js';

export const createCart = async (req, res) => {
  try {
    const { items } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un array de items con al menos un producto',
      });
    }
    
    for (const item of items) {
      if (!item.product_id || !item.qty || item.qty <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Cada item debe tener product_id y qty (mayor a 0)',
        });
      }
    }
    

    const productIds = items.map(item => item.product_id);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });
    
    if (products.length !== productIds.length) {
      const foundIds = products.map(p => p.id);
      const notFound = productIds.filter(id => !foundIds.includes(id));
      return res.status(404).json({
        success: false,
        message: `Productos no encontrados: ${notFound.join(', ')}`,
      });
    }

    for (const item of items) {
      const product = products.find(p => p.id === item.product_id);
      if (product.stock < item.qty) {
        return res.status(400).json({
          success: false,
          message: `Stock insuficiente para ${product.name}. Disponible: ${product.stock}, Solicitado: ${item.qty}`,
        });
      }
    }

    const cart = await prisma.cart.create({
      data: {
        items: {
          create: items.map(item => ({
            productId: item.product_id,
            qty: item.qty,
          })),
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });
    
    const cartWithTotals = {
      ...cart,
      totalItems: cart.items.reduce((sum, item) => sum + item.qty, 0),
      totalPrice: cart.items.reduce((sum, item) => sum + (item.product.price * item.qty), 0),
    };
    
    res.status(201).json({
      success: true,
      message: 'Carrito creado exitosamente',
      data: cartWithTotals,
    });
  } catch (error) {
    console.error('Error al crear carrito:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear el carrito',
      error: error.message,
    });
  }
};


export const updateCart = async (req, res) => {
  try {
    const { id } = req.params;
    const { items } = req.body;
    
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un array de items',
      });
    }
    
    const cart = await prisma.cart.findUnique({
      where: { id: parseInt(id) },
      include: { items: true },
    });
    
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: `Carrito con ID ${id} no encontrado`,
      });
    }
    
    for (const item of items) {
      const { product_id, qty } = item;
      
      if (qty === 0) {
        await prisma.cartItem.deleteMany({
          where: {
            cartId: parseInt(id),
            productId: product_id,
          },
        });
      } else if (qty > 0) {
        const product = await prisma.product.findUnique({
          where: { id: product_id },
        });
        
        if (!product) {
          return res.status(404).json({
            success: false,
            message: `Producto con ID ${product_id} no encontrado`,
          });
        }
        
        if (product.stock < qty) {
          return res.status(400).json({
            success: false,
            message: `Stock insuficiente para ${product.name}. Disponible: ${product.stock}, Solicitado: ${qty}`,
          });
        }

        await prisma.cartItem.upsert({
          where: {
            cartId_productId: {
              cartId: parseInt(id),
              productId: product_id,
            },
          },
          update: { qty },
          create: {
            cartId: parseInt(id),
            productId: product_id,
            qty,
          },
        });
      }
    }
    
    const updatedCart = await prisma.cart.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });
    
    const cartWithTotals = {
      ...updatedCart,
      totalItems: updatedCart.items.reduce((sum, item) => sum + item.qty, 0),
      totalPrice: updatedCart.items.reduce((sum, item) => sum + (item.product.price * item.qty), 0),
    };
    
    res.status(200).json({
      success: true,
      message: 'Carrito actualizado exitosamente',
      data: cartWithTotals,
    });
  } catch (error) {
    console.error('Error al actualizar carrito:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar el carrito',
      error: error.message,
    });
  }
};


export const getCartById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const cart = await prisma.cart.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });
    
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: `Carrito con ID ${id} no encontrado`,
      });
    }
    
    const cartWithTotals = {
      ...cart,
      totalItems: cart.items.reduce((sum, item) => sum + item.qty, 0),
      totalPrice: cart.items.reduce((sum, item) => sum + (item.product.price * item.qty), 0),
    };
    
    res.status(200).json({
      success: true,
      data: cartWithTotals,
    });
  } catch (error) {
    console.error('Error al obtener carrito:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el carrito',
      error: error.message,
    });
  }
};