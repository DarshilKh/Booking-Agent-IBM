import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { createBooking, ApiError } from '../api';
import { toLocalInputValue } from '../format';

function defaultTimes() {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 2);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  return { start: toLocalInputValue(start), end: toLocalInputValue(end) };
}

export default function BookingForm({ onBooked }) {
  const { start, end } = defaultTimes();
  const [form, setForm] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    reason: '',
    start_time: start,
    end_time: end,
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (new Date(form.end_time) <= new Date(form.start_time)) {
      setError('End time needs to be after the start time.');
      return;
    }

    setSubmitting(true);
    try {
      const booking = await createBooking({
        customer_name: form.customer_name.trim(),
        customer_email: form.customer_email.trim(),
        customer_phone: form.customer_phone.trim() || undefined,
        reason: form.reason.trim(),
        start_time: new Date(form.start_time).toISOString(),
        end_time: new Date(form.end_time).toISOString(),
      });
      onBooked(booking);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.form
      className="card"
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {error && (
        <div className="banner banner--error" role="alert">
          <AlertCircle size={16} style={{ flex: 'none', marginTop: 1 }} />
          <span>{error}</span>
        </div>
      )}

      <div className="field">
        <label className="field__label" htmlFor="customer_name">
          Full name
        </label>
        <input
          id="customer_name"
          className="input"
          placeholder="Jordan Lee"
          value={form.customer_name}
          onChange={update('customer_name')}
          required
        />
      </div>

      <div className="field field__row">
        <div>
          <label className="field__label" htmlFor="customer_email">
            Email
          </label>
          <input
            id="customer_email"
            type="email"
            className="input"
            placeholder="jordan@email.com"
            value={form.customer_email}
            onChange={update('customer_email')}
            required
          />
        </div>
        <div>
          <label className="field__label" htmlFor="customer_phone">
            Phone <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span>
          </label>
          <input
            id="customer_phone"
            type="tel"
            className="input"
            placeholder="+1 555 123 4567"
            value={form.customer_phone}
            onChange={update('customer_phone')}
          />
        </div>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="reason">
          Reason for visit
        </label>
        <textarea
          id="reason"
          className="textarea"
          placeholder="Briefly tell us what this appointment is for"
          value={form.reason}
          onChange={update('reason')}
          required
        />
      </div>

      <div className="field field__row">
        <div>
          <label className="field__label" htmlFor="start_time">
            Starts
          </label>
          <input
            id="start_time"
            type="datetime-local"
            className="input"
            value={form.start_time}
            onChange={update('start_time')}
            required
          />
        </div>
        <div>
          <label className="field__label" htmlFor="end_time">
            Ends
          </label>
          <input
            id="end_time"
            type="datetime-local"
            className="input"
            value={form.end_time}
            onChange={update('end_time')}
            required
          />
        </div>
      </div>

      <div className="field" style={{ marginTop: 22 }}>
        <button className="btn btn--accent" type="submit" disabled={submitting}>
          {submitting ? (
            <>
              <span className="spinner" /> Reserving…
            </>
          ) : (
            <>
              Reserve this slot <ArrowRight size={15} />
            </>
          )}
        </button>
        <p className="field__hint" style={{ textAlign: 'center', marginTop: 10 }}>
          You'll get a confirmation ID to track your appointment's status.
        </p>
      </div>
    </motion.form>
  );
}
