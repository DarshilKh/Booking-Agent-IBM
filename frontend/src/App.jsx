import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import './styles.css';
import { AuthProvider, useAuth } from './auth/AuthContext';
import Header from './components/Header';
import Hero from './components/Hero';
import Tabs from './components/Tabs';
import CustomerChat from './components/CustomerChat';
import BookingForm from './components/BookingForm';
import StatusLookup from './components/StatusLookup';
import Footer from './components/Footer';
import TicketStub from './components/TicketStub';
import LoginPanel from './components/LoginPanel';
import AdminDashboard from './components/AdminDashboard';
import AgentChat from './components/AgentChat';

const CUSTOMER_TABS = [
  { key: 'chat', label: 'Chat with us' },
  { key: 'book', label: 'Manual form' },
  { key: 'lookup', label: 'Find my booking' },
];

function CustomerFlow() {
  const [tab, setTab] = useState('chat');
  const [confirmed, setConfirmed] = useState(null);

  const startNewBooking = () => {
    setConfirmed(null);
    setTab('chat');
  };

  return (
    <>
      <Hero />
      <main className="wrap" style={{ paddingBottom: 40 }}>
        <AnimatePresence mode="wait">
          {confirmed ? (
            <motion.div
              key="confirmation"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 16,
                  color: 'var(--success)',
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                <CheckCircle2 size={18} />
                Request sent — here's your stub
              </div>
              <TicketStub booking={confirmed} />
              <div className="result-actions">
                <button className="btn btn--ghost" style={{ width: 'auto' }} onClick={startNewBooking}>
                  Book another appointment
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="flow"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
            >
              <Tabs items={CUSTOMER_TABS} active={tab} onChange={setTab} />
              {tab === 'chat' && <CustomerChat />}
              {tab === 'book' && <BookingForm onBooked={setConfirmed} />}
              {tab === 'lookup' && <StatusLookup />}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </>
  );
}

function AdminArea() {
  const { token, checking } = useAuth();

  return (
    <>
      <main className="wrap" style={{ paddingTop: 44, paddingBottom: 60, maxWidth: token ? 920 : 640 }}>
        {checking ? (
          <div className="admin-empty">Checking your session…</div>
        ) : token ? (
          <AdminDashboard />
        ) : (
          <LoginPanel />
        )}
      </main>
      {token && !checking && <AgentChat />}
    </>
  );
}

const MODE_STORAGE_KEY = 'view_mode';

function Shell() {
  const [mode, setMode] = useState(() => {
    try {
      return localStorage.getItem(MODE_STORAGE_KEY) === 'admin' ? 'admin' : 'customer';
    } catch {
      return 'customer';
    }
  });

  const toggleMode = () => {
    setMode((m) => {
      const next = m === 'admin' ? 'customer' : 'admin';
      try {
        localStorage.setItem(MODE_STORAGE_KEY, next);
      } catch {
        // ignore storage errors (private browsing, etc.)
      }
      return next;
    });
  };

  return (
    <div className="page">
      <Header mode={mode} onToggleMode={toggleMode} />
      {mode === 'admin' ? <AdminArea /> : <CustomerFlow />}
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
