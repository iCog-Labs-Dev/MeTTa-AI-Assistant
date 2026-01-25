import axiosInstance from "../lib/axios";
import {
  CodeChunk,
  Repository,
  AdminStats,
  AnnotationStats,
  User,
  IngestResponse,
  ChunkUpdateData,
  ChunkFilters,
} from "../types/admin";

export const ingestRepository = async (
  repoUrl: string,
  chunkSize: number,
  branch: string = "main"
): Promise<IngestResponse> => {
  const response = await axiosInstance.post<IngestResponse>(
    "/api/chunks/ingest",
    null,
    {
      params: {
        repo_url: repoUrl,
        chunk_size: chunkSize,
        branch: branch,
      },
    }
  );
  return response.data;
};

export const getRepositories = async () => {
  const response = await axiosInstance.get<Repository[]>(
    "/api/admin/repositories"
  );
  return response.data;
};

export const getPaginatedChunks = async (params: ChunkFilters) => {
  // Convert frontend param names to backend param names
  const backendParams: any = {
    limit: params.limit || 25,
    page: params.page || 1,
  };

  if (params.project) {
    backendParams.project = params.project;
  }
  if (params.repository) {
    backendParams.repo = params.repository;
  }
  if (params.section) {
    backendParams.section = params.section;
  }
  if (params.source) {
    backendParams.source = params.source;
  }
  if (params.search) {
    backendParams.search = params.search;
  }

  const response = await axiosInstance.get("/api/chunks/paginated", {
    params: backendParams,
  });
  return response.data;
};

export const updateChunk = async (chunkId: string, data: ChunkUpdateData) => {
  const response = await axiosInstance.patch(`/api/chunks/${chunkId}`, data);
  return response.data;
};

export const deleteChunk = async (chunkId: string) => {
  await axiosInstance.delete(`/api/chunks/${chunkId}`);
};

export const triggerEmbedding = async () => {
  const response = await axiosInstance.post<{ message: string }>(
    "/api/chunks/embed"
  );
  return response.data;
};

export const annotateChunk = async (chunkId: string) => {
  const response = await axiosInstance.post<CodeChunk>(
    `/annotation/${chunkId}`
  );
  return response.data;
};

export const searchChunks = async (query: string, topK: number = 50) => {
  const response = await axiosInstance.get("/api/chunks/search", {
    params: { q: query, top_k: topK },
  });
  return response.data;
};

export const getAdminStats = async () => {
  const response = await axiosInstance.get<AdminStats>("/api/admin/stats");
  return response.data;
};

export const getAnnotationStats = async () => {
  const response = await axiosInstance.get<AnnotationStats>(
    "/api/admin/annotation-stats"
  );
  return response.data;
};

export const getUsers = async () => {
  const response = await axiosInstance.get<User[]>("/api/admin/users");
  return response.data;
};

export const deleteUser = async (userId: string) => {
  await axiosInstance.delete(`/api/admin/users/${userId}`);
};

export const startBatchAnnotation = async (limit?: number) => {
  const params = limit ? { limit } : {};
  const response = await axiosInstance.post(
    "/annotation/batch/unannotated",
    null,
    { params }
  );
  return response.data;
};

export const retryFailedAnnotations = async (includeQuotaExceeded: boolean) => {
  const params = { include_quota: includeQuotaExceeded };
  const response = await axiosInstance.post(
    "/annotation/batch/retry_failed",
    null,
    { params }
  );
  return response.data;
};

export const getBranches = async (repoUrl: string): Promise<string[]> => {
  const response = await axiosInstance.get("/api/chunks/branches", {
    params: { repo_url: repoUrl },
  });

  // Defensive check to avoid silent UI failures
  if (!response.data || !Array.isArray(response.data.branches)) {
    console.error("Invalid branches response:", response.data);
    throw new Error("Invalid branch response format");
  }

  return response.data.branches;
};
