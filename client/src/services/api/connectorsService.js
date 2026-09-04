import axios from 'axios';
import { getCookie } from '../../utils/cookieUtils';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const connectorsApi = axios.create({
    baseURL: `${BASE_URL}/connectors`, // Note: the backend route is /connectors, not /api/v1/connectors based on app.js
    withCredentials: true
});

connectorsApi.interceptors.request.use((config) => {
    const token = getCookie('access_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export const initShopifyOAuth = async (payload) => {
    const response = await connectorsApi.post('/shopify/init', payload);
    return response.data; // { success, url }
};

export const saveConnection = async (payload) => {
    // Used for Razorpay
    const response = await connectorsApi.post('/', payload);
    return response.data;
};

export const initGoogleOAuth = async (payload) => {
    const response = await connectorsApi.post('/google/init', payload);
    return response.data;
};

export const getGoogleSpreadsheets = async (tempAuthId) => {
    const response = await connectorsApi.get(`/google/spreadsheets?tempAuthId=${tempAuthId}`);
    return response.data;
};

export const finalizeSheetsConnection = async (payload) => {
    const response = await connectorsApi.post('/google/spreadsheets/finalize', payload);
    return response.data;
};
