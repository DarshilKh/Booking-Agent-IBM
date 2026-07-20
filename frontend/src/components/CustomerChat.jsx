import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Send, CheckCircle2 } from 'lucide-react';
import { sendChat, ApiError } from '../api';
import { BUSINESS_NAME } from './Header';
import TicketStub from './TicketStub';

const GREETING = {
  role: 'assistant',
  content: `Hi! I'm the booking assistant for ${BUSINESS_NAME}. What can I help you with today — need to set up an appointment?`,
};

export default function CustomerChat() {
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, sending]);

  const send = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setError('');
    const next = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setSending(true);
    try {
      const res = await sendChat(next.map(({ role, content }) => ({ role, content })));
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: res.reply, booking: res.booking || null },
      ]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div
      className="chat-panel"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="chat-panel__list" ref={listRef}>
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg chat-msg--${m.role}`}>
            <div className="chat-bubble">{m.content}</div>
            {m.booking && (
              <div className="chat-msg__ticket">
                <div className="chat-msg__ticket-flag">
                  <CheckCircle2 size={14} />
                  Booking confirmed — pending review
                </div>
                <TicketStub booking={m.booking} />
              </div>
            )}
          </div>
        ))}
        {sending && (
          <div className="chat-msg chat-msg--assistant">
            <div className="chat-bubble chat-bubble--typing">
              <span /><span /><span />
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="banner banner--error" style={{ margin: '0 20px 12px' }} role="alert">
          {error}
        </div>
      )}

      <form className="chat-panel__input" onSubmit={send}>
        <input
          className="input"
          placeholder="Type a message…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
          autoFocus
        />
        <button className="icon-btn icon-btn--accent" type="submit" disabled={sending || !input.trim()}>
          <Send size={16} />
        </button>
      </form>
    </motion.div>
  );
}
