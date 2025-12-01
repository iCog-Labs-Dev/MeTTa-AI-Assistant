import * as authService from '../services/authService';
import type { SignupRequest, LoginRequest, RefreshRequest } from '../types/auth';
import { useUserStore } from '../store/useUserStore';

// Token Management
let accessToken: string | null = null;
let refreshToken: string | null = null;

// Set tokens in memory (called after login/signup/refresh)
export const setTokens = (access: string, refresh: string) => {
  accessToken = access;
  refreshToken = refresh;
  // Store in localStorage for persistence
  localStorage.setItem('access_token', access);
  localStorage.setItem('refresh_token', refresh);

  // Update authentication state in the store
  useUserStore.getState().setIsAuthenticated(true);
};

// Get access token from memory or localStorage
export const getAccessToken = (): string | null => {
  if (accessToken) return accessToken;
  accessToken = localStorage.getItem('access_token');
  return accessToken;
};

// Get refresh token from memory or localStorage
export const getRefreshToken = (): string | null => {
  if (refreshToken) return refreshToken;
  refreshToken = localStorage.getItem('refresh_token');
  return refreshToken;
};

// Clear all tokens (called on logout)
export const clearTokens = () => {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');

  // Update authentication state in the store
  useUserStore.getState().setIsAuthenticated(false);
};

// Check if user is authenticated
export const isAuthenticated = (): boolean => {
  const isAuth = !!getAccessToken();

  // Ensure store state is in sync with token state
  const storeState = useUserStore.getState();
  if (storeState.isAuthenticated !== isAuth) {
    storeState.setIsAuthenticated(isAuth);
  }

  return isAuth;
};

// Auth API Functions

// Sign up a new user
export const signup = async (email: string, password: string) => {
  const data: SignupRequest = { email, password };
  const response = await authService.signup(data);
  return response;
};

// Login user and store tokens
export const login = async (email: string, password: string) => {
  const data: LoginRequest = { email, password };
  const response = await authService.login(data);

  // Store tokens
  setTokens(response.access_token, response.refresh_token);

  return response;
};

// Refresh access token
export const refreshAccessToken = async () => {
  const currentRefreshToken = getRefreshToken();

  if (!currentRefreshToken) {
    throw new Error('No refresh token available');
  }

  const data: RefreshRequest = { refresh_token: currentRefreshToken };
  const response = await authService.refresh(data);

  // Update tokens
  setTokens(response.access_token, response.refresh_token);

  return response;
};

// Logout user and clear tokens
export const logout = () => {
  clearTokens();

  const cookies = document.cookie.split(';');

  for (let cookie of cookies) {
    const eqPos = cookie.indexOf('=');
    const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();

    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=None; Secure`;
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  }
};
