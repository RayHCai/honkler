import { useEffect, useRef, useState, useCallback } from 'react';

export interface ResearchStepState {
  name: string;
  label: string;
  status: 'pending' | 'active' | 'done';
  thinking: string;
}

export interface ResearchStreamState {
  steps: ResearchStepState[];
  currentStep: string | null;
  isComplete: boolean;
  error: string | null;
}

interface SSEEvent {
  event: string;
  step?: string;
  label?: string;
  content?: string;
  data?: Record<string, unknown>;
  plan?: Record<string, unknown>;
  message?: string;
}

const INITIAL_STATE: ResearchStreamState = {
  steps: [],
  currentStep: null,
  isComplete: false,
  error: null,
};

export default function useResearchStream(
  taskId: string | null,
  enabled: boolean,
): ResearchStreamState {
  const [state, setState] = useState<ResearchStreamState>(INITIAL_STATE);
  const sourceRef = useRef<EventSource | null>(null);

  const handleEvent = useCallback((raw: string) => {
    let evt: SSEEvent;
    try {
      evt = JSON.parse(raw);
    } catch {
      return;
    }

    setState(prev => {
      switch (evt.event) {
        case 'step_start': {
          const name = evt.step ?? '';
          const exists = prev.steps.some(s => s.name === name);
          const steps = exists
            ? prev.steps.map(s =>
                s.name === name ? { ...s, status: 'active' as const, label: evt.label ?? s.label } : s,
              )
            : [...prev.steps, { name, label: evt.label ?? name, status: 'active' as const, thinking: '' }];
          return { ...prev, steps, currentStep: name };
        }

        case 'gemini_thinking': {
          const name = evt.step ?? '';
          return {
            ...prev,
            steps: prev.steps.map(s =>
              s.name === name ? { ...s, thinking: s.thinking + (evt.content ?? '') } : s,
            ),
          };
        }

        case 'step_complete': {
          const name = evt.step ?? '';
          return {
            ...prev,
            steps: prev.steps.map(s =>
              s.name === name ? { ...s, status: 'done' as const } : s,
            ),
          };
        }

        case 'research_complete':
          return { ...prev, isComplete: true, currentStep: null };

        case 'error':
          return { ...prev, error: evt.message ?? 'Research failed' };

        default:
          return prev;
      }
    });
  }, []);

  useEffect(() => {
    if (!taskId || !enabled) {
      setState(INITIAL_STATE);
      return;
    }

    const source = new EventSource(`/stream/research/${taskId}`);
    sourceRef.current = source;

    source.onmessage = (e) => handleEvent(e.data);

    source.onerror = () => {
      // EventSource will auto-reconnect, but if we're done we close it
      if (sourceRef.current?.readyState === EventSource.CLOSED) {
        setState(prev => {
          if (!prev.isComplete && !prev.error) {
            return { ...prev, error: 'Stream disconnected' };
          }
          return prev;
        });
      }
    };

    return () => {
      source.close();
      sourceRef.current = null;
    };
  }, [taskId, enabled, handleEvent]);

  return state;
}
