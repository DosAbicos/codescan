import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getSession = async () => {
  const response = await api.get('/session');
  return response.data;
};

export const loadDefaultFile = async () => {
  const response = await api.get('/load-default');
  return response.data;
};

export const getProducts = async (params = {}) => {
  const response = await api.get('/products', { params });
  return response.data;
};

export const updateProductBarcode = async (productId, data) => {
  const response = await api.put(`/products/${productId}/barcode`, data);
  return response.data;
};

export const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const downloadExcel = async () => {
  const response = await api.get('/download', {
    responseType: 'blob',
  });
  return response.data;
};

export default api;
