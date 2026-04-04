import { useState, type FormEvent } from 'react';
import { CircleCheck } from 'lucide-react';
import Header from '../components/layout/Header';
import { useAuth } from '../contexts/AuthContext';
import { users } from '../lib/api';
import './Settings.css';

export default function Settings() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await users.updateProfile({ displayName: displayName || undefined });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Header title="Settings" subtitle="Account and preferences" />
      <div className="page-content">
        <div className="settings-layout">
          <section className="settings-section">
            <div className="settings-section-header">
              <h2>Profile</h2>
            </div>
            <form onSubmit={handleSave} className="settings-form">
              <div className="form-field">
                <label>Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  className="form-input"
                />
              </div>
              <div className="form-field">
                <label>Email</label>
                <input
                  type="email"
                  value={user?.email || ''}
                  className="form-input"
                  disabled
                />
              </div>
              {error && <div className="settings-error">{error}</div>}
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saved ? <><CircleCheck size={14} strokeWidth={1.5} /> Saved</> : saving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </section>

          <section className="settings-section">
            <div className="settings-section-header">
              <h2>Notifications</h2>
            </div>
            <div className="settings-toggles">
              <div className="toggle-row">
                <span>Email notifications</span>
                <div className="toggle disabled" />
              </div>
              <div className="toggle-row">
                <span>Call completion alerts</span>
                <div className="toggle disabled" />
              </div>
              <div className="toggle-row">
                <span>Savings reports</span>
                <div className="toggle disabled" />
              </div>
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section-header">
              <h2>Security</h2>
            </div>
            <div className="form-field">
              <label>Password</label>
              <button className="btn btn-outline" type="button">Change Password</button>
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section-header">
              <h2>Billing</h2>
            </div>
            <div className="empty-state">
              <p>No billing information configured.</p>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
