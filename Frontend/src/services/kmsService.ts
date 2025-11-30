import axiosInstance, { handleAxiosError } from '../lib/axios';

interface StoreAPIKeyParams {
  api_key: string;
  provider_name: string;
  password: string;
  key_name?: string;
}

export interface KeyInfo {
  id: string;
  provider_name: string;
  key_name?: string;
}

const KMS_BASE_URL = '/api/kms';

export const kmsService = {
  getProviders: async () => {
    try {
      const response = await axiosInstance.get<{ services: KeyInfo[] }>(`${KMS_BASE_URL}/providers`);
      return response.data;
    } catch (error: any) {
      // Treat 404 as "no providers" per backend contract
      if (error?.response?.status === 404) {
        return { services: [] };
      }
      handleAxiosError(error, 'KMS getProviders');
      throw error;
    }
  },

  storeAPIKey: async ({ api_key, provider_name, password, key_name }: StoreAPIKeyParams) => {
    try {
      const response = await axiosInstance.post<{ message: string; warning?: string; key_id: string }>(
        `${KMS_BASE_URL}/store`,
        {
          api_key,
          provider_name: provider_name.toLowerCase(),
          password,
          ...(key_name && { key_name }),
        }
      );
      return response.data;
    } catch (error) {
      handleAxiosError(error, 'KMS storeAPIKey');
      throw error;
    }
  },

  verifyPassword: async (password: string) => {
    try {
      const response = await axiosInstance.post<{ message: string }>(
        `${KMS_BASE_URL}/verify-password`,
        { password }
      );
      return response.data;
    } catch (error) {
      handleAxiosError(error, 'KMS verifyPassword');
      throw error;
    }
  },

  deleteAPIKey: async (keyId: string) => {
    try {
      const response = await axiosInstance.delete<{ message: string }>(
        `${KMS_BASE_URL}/delete/${keyId}`
      );
      return response.data;
    } catch (error) {
      handleAxiosError(error, 'KMS deleteAPIKey');
      throw error;
    }
  },
};
