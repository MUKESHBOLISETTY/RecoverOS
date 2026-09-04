import axios from 'axios';
import { getCookie } from '../../utils/cookieUtils';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const casesApi = axios.create({
    baseURL: `${BASE_URL}/api/v1/cases`,
    withCredentials: true
});

casesApi.interceptors.request.use((config) => {
    const token = getCookie('access_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export const getCases = async () => {
    const response = await casesApi.get('/');
    return response.data.data;
};

export const getCaseDetails = async (id) => {
    const response = await casesApi.get(`/${id}`);
    return response.data.data;
};
