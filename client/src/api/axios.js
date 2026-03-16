import axios from 'axios';

// Set base URL for API requests
// Development: Point to the actual backend server
// Production: API runs on same origin as frontend when built
const apiBaseUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000';

console.log(`🔧 Setting up axios with baseURL: ${apiBaseUrl}, environment: ${process.env.NODE_ENV}`);
axios.defaults.baseURL = apiBaseUrl;

// Add detailed request logging
axios.interceptors.request.use(
  config => {
    console.log(`🔄 [Request] ${config.method.toUpperCase()} ${config.url}`, 
      config.data ? { data: config.data } : '');
    return config;
  },
  error => {
    console.error('❌ [Request Error]', error);
    return Promise.reject(error);
  }
);

// Add detailed response logging
axios.interceptors.response.use(
  response => {
    console.log(`✅ [Response] ${response.config.method.toUpperCase()} ${response.config.url}`, 
      { status: response.status, data: response.data });
    return response;
  },
  error => {
    console.error(`❌ [Response Error] ${error.config?.method?.toUpperCase() || 'UNKNOWN'} ${error.config?.url || 'UNKNOWN'}`, { 
      status: error.response?.status, 
      data: error.response?.data,
      message: error.message
    });
    return Promise.reject(error);
  }
);

export default axios; 
