import { getUserCookie } from './cookies';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Get current user ID from cookie or localStorage
const getCurrentUserId = (): string | null => {
  try {
    // Try cookie first (faster)
    const cookieUser = getUserCookie();
    if (cookieUser) {
      return cookieUser.id;
    }
    
    // Fallback to localStorage
    const storedUser = localStorage.getItem('archive_current_user');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      return user.id;
    }
  } catch (error) {
    console.error('Error getting current user ID:', error);
  }
  return null;
};

// Make an API request with user ID header
export const apiRequest = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> => {
  const userId = getCurrentUserId();
  
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
    ...(userId ? { 'X-User-Id': userId } : {}),
  };

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  return fetch(url, {
    ...options,
    headers,
  });
};

// Helper function for GET requests
export const apiGet = async (endpoint: string): Promise<Response> => {
  return apiRequest(endpoint, { method: 'GET' });
};

// Helper function for POST requests
export const apiPost = async (endpoint: string, body?: any): Promise<Response> => {
  return apiRequest(endpoint, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
};

// Helper function for PUT requests
export const apiPut = async (endpoint: string, body?: any): Promise<Response> => {
  return apiRequest(endpoint, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
};

// Helper function for DELETE requests
export const apiDelete = async (endpoint: string): Promise<Response> => {
  return apiRequest(endpoint, { method: 'DELETE' });
};

// Helper function for file uploads (POST with FormData)
export const apiUpload = async (
  endpoint: string,
  formData: FormData,
  method: 'POST' | 'PUT' = 'POST'
): Promise<Response> => {
  const userId = getCurrentUserId();
  
  const headers: HeadersInit = {
    ...(userId ? { 'X-User-Id': userId } : {}),
    // Don't set Content-Type for FormData - let browser set it with boundary
  };

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  return fetch(url, {
    method,
    headers,
    body: formData,
  });
};

