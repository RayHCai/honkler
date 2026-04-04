import { useState, useEffect } from 'react';
import { Link2, CircleCheck } from 'lucide-react';
import Header from '../components/layout/Header';
import { useAuth } from '../contexts/AuthContext';
import { settlements, users } from '../lib/api';
import type { Settlement } from '../types/api';
import './Wallet.css';

export default function Wallet() {
  const { user } = useAuth();
  const [settlementList, setSettlementList] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [walletInput, setWalletInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settlements.list().then(setSettlementList).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handleConnectWallet() {
    if (!walletInput.trim()) return;
    setSaving(true);
    try {
      await users.updateProfile({ solanaAddress: walletInput.trim() });
      window.location.reload();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  const totalEarned = settlementList
    .filter(s => s.status === 'CONFIRMED')
    .reduce((sum, s) => sum + parseFloat(s.amount), 0);

  return (
    <>
      <Header title="Wallet" subtitle="Manage payments and wallet connection" />
      <div className="page-content">
        <div className="wallet-connection">
          {user?.solanaAddress ? (
            <div className="wallet-connected">
              <CircleCheck size={18} strokeWidth={1.5} className="wallet-check-icon" />
              <div className="wallet-connected-info">
                <span className="wallet-connected-label">Wallet Connected</span>
                <span className="wallet-address">{user.solanaAddress}</span>
              </div>
            </div>
          ) : (
            <div className="wallet-connect-prompt">
              <div className="wallet-prompt-text">
                <Link2 size={16} strokeWidth={1.5} />
                <div>
                  <span className="wallet-prompt-heading">Connect Wallet</span>
                  <span className="wallet-prompt-desc">Link your Solana address for x402 micropayments</span>
                </div>
              </div>
              <div className="wallet-connect-form">
                <input
                  type="text"
                  className="wallet-input"
                  placeholder="Solana wallet address"
                  value={walletInput}
                  onChange={e => setWalletInput(e.target.value)}
                />
                <button className="btn btn-primary" onClick={handleConnectWallet} disabled={saving || !walletInput.trim()}>
                  {saving ? 'Saving...' : 'Connect'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="wallet-grid">
          <section className="wallet-balance">
            <div className="panel-header">
              <h2>Total Earned</h2>
            </div>
            <div className="balance-figure">
              <span className="balance-amount">{loading ? '--' : `$${totalEarned.toFixed(2)}`}</span>
            </div>
          </section>

          <section className="wallet-transactions">
            <div className="panel-header">
              <h2>Transactions</h2>
            </div>
            {loading ? (
              <div className="empty-state"><p>Loading...</p></div>
            ) : settlementList.length === 0 ? (
              <div className="empty-state"><p>No transactions yet.</p></div>
            ) : (
              <table className="tx-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Amount</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {settlementList.map(s => (
                    <tr key={s.id}>
                      <td>
                        <span className={`status-tag status-${s.status.toLowerCase()}`}>{s.status}</span>
                      </td>
                      <td className="tx-amount">${parseFloat(s.amount).toFixed(2)}</td>
                      <td className="cell-muted">{new Date(s.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
