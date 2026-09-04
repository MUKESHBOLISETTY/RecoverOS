import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const authApi = axios.create({
    baseURL: `${BASE_URL}/auth`,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const login = async (email, password) => {
    const response = await authApi.post('/login', { email, password });
    return response.data;
};

export const register = async (email, password) => {
    const response = await authApi.post('/register', { email, password });
    return response.data;
};
