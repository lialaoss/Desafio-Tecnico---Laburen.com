import express from 'express';
import { getProducts, getProductById } from '../controllers/productsController.js';
import { createCart, updateCart } from '../controllers/cartsController.js';

const router = express.Router();

router.get('/products', getProducts);
router.get('/products/:id', getProductById);

router.post('/carts', createCart);
router.patch('/carts/:id', updateCart);

export default router;