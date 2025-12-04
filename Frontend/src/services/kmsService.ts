import axiosInstance, { handleAxiosError } from '../lib/axios';

interface StoreAPIKeyParams {
  api_key: string;
  provider_name: string;
}

const KMS_BASE_URL = '/api/kms';

export const kmsService = {
  storeAPIKey: async ({ api_key, provider_name }: StoreAPIKeyParams) => {
    try {
      const response = await axiosInstance.post<{ message: string }>(
        `${KMS_BASE_URL}/store`,
        {
          api_key,
          provider_name: provider_name.toLowerCase(),
        }
      );
      // Backend returns { message: "API key stored securely" }
      return response.data;
    } catch (error) {
      handleAxiosError(error, 'KMS storeAPIKey');
      throw error;
    }
  },

  getProviders: async () => {
    try {
      const response = await axiosInstance.get<{ services: string[] }>(
        `${KMS_BASE_URL}/providers`
      );
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

  deleteAPIKey: async (providerName: string) => {
    try {
      const response = await axiosInstance.delete<{ message: string }>(
        `${KMS_BASE_URL}/delete/${providerName.toLowerCase()}`
      );
      return response.data;
    } catch (error) {
      handleAxiosError(error, 'KMS deleteAPIKey');
      throw error;
    }
  },
};
