import { useEffect, useRef } from 'react';
import { Phone, PhoneOff, LoaderCircle, CheckCircle, XCircle } from 'lucide-react';
import type { TranscriptionStreamState } from '../hooks/useTranscriptionStream';
import './LiveTranscript.css';

interface Props {
  stream: TranscriptionStreamState;
  companyName?: string;
}

export default function LiveTranscript({ stream, companyName }: Props) {
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new or updated transcripts
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [stream.transcripts]);

  return (
    <section className="live-transcript">
      <div className="panel-header">
        <h2>Live Call</h2>
        <TranscriptStatus status={stream.callStatus} />
      </div>

      {stream.transcripts.length === 0 && stream.callStatus === 'connecting' && (
        <div className="transcript-connecting">
          <LoaderCircle size={14} strokeWidth={1.5} className="transcript-spinner" />
          <span>Connecting to call...</span>
        </div>
      )}

      {stream.transcripts.length === 0 && stream.callStatus === 'connected' && (
        <div className="transcript-connecting">
          <Phone size={14} strokeWidth={1.5} />
          <span>Call in progress, waiting for speech...</span>
        </div>
      )}

      {stream.transcripts.length > 0 && (
        <div ref={listRef} className="transcript-list">
          {stream.transcripts.map((entry, i) => (
            <div key={i} className={`transcript-entry transcript-${entry.role}`}>
              <span className="transcript-role">
                {entry.role === 'agent' ? 'Agent' : (companyName || 'Customer')}
              </span>
              <p className="transcript-text">{entry.text}</p>
            </div>
          ))}
        </div>
      )}

      {stream.callStatus === 'complete' && stream.outcome && (
        <div className={`transcript-outcome ${stream.outcome.success ? 'outcome-success' : 'outcome-failed'}`}>
          {stream.outcome.success ? (
            <CheckCircle size={14} strokeWidth={1.5} />
          ) : (
            <XCircle size={14} strokeWidth={1.5} />
          )}
          <div className="outcome-details">
            <span className="outcome-title">
              {stream.outcome.success ? 'Negotiation successful' : 'Negotiation unsuccessful'}
            </span>
            {stream.outcome.agreement_summary && (
              <p className="outcome-summary">{stream.outcome.agreement_summary}</p>
            )}
            {stream.outcome.success && stream.outcome.savings_achieved != null && (
              <span className="outcome-savings">
                Savings: ${stream.outcome.savings_achieved.toFixed(2)}/mo
                {stream.outcome.agreed_price != null && (
                  <> &middot; New price: ${stream.outcome.agreed_price.toFixed(2)}/mo</>
                )}
              </span>
            )}
          </div>
        </div>
      )}

      {stream.callStatus === 'failed' && (
        <div className="transcript-outcome outcome-failed">
          <PhoneOff size={14} strokeWidth={1.5} />
          <span className="outcome-title">Call failed: {stream.failReason ?? 'unknown'}</span>
        </div>
      )}

      {stream.callStatus === 'disconnected' && (
        <div className="transcript-connecting">
          <LoaderCircle size={14} strokeWidth={1.5} className="transcript-spinner" />
          <span>Call ended. Checking results...</span>
        </div>
      )}
    </section>
  );
}

function TranscriptStatus({ status }: { status: TranscriptionStreamState['callStatus'] }) {
  switch (status) {
    case 'connecting':
      return <span className="transcript-status transcript-status-connecting"><LoaderCircle size={10} strokeWidth={1.5} className="transcript-spinner" /> Connecting</span>;
    case 'connected':
      return <span className="transcript-status transcript-status-active"><Phone size={10} strokeWidth={1.5} /> Live</span>;
    case 'complete':
      return <span className="transcript-status transcript-status-complete">Complete</span>;
    case 'failed':
      return <span className="transcript-status transcript-status-failed">Failed</span>;
    case 'disconnected':
      return <span className="transcript-status transcript-status-failed">Disconnected</span>;
  }
}
