import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:5001/api',
    withCredentials: true // Important for sending cookies (JWT) with requests
});

export default api;
