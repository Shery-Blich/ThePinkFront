import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  withCredentials: true, // send httpOnly cookie on every request
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !window.location.pathname.includes('/login')) {
      window.location.href = `${import.meta.env.BASE_URL || '/'}login`.replace(/\/+/g, '/');
    }
    return Promise.reject(err);
  }
);

export default api;
