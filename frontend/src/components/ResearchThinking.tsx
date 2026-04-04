import { useState, useEffect, useRef } from 'react';
import {
  Minus,
  Plus,
  Globe,
  ScanLine,
  Crosshair,
  Zap,
  ArrowUpRight,
  LoaderCircle,
  Brain,
} from 'lucide-react';
import type { NegotiationPlan, ChatStatus } from '../types/api';
import type { ResearchStreamState } from '../hooks/useResearchStream';
import './ResearchThinking.css';

interface Props {
  plan: NegotiationPlan | null;
  status: ChatStatus;
  stream?: ResearchStreamState;
}

export default function ResearchThinking({ plan, status, stream }: Props) {
  const isResearching = status === 'DRAFT' || status === 'RESEARCHING';
  const isComplete = plan !== null;

  const steps = getSteps(status, plan, stream);

  // Show thinking animation when researching but no stream data yet
  const showThinking = isResearching && (!stream || stream.steps.length === 0);

  return (
    <div className="research-container">
      <ResearchHeader isResearching={isResearching} isComplete={isComplete} />
      {showThinking && <ThinkingIndicator />}
      <div className="research-steps">
        {steps.map((step, i) => (
          <ResearchStep key={step.key ?? i} step={step} defaultOpen={isComplete && i === steps.length - 1} />
        ))}
      </div>
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="thinking-indicator">
      <div className="thinking-indicator-content">
        <span className="thinking-indicator-text">Thinking</span>
        <span className="thinking-indicator-dots">
          <span className="thinking-dot" />
          <span className="thinking-dot" />
          <span className="thinking-dot" />
        </span>
      </div>
      <div className="thinking-shimmer" />
    </div>
  );
}

function ResearchHeader({ isResearching, isComplete }: { isResearching: boolean; isComplete: boolean }) {
  return (
    <div className="research-header">
      {isResearching ? (
        <>
          <LoaderCircle size={13} strokeWidth={1.5} className="research-spinner" />
          <span className="research-title">Researching negotiation strategy...</span>
        </>
      ) : isComplete ? (
        <>
          <Zap size={13} strokeWidth={1.5} className="research-icon-done" />
          <span className="research-title">Research complete</span>
        </>
      ) : (
        <>
          <Zap size={13} strokeWidth={1.5} className="research-icon-muted" />
          <span className="research-title research-title-muted">Waiting for research</span>
        </>
      )}
    </div>
  );
}

interface StepData {
  key?: string;
  icon: React.ReactNode;
  label: string;
  status: 'done' | 'active' | 'pending';
  content: React.ReactNode | null;
  thinking?: string;
}

function ResearchStep({ step, defaultOpen }: { step: StepData; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen && step.status === 'done');
  const [thinkingOpen, setThinkingOpen] = useState(false);

  const canToggle = step.status === 'done' && step.content;
  const hasThinking = !!step.thinking;

  // Auto-open thinking while step is active and has content
  useEffect(() => {
    if (step.status === 'active' && step.thinking) {
      setThinkingOpen(true);
    }
  }, [step.status, step.thinking]);

  return (
    <div className={`research-step research-step-${step.status}`}>
      <button
        className="research-step-header"
        onClick={() => canToggle && setOpen(!open)}
        disabled={!canToggle}
      >
        <span className="research-step-indicator">
          {step.status === 'active' ? (
            <LoaderCircle size={11} strokeWidth={1.5} className="research-spinner" />
          ) : step.status === 'done' ? (
            <span className="research-step-check">&#10003;</span>
          ) : (
            <span className="research-step-dot" />
          )}
        </span>
        <span className="research-step-icon">{step.icon}</span>
        <span className="research-step-label">{step.label}</span>
        {canToggle && (
          <span className="research-step-toggle">
            {open ? <Minus size={12} strokeWidth={1.5} /> : <Plus size={12} strokeWidth={1.5} />}
          </span>
        )}
      </button>

      {/* Gemini thinking section */}
      {hasThinking && (
        <ThinkingSection
          thinking={step.thinking!}
          isActive={step.status === 'active'}
          open={thinkingOpen}
          onToggle={() => setThinkingOpen(!thinkingOpen)}
        />
      )}

      {open && step.content && (
        <div className="research-step-content">{step.content}</div>
      )}
    </div>
  );
}

