import { Link, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
const logoImg = '/logo.png';
import './Landing.css';

function FeatherSVG({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 30 60" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M 15 0 Q 20 15 18 30 Q 16 45 15 60 Q 14 45 12 30 Q 10 15 15 0 Z" opacity="0.6" />
      <path d="M 15 10 Q 25 20 22 30" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
      <path d="M 15 20 Q 5 28 8 35" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
    </svg>
  );
}

interface Feather {
  id: number;
  x: number;
  delay: number;
  duration: number;
  size: number;
  rotation: number;
}

interface Ripple {
  id: number;
  x: number;
  delay: number;
  size: number;
}

interface HonkBubble {
  id: number;
  x: number;
  y: number;
  delay: number;
}

export default function Landing() {
  const { isAuthenticated, isLoading } = useAuth();

  const [feathers] = useState<Feather[]>(() =>
    Array.from({ length: 12 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * -15,
      duration: 8 + Math.random() * 7,
      size: 12 + Math.random() * 18,
      rotation: Math.random() * 360,
    }))
  );

  const [ripples] = useState<Ripple[]>(() =>
    Array.from({ length: 5 }, (_, i) => ({
      id: i,
      x: 10 + Math.random() * 80,
      delay: Math.random() * 6,
      size: 40 + Math.random() * 80,
    }))
  );

  const [honkBubbles, setHonkBubbles] = useState<HonkBubble[]>([]);

  useEffect(() => {
    let nextId = 0;
    const interval = setInterval(() => {
      setHonkBubbles(prev => {
        const filtered = prev.filter(b => b.delay > -3);
        if (filtered.length < 3 && Math.random() > 0.4) {
          return [...filtered, {
            id: nextId++,
            x: 10 + Math.random() * 80,
            y: 20 + Math.random() * 50,
            delay: 0,
          }];
        }
        return filtered.map(b => ({ ...b, delay: b.delay - 0.1 }));
      });
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return (
    <div className="landing-page">
      <div className="landing-bg">
        {/* Falling feathers */}
        {feathers.map(f => (
          <div
            key={f.id}
            className="landing-feather"
            style={{
              '--feather-x': `${f.x}%`,
              '--feather-delay': `${f.delay}s`,
              '--feather-duration': `${f.duration}s`,
              '--feather-size': `${f.size}px`,
              '--feather-rotation': `${f.rotation}deg`,
            } as React.CSSProperties}
          >
            <FeatherSVG />
          </div>
        ))}

        {/* Pond ripples at bottom */}
        <div className="landing-pond">
          {ripples.map(r => (
            <div
              key={r.id}
              className="landing-ripple"
              style={{
                '--ripple-x': `${r.x}%`,
                '--ripple-delay': `${r.delay}s`,
                '--ripple-size': `${r.size}px`,
              } as React.CSSProperties}
            />
          ))}
        </div>

        {/* Honk bubbles */}
        {honkBubbles.map(b => (
          <div
            key={b.id}
            className="landing-honk"
            style={{
              left: `${b.x}%`,
              top: `${b.y}%`,
            }}
          >
            HONK
          </div>
        ))}
      </div>

      <div className="landing-content">
        <img src={logoImg} alt="Honkler" className="landing-logo" />
        <h1 className="landing-name">Honkler</h1>
        <p className="landing-tagline">Your AI negotiation companion</p>
        <Link to="/login" className="landing-login-btn">
          Sign In
        </Link>
      </div>
    </div>
  );
}
