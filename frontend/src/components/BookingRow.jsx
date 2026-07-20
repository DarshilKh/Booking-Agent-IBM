import { motion } from 'framer-motion';
import { Check, X, Ban, Trash2 } from 'lucide-react';
import { formatDateTime, STATUS_LABEL } from '../format';

const STATUS_STYLE = {
  pending: { fg: 'var(--pending)', bg: 'var(--pending-wash)' },
  accepted: { fg: 'var(--success)', bg: 'var(--success-wash)' },
  rejected: { fg: 'var(--danger)', bg: 'var(--danger-wash)' },
  cancelled: { fg: 'var(--muted)', bg: 'var(--surface-alt)' },
};

export default function BookingRow({ booking, onAction, busy }) {
  const { date, time } = formatDateTime(booking.start_time);
  const style = STATUS_STYLE[booking.status] || STATUS_STYLE.pending;

  return (
    <motion.div
      className="admin-row"
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.25 }}
    >
      <div className="admin-row__main">
        <div className="admin-row__top">
          <span className="admin-row__name">{booking.customer_name}</span>
          <span className="admin-row__status" style={{ color: style.fg, background: style.bg }}>
            {STATUS_LABEL[booking.status] || booking.status}
          </span>
        </div>
        <p className="admin-row__reason">{booking.reason}</p>
        <div className="admin-row__meta">
          <span>{date} · {time}</span>
          <span>{booking.customer_email}</span>
          <span className="admin-row__id">{booking.id.slice(0, 8)}…</span>
        </div>
      </div>

      <div className="admin-row__actions">
        {booking.status === 'pending' && (
          <>
            <button
              className="icon-btn icon-btn--success"
              title="Accept"
              disabled={busy}
              onClick={() => onAction(booking.id, 'accepted')}
            >
              <Check size={15} />
            </button>
            <button
              className="icon-btn icon-btn--danger"
              title="Reject"
              disabled={busy}
              onClick={() => onAction(booking.id, 'rejected')}
            >
              <X size={15} />
            </button>
          </>
        )}
        {booking.status === 'accepted' && (
          <button
            className="icon-btn"
            title="Cancel"
            disabled={busy}
            onClick={() => onAction(booking.id, 'cancelled')}
          >
            <Ban size={15} />
          </button>
        )}
        <button
          className="icon-btn icon-btn--danger"
          title="Delete"
          disabled={busy}
          onClick={() => onAction(booking.id, 'delete')}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </motion.div>
  );
}
