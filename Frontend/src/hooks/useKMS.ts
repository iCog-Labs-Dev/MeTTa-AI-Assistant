import { useCallback, useEffect, useState } from 'react';
import { kmsService } from '../services/kmsService';

export const useKMS = () => {
  const [providers, setProviders] = useState<string[]>([]);
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

  const storeAPIKey = async (apiKey: string, providerName: string) => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('[useKMS] storeAPIKey: starting, provider=', providerName);
      const data = await kmsService.storeAPIKey({
        api_key: apiKey,
        provider_name: providerName,
      });
      await fetchProviders();
      console.log('[useKMS] storeAPIKey: success, response message=', data?.message);
      return { success: true, message: data?.message as string | undefined };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to store API key';
      console.log('[useKMS] storeAPIKey: failed, error=', errorMessage);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const deleteAPIKey = async (providerName: string) => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('[useKMS] deleteAPIKey: starting', providerName);
      await kmsService.deleteAPIKey(providerName);
      await fetchProviders();
      console.log('[useKMS] deleteAPIKey: success', providerName);
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
