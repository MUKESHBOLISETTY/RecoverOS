import axios from 'axios';
import store from '../redux/store';
import toast from 'react-hot-toast';
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (axios.isCancel(error)) {
            return Promise.reject(error);
        }
        if (error.code === 'ERR_NETWORK' || (!error.response && error.request)) {
            toast.error('Network Error: Please check your internet connection.', {
                duration: 3000,
                position: 'bottom-right',
            });
            return Promise.reject(error);
        }

        if (error.response?.data.message) {
            toast.error(error.response.data.message, {
                duration: 3000,
                position: 'bottom-right',
                icon: '⚠️',
            })
        }
        return Promise.reject(error);
    }
);

export const authApi = {
    login: (data, signal) => api.post('/auth/login', data, { signal }),
    register: (data) => api.post('/auth/register', data),
}

export default api; 