function ThinkingSection({
  thinking,
  isActive,
  open,
  onToggle,
}: {
  thinking: string;
  isActive: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const textRef = useRef<HTMLPreElement>(null);

  // Auto-scroll thinking text while streaming
  useEffect(() => {
    if (open && isActive && textRef.current) {
      textRef.current.scrollTop = textRef.current.scrollHeight;
    }
  }, [thinking, open, isActive]);

  return (
    <div className="thinking-section">
      <button className="thinking-toggle" onClick={onToggle}>
        <Brain size={11} strokeWidth={1.5} />
        <span>Gemini reasoning</span>
        {isActive && <LoaderCircle size={10} strokeWidth={1.5} className="research-spinner" />}
        <span className="thinking-toggle-icon">
          {open ? <Minus size={10} strokeWidth={1.5} /> : <Plus size={10} strokeWidth={1.5} />}
        </span>
      </button>
      {open && (
        <pre ref={textRef} className={`thinking-text ${isActive ? 'thinking-text-streaming' : ''}`}>
          {thinking}
          {isActive && <span className="thinking-cursor" />}
        </pre>
      )}
    </div>
  );
}

function getSteps(status: ChatStatus, plan: NegotiationPlan | null, stream?: ResearchStreamState): StepData[] {
  const isResearching = status === 'DRAFT' || status === 'RESEARCHING';

  // If streaming data available, use it for step status
  if (stream && stream.steps.length > 0) {
    const stepConfigs: { name: string; icon: React.ReactNode; pendingLabel: string; activeLabel: string; doneLabel: string }[] = [
      { name: 'bill_extraction', icon: <ScanLine size={13} strokeWidth={1.5} />, pendingLabel: 'Extract bill details', activeLabel: 'Extracting bill details...', doneLabel: 'Bill details extracted' },
      { name: 'bill_analysis', icon: <ScanLine size={13} strokeWidth={1.5} />, pendingLabel: 'Analyze bill document', activeLabel: 'Analyzing bill document...', doneLabel: 'Bill analyzed' },
      { name: 'market_research', icon: <Globe size={13} strokeWidth={1.5} />, pendingLabel: 'Research competitors & promotions', activeLabel: 'Researching competitors...', doneLabel: 'Competitors & promotions researched' },
      { name: 'strategy', icon: <Crosshair size={13} strokeWidth={1.5} />, pendingLabel: 'Build negotiation strategy', activeLabel: 'Building negotiation strategy...', doneLabel: 'Negotiation strategy ready' },
    ];

    const streamStepMap = new Map(stream.steps.map(s => [s.name, s]));

    // Build step list from actual stream events
    const steps: StepData[] = [];
    for (const cfg of stepConfigs) {
      const ss = streamStepMap.get(cfg.name);
      if (!ss) continue; // Only show steps that have actually started

      const stepStatus = ss.status;
      const label = stepStatus === 'active' ? cfg.activeLabel
        : stepStatus === 'done' ? cfg.doneLabel
        : cfg.pendingLabel;

      let content: React.ReactNode | null = null;
      if (stepStatus === 'done' && plan) {
        if (cfg.name === 'bill_extraction' || cfg.name === 'bill_analysis') {
          content = <BillAnalysisContent plan={plan} />;
        } else if (cfg.name === 'market_research') {
          content = <CompetitorContent plan={plan} />;
        } else if (cfg.name === 'strategy') {
          content = <StrategyContent plan={plan} />;
        }
      }

      steps.push({
        key: cfg.name,
        icon: cfg.icon,
        label,
        status: stepStatus,
        content,
        thinking: ss.thinking || undefined,
      });
    }

    // Add pending steps that haven't started yet
    const shownNames = new Set(steps.map(s => s.key));
    if (!shownNames.has('market_research') && !stream.isComplete) {
      steps.push({ key: 'market_research', icon: <Globe size={13} strokeWidth={1.5} />, label: 'Research competitors & promotions', status: 'pending', content: null });
    }
    if (!shownNames.has('strategy') && !stream.isComplete) {
      steps.push({ key: 'strategy', icon: <Crosshair size={13} strokeWidth={1.5} />, label: 'Build negotiation strategy', status: 'pending', content: null });
    }

    return steps;
  }

  // Fallback: original static step rendering
  if (!plan && !isResearching) {
    return [
      { icon: <ScanLine size={13} strokeWidth={1.5} />, label: 'Analyze bill document', status: 'pending', content: null },
      { icon: <Globe size={13} strokeWidth={1.5} />, label: 'Research competitors & promotions', status: 'pending', content: null },
      { icon: <Crosshair size={13} strokeWidth={1.5} />, label: 'Build negotiation strategy', status: 'pending', content: null },
    ];
  }

  if (isResearching) {
    return [
      { icon: <ScanLine size={13} strokeWidth={1.5} />, label: 'Analyzing bill document...', status: 'active', content: null },
      { icon: <Globe size={13} strokeWidth={1.5} />, label: 'Research competitors & promotions', status: 'pending', content: null },
      { icon: <Crosshair size={13} strokeWidth={1.5} />, label: 'Build negotiation strategy', status: 'pending', content: null },
    ];
  }

  return [
    {
      icon: <ScanLine size={13} strokeWidth={1.5} />,
      label: 'Bill analyzed',
      status: 'done',
      content: <BillAnalysisContent plan={plan!} />,
    },
    {
      icon: <Globe size={13} strokeWidth={1.5} />,
      label: 'Competitors & promotions researched',
      status: 'done',
      content: <CompetitorContent plan={plan!} />,
    },
    {
      icon: <Crosshair size={13} strokeWidth={1.5} />,
      label: 'Negotiation strategy ready',
      status: 'done',
      content: <StrategyContent plan={plan!} />,
    },
  ];
}

function BillAnalysisContent({ plan }: { plan: NegotiationPlan }) {
  return (
    <div className="research-detail">
      <div className="research-detail-row">
        <span className="research-detail-key">Company</span>
        <span>{plan.company_name}</span>
      </div>
      <div className="research-detail-row">
        <span className="research-detail-key">Service</span>
        <span>{plan.service_type}</span>
      </div>
      <div className="research-detail-row">
        <span className="research-detail-key">Current price</span>
        <span className="research-price">${plan.current_price.toFixed(2)}/mo</span>
      </div>
      {plan.customer_service_phone && (
        <div className="research-detail-row">
          <span className="research-detail-key">Support line</span>
          <span>{plan.customer_service_phone}</span>
        </div>
      )}
    </div>
  );
}

function CompetitorContent({ plan }: { plan: NegotiationPlan }) {
  return (
    <div className="research-detail">
      {plan.competing_offers.length > 0 && (
        <div className="research-subsection">
          <span className="research-subsection-title">Competing offers</span>
          {plan.competing_offers.map((offer, i) => (
            <div key={i} className="research-offer">
              <div className="research-offer-header">
                <span className="research-offer-provider">{offer.provider}</span>
                <span className="research-offer-price">${offer.price.toFixed(2)}/mo</span>
              </div>
              <span className="research-offer-service">{offer.service}</span>
              {offer.notes && <span className="research-offer-notes">{offer.notes}</span>}
              {offer.url && (
                <a href={offer.url} target="_blank" rel="noopener noreferrer" className="research-offer-link">
                  <ArrowUpRight size={10} strokeWidth={1.5} /> Source
                </a>
              )}
            </div>
          ))}
        </div>
      )}
      {plan.detected_promotions.length > 0 && (
        <div className="research-subsection">
          <span className="research-subsection-title">Detected promotions</span>
          <ul className="research-list">
            {plan.detected_promotions.map((promo, i) => (
              <li key={i}>{promo}</li>
            ))}
          </ul>
        </div>
      )}
      {plan.sources.length > 0 && (
        <div className="research-subsection">
          <span className="research-subsection-title">Sources</span>
          <ul className="research-list research-list-sources">
            {plan.sources.map((src, i) => (
              <li key={i}>
                {src.startsWith('http') ? (
                  <a href={src} target="_blank" rel="noopener noreferrer">
                    <ArrowUpRight size={10} strokeWidth={1.5} /> {new URL(src).hostname}
                  </a>
                ) : (
                  src
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StrategyContent({ plan }: { plan: NegotiationPlan }) {
  return (
    <div className="research-detail">
      <p className="research-summary">{plan.summary}</p>

      <div className="research-price-targets">
        <div className="research-price-target">
          <span className="research-detail-key">Target</span>
          <span className="research-price research-price-good">${plan.target_price.toFixed(2)}/mo</span>
        </div>
        <div className="research-price-target">
          <span className="research-detail-key">Floor</span>
          <span className="research-price research-price-floor">${plan.floor_price.toFixed(2)}/mo</span>
        </div>
      </div>

      {plan.talking_points.length > 0 && (
        <div className="research-subsection">
          <span className="research-subsection-title">Talking points</span>
          <ol className="research-list research-list-numbered">
            {plan.talking_points.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ol>
        </div>
      )}

      {plan.fallback_positions.length > 0 && (
        <div className="research-subsection">
          <span className="research-subsection-title">Fallback positions</span>
          <ul className="research-list">
            {plan.fallback_positions.map((pos, i) => (
              <li key={i}>{pos}</li>
            ))}
          </ul>
        </div>
      )}

      {plan.company_retention_intel && (
        <div className="research-subsection">
          <span className="research-subsection-title">Retention intel</span>
          <p className="research-intel">{plan.company_retention_intel}</p>
        </div>
      )}
    </div>
  );
}
