import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:3000',
});

export async function listProducts(query) {
  const res = await API.get(`/products?q=${encodeURIComponent(query || '')}`);
  return res.data.data;
}

export async function createCart(items) {
  const res = await API.post('/carts', { items });
  return res.data.data;
}

export async function updateCart(cartId, items) {
  const res = await API.patch(`/carts/${cartId}`, { items });
  return res.data.data;
}
