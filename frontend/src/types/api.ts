export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    page: number;
    limit: number;
    total: number;
  };
}

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  solanaAddress: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthPayload {
  user: User;
  token: string;
}

export interface Document {
  id: string;
  userId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  filePath: string;
  fileUrl: string;
  createdAt: string;
  chat?: { id: string };
}

export interface CompetingOffer {
  provider: string;
  service: string;
  price: number;
  url: string | null;
  notes: string | null;
}

export interface NegotiationPlan {
  company_name: string;
  service_type: string;
  customer_service_phone: string;
  summary: string;
  current_price: number;
  target_price: number;
  floor_price: number;
  competing_offers: CompetingOffer[];
  talking_points: string[];
  fallback_positions: string[];
  detected_promotions: string[];
  company_retention_intel: string;
  sources: string[];
}

export type ChatStatus = 'DRAFT' | 'RESEARCHING' | 'READY' | 'CALLING' | 'COMPLETED' | 'FAILED';

export interface Chat {
  id: string;
  userId: string;
  status: ChatStatus;
  companyName: string;
  serviceType: string;
  companyPhone: string | null;
  currentPrice: string | null;
  targetPrice: string | null;
  negotiationPlan: NegotiationPlan | null;
  createdAt: string;
  updatedAt: string;
  _count?: { messages: number; callLogs: number };
}

export interface ChatDetail extends Chat {
  messages: Message[];
  callLogs: CallLog[];
}

export interface Message {
  id: string;
  chatId: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'AGENT';
  content: string;
  createdAt: string;
}

export type CallStatus = 'INITIATED' | 'RINGING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'NO_ANSWER';

export interface CallLog {
  id: string;
  chatId: string;
  twilioCallSid: string | null;
  status: CallStatus;
  recordingUrl: string | null;
  transcript: string | null;
  duration: number | null;
  outcome: string | null;
  savingsAmount: string | null;
  createdAt: string;
}

export type SettlementStatus = 'PENDING' | 'PROCESSING' | 'CONFIRMED' | 'FAILED';

export interface Settlement {
  id: string;
  callLogId: string;
  userId: string;
  amount: string;
  solanaTxSignature: string | null;
  status: SettlementStatus;
  createdAt: string;
  callLog?: {
    id: string;
    outcome: string | null;
    savingsAmount: string | null;
  };
}
