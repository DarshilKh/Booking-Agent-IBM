import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Search } from 'lucide-react';
import { getBooking, ApiError } from '../api';
import TicketStub from './TicketStub';

export default function StatusLookup() {
  const [bookingId, setBookingId] = useState('');
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!bookingId.trim()) return;
    setError('');
    setBooking(null);
    setLoading(true);
    try {
      const result = await getBooking(bookingId);
      setBooking(result);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 404
          ? "We couldn't find a booking with that ID. Double-check and try again."
          : err.message
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <motion.form
        className="card"
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="field">
          <label className="field__label" htmlFor="lookup_id">
            Confirmation ID
          </label>
          <div className="lookup__row">
            <input
              id="lookup_id"
              className="input"
              placeholder="e.g. 3f1a9c2e-..."
              value={bookingId}
              onChange={(e) => setBookingId(e.target.value)}
              required
            />
            <button className="btn btn--accent" type="submit" disabled={loading}>
              {loading ? <span className="spinner" /> : <Search size={15} />}
            </button>
          </div>
          <p className="field__hint">
            This is the ID you received right after booking — paste it here to check where
            things stand.
          </p>
        </div>

        {error && (
          <div className="banner banner--error" style={{ marginTop: 16, marginBottom: 0 }} role="alert">
            <AlertCircle size={16} style={{ flex: 'none', marginTop: 1 }} />
            <span>{error}</span>
          </div>
        )}
      </motion.form>

      <AnimatePresence>
        {booking && (
          <div style={{ marginTop: 20 }}>
            <TicketStub booking={booking} />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
