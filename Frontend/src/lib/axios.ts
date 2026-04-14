import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import { getAccessToken, getRefreshToken, refreshAccessToken, clearTokens } from './auth';
import { useUserStore } from '../store/useUserStore';

// Create base axios instance
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 100000,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
  withCredentials: true,
});

const isAuthEndpoint = (url: string): boolean => {
  return url.toLowerCase().includes('/api/auth/');
};

const hasAuthorizationHeader = (config: AxiosRequestConfig): boolean => {
  const headers = config.headers;
  if (!headers) {
    return false;
  }

  if (typeof headers.get === 'function') {
    return Boolean(headers.get('Authorization'));
  }

  const headerRecord = headers as Record<string, string | undefined>;
  return Boolean(headerRecord.Authorization ?? headerRecord.authorization);
};

// Request interceptor for API calls
axiosInstance.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for API calls
axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };
    if (!originalRequest) {
      return Promise.reject(error);
    }

    const requestUrl = originalRequest.url ?? '';
    const shouldAttemptRefresh =
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isAuthEndpoint(requestUrl) &&
      hasAuthorizationHeader(originalRequest) &&
      Boolean(getRefreshToken());

    // Only retry protected non-auth requests that still have a refresh path available.
    if (shouldAttemptRefresh) {
      originalRequest._retry = true;

      try {
        await refreshAccessToken();

        // Update the authorization header
        const token = getAccessToken();
        if (token) {
          setAxiosAuthHeader(token);
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          } else {
            originalRequest.headers = { Authorization: `Bearer ${token}` };
          }
        }

        // Retry the original request
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        // If refresh fails, log the user out
        clearTokens();
        useUserStore.getState().setIsAuthenticated(false);

        // Redirect to login page
        window.location.href = '/login';

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);


// Sets the Authorization header for axios requests @param token The JWT token to set in the header
export const setAxiosAuthHeader = (token: string): void => {
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
};

// Removes the Authorization header from axios requests
export const clearAxiosAuthHeader = (): void => {
  delete axios.defaults.headers.common['Authorization'];
};

// Global error handler for axios errors
export const handleAxiosError = (error: unknown, context: string = ''): void => {
  const prefix = context ? `${context} Error:` : 'Error:';

  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ detail?: string }>;
    if (axiosError.response?.data?.detail) {
      console.error(`${prefix}`, axiosError.response.data.detail);
    } else {
      console.error(`${prefix}`, axiosError.message);
    }
  } else {
    console.error(`${prefix} Unexpected Error:`, error);
  }
};

export default axiosInstance;
