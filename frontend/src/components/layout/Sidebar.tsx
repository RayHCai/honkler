import { NavLink } from 'react-router-dom';
import {
  BarChart3,
  ArrowUpFromLine,
  BookOpen,
  Banknote,
  SlidersHorizontal,
  ArrowRightFromLine,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import './Sidebar.css';

const navItems = [
  { to: '/dashboard', icon: BarChart3, label: 'Overview' },
  { to: '/upload', icon: ArrowUpFromLine, label: 'Upload' },
  { to: '/conversations', icon: BookOpen, label: 'Negotiations' },
  { to: '/wallet', icon: Banknote, label: 'Wallet' },
  { to: '/settings', icon: SlidersHorizontal, label: 'Settings' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img src="/logo.png" alt="Honkler" className="sidebar-brand-logo" />
        <span className="sidebar-brand-name">Honkler</span>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''}`
            }
            end={item.to === '/dashboard'}
          >
            <item.icon size={16} strokeWidth={1.5} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <span className="sidebar-user-name">{user?.displayName || user?.email}</span>
        </div>
        <button onClick={logout} className="sidebar-logout">
          <ArrowRightFromLine size={14} strokeWidth={1.5} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
