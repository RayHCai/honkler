import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownRight,
  Receipt,
  PhoneOutgoing,
  Coins,
  ChevronRight,
} from 'lucide-react';
import Header from '../components/layout/Header';
import { documents, chats, settlements } from '../lib/api';
import type { Document, Chat, Settlement } from '../types/api';
import './Dashboard.css';

export default function Dashboard() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [chatList, setChatList] = useState<Chat[]>([]);
  const [settlementList, setSettlementList] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      documents.list().catch(() => [] as Document[]),
      chats.list(1, 10).catch(() => [] as Chat[]),
      settlements.list().catch(() => [] as Settlement[]),
    ]).then(([d, c, s]) => {
      setDocs(d);
      setChatList(c);
      setSettlementList(s);
    }).finally(() => setLoading(false));
  }, []);

  const totalSaved = settlementList
    .filter(s => s.status === 'CONFIRMED')
    .reduce((sum, s) => sum + parseFloat(s.amount), 0);

  const pendingSavings = settlementList
    .filter(s => s.status === 'PENDING' || s.status === 'PROCESSING')
    .reduce((sum, s) => sum + parseFloat(s.amount), 0);

  const callsMade = chatList.reduce((sum, c) => sum + (c._count?.callLogs || 0), 0);

  const stats = [
    { label: 'Total Saved', value: `$${totalSaved.toFixed(2)}`, icon: ArrowDownRight },
    { label: 'Bills Uploaded', value: String(docs.length), icon: Receipt },
    { label: 'Calls Made', value: String(callsMade), icon: PhoneOutgoing },
    { label: 'Pending', value: `$${pendingSavings.toFixed(2)}`, icon: Coins },
  ];

  const activeNegotiations = chatList.filter(c =>
    c.status === 'RESEARCHING' || c.status === 'READY' || c.status === 'CALLING'
  );

  const recentChats = chatList.slice(0, 5);

  return (
    <>
      <Header title="Overview" subtitle="Your negotiation summary" />
      <div className="page-content">
        <div className="stats-row">
          {stats.map((stat) => (
            <div className="stat-item" key={stat.label}>
              <div className="stat-item-top">
                <stat.icon size={15} strokeWidth={1.5} />
                <span className="stat-label">{stat.label}</span>
              </div>
              <span className="stat-value">{loading ? '--' : stat.value}</span>
            </div>
          ))}
        </div>

        <div className="dashboard-columns">
          <section className="dash-section">
            <div className="section-header">
              <h2>Recent Activity</h2>
              <Link to="/conversations" className="section-link">View all <ChevronRight size={13} /></Link>
            </div>
            {recentChats.length === 0 ? (
              <div className="empty-state">
                <p>No activity yet. Upload a bill to get started.</p>
              </div>
            ) : (
              <div className="activity-list">
                {recentChats.map(chat => (
                  <Link to={`/conversations/${chat.id}`} key={chat.id} className="activity-row">
                    <div className="activity-left">
                      <span className="activity-company">{chat.companyName}</span>
                      <span className="activity-service">{chat.serviceType}</span>
                    </div>
                    <span className={`status-tag status-${chat.status.toLowerCase()}`}>
                      {chat.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="dash-section">
            <div className="section-header">
              <h2>Active Negotiations</h2>
            </div>
            {activeNegotiations.length === 0 ? (
              <div className="empty-state">
                <p>No active negotiations.</p>
              </div>
            ) : (
              <div className="activity-list">
                {activeNegotiations.map(chat => (
                  <Link to={`/conversations/${chat.id}`} key={chat.id} className="activity-row">
                    <div className="activity-left">
                      <span className="activity-company">{chat.companyName}</span>
                      <span className="activity-service">{chat.serviceType}</span>
                    </div>
                    <span className={`status-tag status-${chat.status.toLowerCase()}`}>
                      {chat.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
