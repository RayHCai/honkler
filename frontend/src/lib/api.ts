import type { ApiResponse, AuthPayload, User, Document, Chat, ChatDetail, Message, CallLog, Settlement } from '../types/api';

const TOKEN_KEY = 'honkler_token';

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function hasToken(): boolean {
  return !!localStorage.getItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(path, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    throw new ApiError(401, 'Session expired');
  }

  const json: ApiResponse<T> = await res.json();

  if (!res.ok || !json.success) {
    throw new ApiError(res.status, json.error || 'Request failed');
  }

  return json.data as T;
}

// Auth
export const auth = {
  register(email: string, password: string, displayName?: string) {
    return request<AuthPayload>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    });
  },
  login(email: string, password: string) {
    return request<AuthPayload>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },
  me() {
    return request<User>('/api/auth/me');
  },
};

// Documents
export const documents = {
  upload(file: File) {
    const form = new FormData();
    form.append('file', file);
    return request<Document>('/api/documents/upload', {
      method: 'POST',
      body: form,
    });
  },
  list() {
    return request<Document[]>('/api/documents');
  },
  get(id: string) {
    return request<Document>(`/api/documents/${id}`);
  },
  delete(id: string) {
    return request<{ id: string }>(`/api/documents/${id}`, { method: 'DELETE' });
  },
};

// Chats
export const chats = {
  create(data: { companyName: string; serviceType: string; currentPrice?: number; targetPrice?: number; documentId?: string }) {
    return request<Chat>('/api/chats', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  list(page = 1, limit = 20) {
    return request<Chat[]>(`/api/chats?page=${page}&limit=${limit}`);
  },
  get(id: string) {
    return request<ChatDetail>(`/api/chats/${id}`);
  },
  update(id: string, data: Partial<{ companyName: string; serviceType: string; currentPrice: number; targetPrice: number; status: string }>) {
    return request<Chat>(`/api/chats/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  sendMessage(chatId: string, content: string) {
    return request<Message>(`/api/chats/${chatId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },
};

// Calls
export const calls = {
  initiate(chatId: string) {
    return request<CallLog>(`/api/chats/${chatId}/call`, {
      method: 'POST',
    });
  },
  getStatus(chatId: string) {
    return request<CallLog>(`/api/chats/${chatId}/call`);
  },
};

// Settlements
export const settlements = {
  list() {
    return request<Settlement[]>('/api/settlements');
  },
  create(data: { callLogId: string; amount: number; solanaTxSignature?: string }) {
    return request<Settlement>('/api/settlements', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// Users
export const users = {
  getProfile() {
    return request<User>('/api/users/me');
  },
  updateProfile(data: { displayName?: string; solanaAddress?: string }) {
    return request<User>('/api/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
};
