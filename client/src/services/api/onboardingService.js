import axios from 'axios';
import { getCookie } from '../../utils/cookieUtils';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const onboardingApi = axios.create({
    baseURL: `${BASE_URL}/api/v1/onboarding`,
    withCredentials: true
});

onboardingApi.interceptors.request.use((config) => {
    const token = getCookie('access_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export const getOnboardingStatus = async () => {
    const response = await onboardingApi.get('/status');
    return response.data.data;
};
