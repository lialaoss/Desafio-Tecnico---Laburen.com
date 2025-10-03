import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import productRoutes from './routes/productRoutes.js';
import cartRoutes from './routes/cartRoutes.js';


dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.get('/', (req, res) => {
  res.json({
    message: 'API de E-commerce con IA',
    version: '1.0.0',
    endpoints: {
      products: {
        list: 'GET /products?q=search',
        detail: 'GET /products/:id',
      },
      carts: {
        create: 'POST /carts',
        update: 'PATCH /carts/:id',
        detail: 'GET /carts/:id',
      },
    },
  });
});


app.use('/products', productRoutes);
app.use('/carts', cartRoutes);


app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint no encontrado',
  });
});


app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});


app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});