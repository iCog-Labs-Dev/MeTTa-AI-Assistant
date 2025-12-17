import axiosInstance, { handleAxiosError } from '../lib/axios';
import type { SignupRequest, SignupResponse, LoginRequest, LoginResponse, RefreshRequest, RefreshResponse } from '../types/auth';

const AUTH_BASE_URL = '/api/auth';

// Use the global error handler with 'Auth' context
const handleError = (error: unknown): void => {
  handleAxiosError(error, 'Auth');
};

// Sign up a new user
export const signup = async (data: SignupRequest): Promise<SignupResponse> => {
  try {
    const response = await axiosInstance.post<SignupResponse>(
      `${AUTH_BASE_URL}/signup`,
      data
    );
    return response.data;
  } catch (error) {
    handleError(error);
    throw error;
  }
};

// Login user and get tokens
export const login = async (data: LoginRequest): Promise<LoginResponse> => {
  try {
    const response = await axiosInstance.post<LoginResponse>(
      `${AUTH_BASE_URL}/login`,
      data
    );
    return response.data;
  } catch (error) {
    handleError(error);
    throw error;
  }
};

// Refresh access token using refresh token
export const refresh = async (data: RefreshRequest): Promise<RefreshResponse> => {
  try {
    const response = await axiosInstance.post<RefreshResponse>(
      `${AUTH_BASE_URL}/refresh`,
      data
    );
    return response.data;
  } catch (error) {
    handleError(error);
    throw error;
  }
};
