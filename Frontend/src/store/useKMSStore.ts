import { create } from 'zustand';
import { kmsService, KeyInfo } from '../services/kmsService';
import { AxiosError } from 'axios';

export interface ProviderMismatchInfo {
    declared: string;
    detected: string;
    detail?: string;
}

type StoreAPIKeySuccessResult = { success: true; message?: string; warning?: string; key_id?: string };
type StoreAPIKeyFailureResult = { success: false; error: string; providerMismatch?: ProviderMismatchInfo };
export type StoreAPIKeyResult = StoreAPIKeySuccessResult | StoreAPIKeyFailureResult;

interface KMSState {
    providers: KeyInfo[];
    isLoading: boolean;
    error: string | null;

    // Actions
    fetchProviders: () => Promise<void>;
    storeAPIKey: (apiKey: string, providerName: string, password: string, keyName?: string) => Promise<StoreAPIKeyResult>;
    deleteAPIKey: (keyId: string) => Promise<{ success: boolean; error?: string }>;
}

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

export const useKMSStore = create<KMSState>((set, get) => ({
    providers: [],
    isLoading: false,
    error: null,

    fetchProviders: async () => {
        set({ isLoading: true, error: null });
        try {
            console.log('[useKMSStore] fetchProviders: fetching');
            const data = await kmsService.getProviders();
            console.log('[useKMSStore] fetchProviders: got', data.services);
            set({ providers: data.services || [], isLoading: false });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to fetch providers';
            set({ error: errorMessage, isLoading: false });
        }
    },

    storeAPIKey: async (apiKey, providerName, password, keyName) => {
        set({ isLoading: true, error: null });
        try {
            console.log('[useKMSStore] storeAPIKey: starting, provider=', providerName);
            const data = await kmsService.storeAPIKey({
                api_key: apiKey,
                provider_name: providerName,
                password,
                key_name: keyName,
            });

            // Refresh providers immediately
            await get().fetchProviders();

            console.log('[useKMSStore] storeAPIKey: success, response=', data);
            set({ isLoading: false });
            return {
                success: true,
                message: data?.message,
                warning: data?.warning,
                key_id: data?.key_id
            };
        } catch (err) {
            const axiosError = err as AxiosError;
            const detailMessage = extractErrorDetail(axiosError);
            const providerMismatch = parseProviderMismatch(detailMessage);
            const errorMessage = detailMessage || axiosError.message || 'Failed to store API key';

            console.log('[useKMSStore] storeAPIKey: failed, error=', errorMessage);
            set({ error: errorMessage, isLoading: false });

            return {
                success: false,
                error: errorMessage,
                providerMismatch: providerMismatch ?? undefined,
            };
        }
    },

    deleteAPIKey: async (keyId) => {
        set({ isLoading: true, error: null });
        try {
            console.log('[useKMSStore] deleteAPIKey: starting', keyId);
            await kmsService.deleteAPIKey(keyId);

            // Refresh providers immediately
            await get().fetchProviders();

            console.log('[useKMSStore] deleteAPIKey: success', keyId);
            set({ isLoading: false });
            return { success: true };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to delete API key';
            console.log('[useKMSStore] deleteAPIKey: failed', errorMessage);
            set({ error: errorMessage, isLoading: false });
            return { success: false, error: errorMessage };
        }
    }
}));
