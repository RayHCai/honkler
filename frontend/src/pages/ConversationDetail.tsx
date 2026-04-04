import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, ChevronDown, PhoneCall, LoaderCircle, ArrowUp, CheckCircle, XCircle, Clock, Phone as PhoneIcon } from 'lucide-react';
import Header from '../components/layout/Header';
import ResearchThinking from '../components/ResearchThinking';
import LiveTranscript from '../components/LiveTranscript';
import useResearchStream from '../hooks/useResearchStream';
import useTranscriptionStream from '../hooks/useTranscriptionStream';
import { chats, calls } from '../lib/api';
import type { ChatDetail, NegotiationPlan, CallLog } from '../types/api';
import './ConversationDetail.css';

export default function ConversationDetail() {
  const { id } = useParams<{ id: string }>();
  const [chat, setChat] = useState<ChatDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [calling, setCalling] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll messages list when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chat?.messages.length]);

  // Initial load
  useEffect(() => {
    if (!id) return;
    chats.get(id).then(setChat).catch(err => {
      setError(err instanceof Error ? err.message : 'Failed to load chat');
    }).finally(() => setLoading(false));
  }, [id]);

  // Research streaming — active when status is DRAFT or RESEARCHING
  const isResearching = chat?.status === 'DRAFT' || chat?.status === 'RESEARCHING';
  const researchStream = useResearchStream(id ?? null, !!isResearching);

  // When research stream completes, refresh chat data
  useEffect(() => {
    if (researchStream.isComplete && id) {
      chats.get(id).then(setChat).catch(() => {});
    }
  }, [researchStream.isComplete, id]);

  // Fallback polling — only when stream isn't providing data or for CALLING status
  useEffect(() => {
    if (!id || !chat) return;
    // If research streaming is active and working, skip polling for research
    if (isResearching && researchStream.steps.length > 0) return;
    // Only poll during transitional statuses
    if (chat.status !== 'RESEARCHING' && chat.status !== 'DRAFT' && chat.status !== 'CALLING') return;

    const interval = setInterval(() => {
      chats.get(id).then(updated => {
        setChat(updated);
        if (updated.status !== 'RESEARCHING' && updated.status !== 'DRAFT' && updated.status !== 'CALLING') {
          clearInterval(interval);
        }
      }).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [id, chat?.status, isResearching, researchStream.steps.length]);

  // Get the latest call log ID for transcription streaming
  const latestCallId = useMemo(() => {
    if (!chat?.callLogs.length) return null;
    const latest = chat.callLogs[chat.callLogs.length - 1];
    return latest.status === 'INITIATED' || latest.status === 'RINGING' || latest.status === 'IN_PROGRESS'
      ? latest.id
      : null;
  }, [chat?.callLogs]);

  // Transcription streaming — active when there's an active call
  const isCalling = chat?.status === 'CALLING';
  const transcriptionStream = useTranscriptionStream(latestCallId, !!isCalling);

  // Auto-scroll when transcripts update or call status changes
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcriptionStream.transcripts.length, transcriptionStream.callStatus]);

  // When call completes via stream, poll for final data (backend may take a moment to persist)
  useEffect(() => {
    if ((transcriptionStream.callStatus === 'complete' || transcriptionStream.callStatus === 'failed') && id) {
      let cancelled = false;
      const refresh = async () => {
        for (let i = 0; i < 5 && !cancelled; i++) {
          await new Promise(r => setTimeout(r, 2000));
          if (cancelled) return;
          try {
            const updated = await chats.get(id);
            if (!cancelled) setChat(updated);
            if (updated.status !== 'CALLING') return;
          } catch { /* keep trying */ }
        }
      };
      refresh();
      return () => { cancelled = true; };
    }
  }, [transcriptionStream.callStatus, id]);

  // Disconnect recovery — poll backend to determine outcome when WS drops
  useEffect(() => {
    if (transcriptionStream.callStatus !== 'disconnected' || !id) return;

    let cancelled = false;

    const recover = async () => {
      // Poll aggressively for up to ~16 seconds (8 attempts × 2s)
      for (let attempt = 0; attempt < 8 && !cancelled; attempt++) {
        if (attempt > 0) await new Promise(r => setTimeout(r, 2000));
        if (cancelled) return;

        try {
          const updated = await chats.get(id);
          if (cancelled) return;
          setChat(updated);
          // Backend resolved the call — UI will update naturally
          if (updated.status !== 'CALLING') return;
        } catch { /* keep trying */ }
      }

      // Still CALLING after timeout — assume interrupted, reset to READY
      if (!cancelled) {
        try {
          await chats.update(id, { status: 'READY' });
          if (cancelled) return;
          const fresh = await chats.get(id);
          if (!cancelled) setChat(fresh);
        } catch { /* best effort */ }
      }
    };

    recover();
    return () => { cancelled = true; };
  }, [transcriptionStream.callStatus, id]);

  const phoneNumber = chat?.companyPhone
    || (chat?.negotiationPlan as NegotiationPlan | null)?.customer_service_phone
    || null;

  async function handleSend() {
    if (!id || !input.trim() || sending) return;
    setSending(true);
    setError('');
    try {
      await chats.sendMessage(id, input.trim());
      setInput('');
      const updated = await chats.get(id);
      setChat(updated);
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    // Auto-resize textarea
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }

  async function handleCall() {
    if (!id) return;
    setCalling(true);
    setError('');
    try {
      // If chat is in a terminal state (post-call), reset to READY before retrying
      if (chat?.status === 'COMPLETED' || chat?.status === 'FAILED') {
        await chats.update(id, { status: 'READY' });
      }
      await calls.initiate(id);
      const updated = await chats.get(id);
      setChat(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Call failed');
    } finally {
      setCalling(false);
    }
  }

  if (loading) {
    return (
      <>
        <Header title="Negotiation" subtitle="Loading..." />
        <div className="page-content">
          <p className="loading-text">Loading...</p>
        </div>
      </>
    );
  }

  if (!chat) {
    return (
      <>
        <Header title="Negotiation" subtitle="Not found" />
        <div className="page-content">
          <p>{error || 'Chat not found'}</p>
          <Link to="/conversations" className="back-link"><ChevronLeft size={14} strokeWidth={1.5} /> Back to negotiations</Link>
        </div>
      </>
    );
  }

  return (
    <>
      <Header title={chat.companyName} subtitle={chat.serviceType} />
      <div className="chat-page">
        <div className="chat-scroll">
          <Link to="/conversations" className="back-link">
            <ChevronLeft size={14} strokeWidth={1.5} /> Back to negotiations
          </Link>

          <div className="chat-thread">
            {/* User messages */}
            {chat.messages.map(msg => (
              <div key={msg.id} className={`chat-message chat-message-${msg.role.toLowerCase()}`}>
                <span className="chat-message-role">{msg.role}</span>
                <p className="chat-message-body">{msg.content}</p>
                <span className="chat-message-time">{new Date(msg.createdAt).toLocaleTimeString()}</span>
              </div>
            ))}

            {/* Research thinking — streams inline in the thread */}
            <ResearchThinking
              plan={chat.negotiationPlan as NegotiationPlan | null}
              status={chat.status}
              stream={isResearching || researchStream.steps.length > 0 ? researchStream : undefined}
            />

            {/* Details card — appears after research completes */}
            {chat.negotiationPlan && (
              <div className="chat-details-card">
                <div className="chat-details-row">
                  <span className="chat-details-key">Status</span>
                  <span className={`status-tag status-${chat.status.toLowerCase()}`}>{chat.status}</span>
                </div>
                {chat.currentPrice && (
                  <div className="chat-details-row">
                    <span className="chat-details-key">Current Price</span>
                    <span className="chat-details-val">${parseFloat(chat.currentPrice).toFixed(2)}/mo</span>
                  </div>
                )}
                {chat.targetPrice && (
                  <div className="chat-details-row">
                    <span className="chat-details-key">Target Price</span>
                    <span className="chat-details-val">${parseFloat(chat.targetPrice).toFixed(2)}/mo</span>
                  </div>
                )}
                <div className="chat-details-row">
                  <span className="chat-details-key">Created</span>
                  <span className="chat-details-val">{new Date(chat.createdAt).toLocaleString()}</span>
                </div>
              </div>
            )}

            {/* Call prompt — inline permission block */}
            {chat.status === 'READY' && phoneNumber && (
              <div className="chat-permission">
                <div className="chat-permission-header">
                  <PhoneCall size={14} strokeWidth={1.5} />
                  <span>Start call with <strong>{phoneNumber}</strong>?</span>
                </div>
                <p className="chat-permission-desc">
                  The agent will call this number and negotiate on your behalf using the strategy above.
                </p>
                <div className="chat-permission-actions">
                  <button
                    className="btn btn-primary"
                    onClick={handleCall}
                    disabled={calling}
                  >
                    {calling ? (
                      <><LoaderCircle size={13} strokeWidth={1.5} className="btn-spinner" /> Calling...</>
                    ) : 'Allow'}
                  </button>
                  <Link to="/conversations" className="btn btn-secondary">
                    Deny
                  </Link>
                </div>
                {error && <div className="detail-error">{error}</div>}
              </div>
            )}

            {chat.status === 'READY' && !phoneNumber && (
              <div className="chat-permission chat-permission-warn">
                <span>No phone number found. The bill analysis could not extract a customer service number.</span>
              </div>
            )}

            {error && chat.status !== 'READY' && <div className="detail-error">{error}</div>}

            {/* Live transcript during calls */}
            {(isCalling || transcriptionStream.transcripts.length > 0) && (
              <LiveTranscript stream={transcriptionStream} companyName={chat.companyName} />
            )}

            {/* Call history */}
            {chat.callLogs.length > 0 && (
              <CallHistory logs={chat.callLogs} />
            )}

            {/* Call again prompt — shows when latest call was unsuccessful */}
            {chat.callLogs.length > 0 && phoneNumber && chat.status !== 'CALLING' && (() => {
              const latest = chat.callLogs[0];
              const latestOutcome = parseOutcome(latest.outcome);
              const isTerminal = latest.status === 'COMPLETED' || latest.status === 'FAILED' || latest.status === 'NO_ANSWER';
              const wasUnsuccessful = isTerminal && (!latestOutcome?.success);
              if (!wasUnsuccessful) return null;
              return (
                <div className="chat-permission">
                  <div className="chat-permission-header">
                    <PhoneCall size={14} strokeWidth={1.5} />
                    <span>Negotiation unsuccessful. Try calling <strong>{phoneNumber}</strong> again?</span>
                  </div>
                  <p className="chat-permission-desc">
                    The agent will call again and retry the negotiation on your behalf.
                  </p>
                  <div className="chat-permission-actions">
                    <button
                      className="btn btn-primary"
                      onClick={handleCall}
                      disabled={calling}
                    >
                      {calling ? (
                        <><LoaderCircle size={13} strokeWidth={1.5} className="btn-spinner" /> Calling...</>
                      ) : (
                        <><PhoneCall size={13} strokeWidth={1.5} /> Call Again</>
                      )}
                    </button>
                  </div>
                  {error && <div className="detail-error">{error}</div>}
                </div>
              );
            })()}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input bar */}
        <div className="chat-input-bar">
          <div className="chat-input-wrapper">
            <textarea
              ref={inputRef}
              className="chat-input"
              placeholder="Send a message..."
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={sending}
            />
            <button
              className="chat-send-btn"
              onClick={handleSend}
              disabled={!input.trim() || sending}
            >
              {sending ? (
                <LoaderCircle size={16} strokeWidth={2} className="btn-spinner" />
              ) : (
                <ArrowUp size={16} strokeWidth={2} />
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Parsed outcome shape from backend JSON ── */
interface ParsedOutcome {
  call_id?: string;
  success?: boolean;
  agreed_price?: number;
  savings_achieved?: number;
  agreement_summary?: string;
  next_steps?: string[];
  confidence?: number;
}

function parseOutcome(raw: string | null): ParsedOutcome | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ParsedOutcome;
  } catch {
    return null;
  }
}

function CallHistory({ logs }: { logs: CallLog[] }) {
  const [expanded, setExpanded] = useState(false);
  const latest = logs[0];
  const older = logs.slice(1);

  return (
    <div className="chat-call-history">
      <span className="chat-call-history-label">Call History</span>

      {older.length > 0 && (
        <>
          <button
            className="call-history-expand-btn"
            onClick={() => setExpanded(prev => !prev)}
          >
            <ChevronDown size={13} strokeWidth={1.5} className={`call-history-chevron ${expanded ? 'call-history-chevron-open' : ''}`} />
            {expanded ? 'Hide' : 'Show'} {older.length} earlier {older.length === 1 ? 'call' : 'calls'}
          </button>

          {expanded && older.map(log => (
            <CallLogCard key={log.id} log={log} />
          ))}
        </>
      )}

      <CallLogCard log={latest} />
    </div>
  );
}

function CallLogCard({ log }: { log: CallLog }) {
  const outcome = parseOutcome(log.outcome);
  const isTerminal = log.status === 'COMPLETED' || log.status === 'FAILED' || log.status === 'NO_ANSWER';

  return (
    <div className={`call-log-card ${isTerminal && outcome ? 'call-log-card-has-outcome' : ''}`}>
      {/* Header row */}
      <div className="call-log-header">
        <div className="call-log-header-left">
          {log.status === 'COMPLETED' && outcome?.success ? (
            <CheckCircle size={14} strokeWidth={1.5} className="call-log-icon call-log-icon-success" />
          ) : log.status === 'FAILED' || log.status === 'NO_ANSWER' ? (
            <XCircle size={14} strokeWidth={1.5} className="call-log-icon call-log-icon-failed" />
          ) : (
            <PhoneIcon size={14} strokeWidth={1.5} className="call-log-icon call-log-icon-active" />
          )}
          <span className={`status-tag status-${log.status.toLowerCase()}`}>{log.status}</span>
          {log.duration != null && (
            <span className="call-log-duration">
              <Clock size={11} strokeWidth={1.5} />
              {Math.floor(log.duration / 60)}m {log.duration % 60}s
            </span>
          )}
        </div>
        <span className="call-log-date">{new Date(log.createdAt).toLocaleString()}</span>
      </div>

      {/* Outcome details table */}
      {outcome && (
        <div className="call-log-outcome">
          <table className="call-log-table">
            <tbody>
              <tr>
                <td className="call-log-table-key">Result</td>
                <td className={`call-log-table-val ${outcome.success ? 'val-success' : 'val-failed'}`}>
                  {outcome.success ? 'Negotiation Successful' : 'Negotiation Unsuccessful'}
                </td>
              </tr>
              {outcome.agreed_price != null && (
                <tr>
                  <td className="call-log-table-key">New Price</td>
                  <td className="call-log-table-val">${outcome.agreed_price.toFixed(2)}/mo</td>
                </tr>
              )}
              {outcome.savings_achieved != null && (
                <tr>
                  <td className="call-log-table-key">Savings</td>
                  <td className="call-log-table-val val-success">${outcome.savings_achieved.toFixed(2)}/mo</td>
                </tr>
              )}
              {outcome.confidence != null && (
                <tr>
                  <td className="call-log-table-key">Confidence</td>
                  <td className="call-log-table-val">{Math.round(outcome.confidence * 100)}%</td>
                </tr>
              )}
            </tbody>
          </table>

          {outcome.agreement_summary && (
            <div className="call-log-summary">
              <span className="call-log-summary-label">Summary</span>
              <p>{outcome.agreement_summary}</p>
            </div>
          )}

          {outcome.next_steps && outcome.next_steps.length > 0 && (
            <div className="call-log-next-steps">
              <span className="call-log-summary-label">Next Steps</span>
              <ul>
                {outcome.next_steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Raw outcome fallback for non-JSON outcomes */}
      {!outcome && log.outcome && (
        <div className="call-log-raw-outcome">
          <span className="call-log-meta">{log.outcome}</span>
        </div>
      )}

      {/* Transcript */}
      {log.transcript && (
        <details className="call-transcript">
          <summary>View transcript</summary>
          <p>{log.transcript}</p>
        </details>
      )}
    </div>
  );
}
