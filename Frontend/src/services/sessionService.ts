import axiosInstance, { handleAxiosError } from '../lib/axios';

export const updateSessionTitle = async (sessionId: string, title: string): Promise<void> => {
  try {
    await axiosInstance.patch(`/api/chat/sessions/${sessionId}/title`, { title });
  } catch (error) {
    handleAxiosError(error, 'Session Title');
    throw error;
  }
};
