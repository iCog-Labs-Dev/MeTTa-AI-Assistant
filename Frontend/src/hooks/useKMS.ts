import axios, { AxiosError } from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { kmsService, KeyInfo } from '../services/kmsService';

export interface ProviderMismatchInfo {
  declared: string;
  detected: string;
  detail?: string;
}

type StoreAPIKeySuccessResult = { success: true; message?: string; warning?: string; key_id?: string };
type StoreAPIKeyFailureResult = { success: false; error: string; providerMismatch?: ProviderMismatchInfo };
export type StoreAPIKeyResult = StoreAPIKeySuccessResult | StoreAPIKeyFailureResult;

const extractErrorDetail = (error?: AxiosError<any>): string | undefined => {
  return error?.response?.data?.details ?? error?.response?.data?.detail;
};

const parseProviderMismatch = (detail?: string): ProviderMismatchInfo | null => {
  if (!detail) return null;
  const regex = /API key appears to belong to '([^']+)' but '([^']+)' was declared\.?/i;
  const match = detail.match(regex);
  if (match) {
    return {
      detected: match[1],
      declared: match[2],
      detail,
    };
  }
  return null;
};

export const useKMS = () => {
  const [providers, setProviders] = useState<KeyInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProviders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('[useKMS] getProviders: fetching');
      const data = await kmsService.getProviders();
      console.log('[useKMS] getProviders: got', data.services);
      setProviders(data.services || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch providers');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const storeAPIKey = async (
    apiKey: string,
    providerName: string,
    password: string,
    keyName?: string
  ): Promise<StoreAPIKeyResult> => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('[useKMS] storeAPIKey: starting, provider=', providerName);
      const data = await kmsService.storeAPIKey({
        api_key: apiKey,
        provider_name: providerName,
        password,
        key_name: keyName,
      });
      await fetchProviders();
      console.log('[useKMS] storeAPIKey: success, response=', data);
      return {
        success: true,
        message: data?.message as string | undefined,
        warning: data?.warning as string | undefined,
        key_id: data?.key_id
      };
    } catch (err) {

      const axiosError = err as AxiosError;
      const detailMessage = extractErrorDetail(axiosError);
      const providerMismatch = parseProviderMismatch(detailMessage);
      const errorMessage = detailMessage || axiosError.message || 'Failed to store API key';
      console.log('[useKMS] storeAPIKey: failed, error=', errorMessage);
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
        providerMismatch: providerMismatch ?? undefined,
      };

    } finally {
      setIsLoading(false);
    }
  };

  const deleteAPIKey = async (keyId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('[useKMS] deleteAPIKey: starting', keyId);
      await kmsService.deleteAPIKey(keyId);
      await fetchProviders();
      console.log('[useKMS] deleteAPIKey: success', keyId);
      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete API key';
      console.log('[useKMS] deleteAPIKey: failed', errorMessage);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  return {
    providers,
    isLoading,
    error,
    storeAPIKey,
    deleteAPIKey,
    refreshProviders: fetchProviders,
  };
};
