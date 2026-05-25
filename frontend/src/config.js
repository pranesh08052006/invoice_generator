// API Configuration - automatically uses the correct URL based on environment
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://3.86.4.100:8000';

export default API_BASE_URL;
