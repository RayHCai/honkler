import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Inbox, ChevronRight } from 'lucide-react';
import Header from '../components/layout/Header';
import { chats } from '../lib/api';
import type { Chat, ChatStatus } from '../types/api';
import './Conversations.css';

const filters: { label: string; value: ChatStatus | 'ALL' }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Researching', value: 'RESEARCHING' },
  { label: 'In Call', value: 'CALLING' },
  { label: 'Completed', value: 'COMPLETED' },
];

export default function Conversations() {
  const [chatList, setChatList] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ChatStatus | 'ALL'>('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    chats.list(1, 50).then(setChatList).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = chatList.filter(c => {
    if (filter !== 'ALL' && c.status !== filter) return false;
    if (search && !c.companyName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <>
      <Header title="Negotiations" subtitle="Track your active and completed calls" />
      <div className="page-content">
        <div className="conversations-controls">
          <input
            type="text"
            className="conversations-search"
            placeholder="Search by company..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="filter-group">
            {filters.map(f => (
              <button
                key={f.value}
                className={`filter-btn ${filter === f.value ? 'active' : ''}`}
                onClick={() => setFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="empty-state"><p>Loading...</p></div>
        ) : filtered.length === 0 ? (
          <div className="conversations-empty">
            <Inbox size={24} strokeWidth={1.5} />
            <h3>No negotiations found</h3>
            <p>Upload a bill to start your first negotiation.</p>
          </div>
        ) : (
          <table className="conversations-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Service</th>
                <th>Price</th>
                <th>Status</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(chat => (
                <tr key={chat.id}>
                  <td>
                    <Link to={`/conversations/${chat.id}`} className="conversation-link">
                      {chat.companyName}
                    </Link>
                  </td>
                  <td className="cell-muted">{chat.serviceType}</td>
                  <td className="cell-muted">
                    {chat.currentPrice && (
                      <>
                        ${parseFloat(chat.currentPrice).toFixed(2)}
                        {chat.targetPrice && (
                          <span className="price-target"> / ${parseFloat(chat.targetPrice).toFixed(2)}</span>
                        )}
                      </>
                    )}
                  </td>
                  <td>
                    <span className={`status-tag status-${chat.status.toLowerCase()}`}>
                      {chat.status}
                    </span>
                  </td>
                  <td className="cell-muted">{new Date(chat.createdAt).toLocaleDateString()}</td>
                  <td>
                    <Link to={`/conversations/${chat.id}`} className="row-arrow">
                      <ChevronRight size={14} strokeWidth={1.5} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
