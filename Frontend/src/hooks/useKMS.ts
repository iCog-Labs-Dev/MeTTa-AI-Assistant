import { useEffect } from 'react';
import { useKMSStore } from '../store/useKMSStore';

export type { StoreAPIKeyResult, ProviderMismatchInfo } from '../store/useKMSStore';

export const useKMS = () => {
  const {
    providers,
    isLoading,
    error,
    fetchProviders,
    storeAPIKey,
    deleteAPIKey
  } = useKMSStore();

  // Initial fetch if empty
  useEffect(() => {
    if (providers.length === 0) {
      fetchProviders();
    }
  }, [fetchProviders, providers.length]);

  return {
    providers,
    isLoading,
    error,
    storeAPIKey,
    deleteAPIKey,
    refreshProviders: fetchProviders,
  };
};
