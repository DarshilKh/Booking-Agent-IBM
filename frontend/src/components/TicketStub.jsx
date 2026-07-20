import { motion } from 'framer-motion';
import { formatDateTime, STATUS_LABEL } from '../format';

const STATUS_STYLE = {
  pending: { fg: 'var(--pending)', bg: 'var(--pending-wash)' },
  accepted: { fg: 'var(--success)', bg: 'var(--success-wash)' },
  rejected: { fg: 'var(--danger)', bg: 'var(--danger-wash)' },
  cancelled: { fg: 'var(--muted)', bg: 'var(--surface-alt)' },
};

export default function TicketStub({ booking }) {
  const { date, time } = formatDateTime(booking.start_time);
  const { time: endTime } = formatDateTime(booking.end_time);
  const style = STATUS_STYLE[booking.status] || STATUS_STYLE.pending;

  return (
    <motion.div
      className="ticket"
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="ticket__body">
        <div className="ticket__eyebrow">Appointment reservation</div>
        <h3 className="ticket__name">{booking.customer_name}</h3>
        <p className="ticket__reason">{booking.reason}</p>

        <div className="ticket__grid">
          <div>
            <span className="ticket__label">Date</span>
            <span className="ticket__value">{date}</span>
          </div>
          <div>
            <span className="ticket__label">Time</span>
            <span className="ticket__value">
              {time} – {endTime}
            </span>
          </div>
          <div>
            <span className="ticket__label">Contact</span>
            <span className="ticket__value ticket__value--small">{booking.customer_email}</span>
          </div>
          {booking.customer_phone && (
            <div>
              <span className="ticket__label">Phone</span>
              <span className="ticket__value ticket__value--small">{booking.customer_phone}</span>
            </div>
          )}
        </div>
      </div>

      <div className="ticket__perforation" aria-hidden="true">
        <span className="ticket__notch ticket__notch--left" />
        <span className="ticket__dashes" />
        <span className="ticket__notch ticket__notch--right" />
      </div>

      <div className="ticket__stub">
        <div>
          <span className="ticket__label">Confirmation ID</span>
          <span className="ticket__id">{booking.id}</span>
        </div>
        <motion.span
          className="ticket__status"
          style={{ color: style.fg, background: style.bg }}
          initial={{ scale: 0.7, rotate: -6, opacity: 0 }}
          animate={{ scale: 1, rotate: -4, opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.4, ease: 'backOut' }}
        >
          {STATUS_LABEL[booking.status] || booking.status}
        </motion.span>
      </div>
    </motion.div>
  );
}
