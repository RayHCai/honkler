import { useEffect, useRef, useState, useCallback } from 'react';

export interface TranscriptEntry {
  role: string;
  text: string;
  timestamp: number;
}

export interface CallOutcomeData {
  success: boolean;
  agreed_price?: number;
  savings_achieved?: number;
  agreement_summary?: string;
  confidence?: number;
}

export interface TranscriptionStreamState {
  transcripts: TranscriptEntry[];
  callStatus: 'connecting' | 'connected' | 'complete' | 'failed' | 'disconnected';
  outcome: CallOutcomeData | null;
  failReason: string | null;
}

const INITIAL_STATE: TranscriptionStreamState = {
  transcripts: [],
  callStatus: 'connecting',
  outcome: null,
  failReason: null,
};

const MAX_RETRIES = 5;
const BASE_DELAY = 1000;

export default function useTranscriptionStream(
  callId: string | null,
  enabled: boolean,
): TranscriptionStreamState {
  const [state, setState] = useState<TranscriptionStreamState>(INITIAL_STATE);
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const terminalRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(false);

  const handleMessage = useCallback((data: Record<string, unknown>) => {
    const type = data.type as string;

    if (type === 'call_complete' || type === 'call_failed') {
      terminalRef.current = true;
    }

    setState(prev => {
      switch (type) {
        case 'transcript_update':
          return {
            ...prev,
            callStatus: 'connected',
            transcripts: [
              ...prev.transcripts,
              {
                role: data.role as string,
                text: data.text as string,
                timestamp: Date.now(),
              },
            ],
          };

        case 'call_complete':
          return {
            ...prev,
            callStatus: 'complete',
            outcome: data.outcome as CallOutcomeData,
          };

        case 'call_failed':
          return {
            ...prev,
            callStatus: 'failed',
            failReason: data.status as string,
          };

        default:
          return prev;
      }
    });
  }, []);

  const connect = useCallback((id: string) => {
    if (!activeRef.current) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/transcription/${id}`);
    wsRef.current = ws;

    ws.onopen = () => {
      retriesRef.current = 0;
      setState(prev => ({ ...prev, callStatus: 'connected' }));
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        handleMessage(data);
      } catch { /* ignore malformed messages */ }
    };

    ws.onclose = (e) => {
      // Don't touch state if effect was cleaned up or call already reached a terminal state
      if (!activeRef.current || terminalRef.current) return;

      // Normal close or call-not-found without a terminal message — mark disconnected, skip retries
      if (e.code === 1000 || e.code === 4004) {
        setState(prev => {
          if (prev.callStatus === 'complete' || prev.callStatus === 'failed') return prev;
          return { ...prev, callStatus: 'disconnected' };
        });
        return;
      }

      setState(prev => {
        if (prev.callStatus === 'complete' || prev.callStatus === 'failed') {
          return prev;
        }

        // Retry with backoff
        if (retriesRef.current < MAX_RETRIES) {
          const delay = BASE_DELAY * Math.pow(2, retriesRef.current);
          retriesRef.current++;
          retryTimerRef.current = setTimeout(() => connect(id), delay);
          return { ...prev, callStatus: 'connecting' };
        }

        return { ...prev, callStatus: 'disconnected' };
      });
    };

    ws.onerror = () => {
      // onclose will fire after onerror
    };
  }, [handleMessage]);

  useEffect(() => {
    if (!callId || !enabled) {
      setState(INITIAL_STATE);
      return;
    }

    retriesRef.current = 0;
    terminalRef.current = false;
    activeRef.current = true;
    setState(INITIAL_STATE);
    connect(callId);

    return () => {
      activeRef.current = false;
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [callId, enabled, connect]);

  return state;
}
