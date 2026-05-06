// All learning mode API calls now use the unified /api/chat endpoints
import { sendMessage } from './chatService';

// Get the learning curriculum structure
export async function getLearningStructure() {
  // Unified endpoint: /api/chat/structure
  const res = await fetch(`/api/chat/structure`);
  if (!res.ok) throw new Error('Failed to fetch learning structure');
  return await res.json();
}

// Get the learning start message and modules
export async function getLearningStart() {
  // Unified endpoint: /api/chat/start
  const res = await fetch(`/api/chat/start`);
  if (!res.ok) throw new Error('Failed to fetch learning start');
  return await res.json();
}

// Get user progress in the curriculum
export async function getUserProgress(userId: string) {
  // Unified endpoint: /api/chat/progress/:userId
  const res = await fetch(`/api/chat/progress/${userId}`);
  if (!res.ok) throw new Error('Failed to fetch user progress');
  return await res.json();
}

// Get a specific module for a user
export async function getModule(userId: string, moduleId: string) {
  // Unified endpoint: /api/chat/module/:userId/:moduleId
  const res = await fetch(`/api/chat/module/${userId}/${moduleId}`);
  if (!res.ok) throw new Error('Failed to fetch module');
  return await res.json();
}

// Mark a module as complete for a user
export async function completeModule(userId: string, moduleId: string) {
  // Unified endpoint: /api/chat/complete/:userId/:moduleId
  const res = await fetch(`/api/chat/complete/${userId}/${moduleId}`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to complete module');
  return await res.json();
}

// Self-claim a module for a user
export async function selfClaimModule(userId: string, moduleId: string) {
  // Unified endpoint: /api/chat/self-claim/:userId/:moduleId
  const res = await fetch(`/api/chat/self-claim/${userId}/${moduleId}`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to self-claim module');
  return await res.json();
}

// Get a quiz prompt for a module
export async function getQuizPrompt(moduleId: string) {
  // Unified endpoint: /api/chat/quiz-prompt/:moduleId
  const res = await fetch(`/api/chat/quiz-prompt/${moduleId}`);
  if (!res.ok) throw new Error('Failed to fetch quiz prompt');
  return await res.json();
}

// Send a learning mode chat message (now handled by sendMessage in chatService)
// Deprecated: use useChatStore/sendMessage for unified chat/learning
export const sendLearningChat = undefined;
