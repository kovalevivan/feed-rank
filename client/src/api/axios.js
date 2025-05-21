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
    // Get token from localStorage
    const token = localStorage.getItem('token');
    
    console.log(`🔄 [Request] ${config.method.toUpperCase()} ${config.url}`, 
      config.data ? { data: config.data } : '');
    
    // If token exists, add it to x-auth-token header (not Authorization)
    if (token) {
      config.headers['x-auth-token'] = token;
      console.log('🔑 Auth token added to request:', { token: token.substring(0, 15) + '...' });
    } else {
      console.warn('⚠️ No auth token found in localStorage');
    }
    
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
    
    // Handle authentication errors
    if (error.response && error.response.status === 401) {
      // Clear token and redirect to login if there's an auth error
      localStorage.removeItem('token');
      
      // Only redirect if not already on login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

export default axios; 