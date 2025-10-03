import express from 'express';
import { createCart, updateCart, getCartById } from '../controllers/cartController.js';

const router = express.Router();


router.post('/', createCart);

router.patch('/:id', updateCart);

router.get('/:id', getCartById);

export default router;