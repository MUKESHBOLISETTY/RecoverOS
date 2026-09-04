import axios from 'axios';
import { getCookie } from '../../utils/cookieUtils';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const insightsApi = axios.create({
    baseURL: `${BASE_URL}/api/v1/insights`,
    withCredentials: true
});

insightsApi.interceptors.request.use((config) => {
    const token = getCookie('access_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export const getDashboardMetrics = async () => {
    const response = await insightsApi.get('/dashboard');
    return response.data.data;
};
