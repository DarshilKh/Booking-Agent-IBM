import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { listBookings, updateBookingStatus, deleteBooking, ApiError } from '../api';
import BookingRow from './BookingRow';

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'cancelled', label: 'Cancelled' },
];

export default function AdminDashboard() {
  const { token, user, logout } = useAuth();
  const [filter, setFilter] = useState('pending');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await listBookings(token);
      setBookings(rows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load bookings.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const base = { pending: 0, accepted: 0, rejected: 0, cancelled: 0 };
    for (const b of bookings) {
      if (base[b.status] !== undefined) base[b.status] += 1;
    }
    return { ...base, total: bookings.length };
  }, [bookings]);

  const visible = useMemo(
    () => (filter ? bookings.filter((b) => b.status === filter) : bookings),
    [bookings, filter]
  );

  const handleAction = async (bookingId, action) => {
    setBusyId(bookingId);
    setError('');
    try {
      if (action === 'delete') {
        if (!window.confirm('Delete this booking permanently?')) {
          setBusyId(null);
          return;
        }
        await deleteBooking(token, bookingId);
        setBookings((rows) => rows.filter((b) => b.id !== bookingId));
      } else {
        const updated = await updateBookingStatus(token, bookingId, action);
        setBookings((rows) => rows.map((b) => (b.id === bookingId ? updated : b)));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That action failed.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="admin-header">
        <div>
          <span className="admin-header__eyebrow">Dashboard</span>
          <h2 className="admin-header__title">Bookings</h2>
          <p className="field__hint">
            {user?.email}{user?.role ? ` · ${user.role}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="icon-btn" title="Refresh" onClick={load} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin-icon' : ''} />
          </button>
          <button className="btn btn--ghost" style={{ width: 'auto' }} onClick={logout}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-card__value">{counts.total}</span>
          <span className="stat-card__label">Total</span>
        </div>
        <div className="stat-card stat-card--pending">
          <span className="stat-card__value">{counts.pending}</span>
          <span className="stat-card__label">Pending</span>
        </div>
        <div className="stat-card stat-card--success">
          <span className="stat-card__value">{counts.accepted}</span>
          <span className="stat-card__label">Accepted</span>
        </div>
        <div className="stat-card stat-card--danger">
          <span className="stat-card__value">{counts.rejected}</span>
          <span className="stat-card__label">Rejected</span>
        </div>
        <div className="stat-card stat-card--muted">
          <span className="stat-card__value">{counts.cancelled}</span>
          <span className="stat-card__label">Cancelled</span>
        </div>
      </div>

      <div className="admin-filters">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className="filter-chip"
            data-active={filter === f.key}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            <span className="filter-chip__count">
              {f.key ? counts[f.key] : counts.total}
            </span>
          </button>
        ))}
      </div>

      {error && (
        <div className="banner banner--error" role="alert">
          <AlertCircle size={16} style={{ flex: 'none', marginTop: 1 }} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="admin-empty">Loading bookings…</div>
      ) : visible.length === 0 ? (
        <div className="admin-empty">No bookings here yet.</div>
      ) : (
        <div className="admin-list">
          <AnimatePresence initial={false}>
            {visible.map((b) => (
              <BookingRow key={b.id} booking={b} onAction={handleAction} busy={busyId === b.id} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
