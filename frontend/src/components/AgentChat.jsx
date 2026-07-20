import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, X, Send } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { agentQuery, ApiError } from '../api';

const GREETING = {
  role: 'assistant',
  text: "Hi! I can book, cancel, reschedule, or check availability in plain English — try \"book Priya tomorrow 4pm for a consult\" or \"is 3pm Friday free?\"",
};

export default function AgentChat() {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open]);

  const send = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text }]);
    setSending(true);
    try {
      const res = await agentQuery(token, text);
      setMessages((m) => [
        ...m,
        { role: 'assistant', text: res.message || "Done.", result: res.result, intent: res.intent },
      ]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          text: err instanceof ApiError ? err.message : "Something went wrong reaching the agent.",
          error: true,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <motion.button
        className="agent-fab"
        onClick={() => setOpen((o) => !o)}
        whileTap={{ scale: 0.94 }}
        aria-label="Open AI assistant"
      >
        {open ? <X size={20} /> : <Sparkles size={20} />}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="agent-panel"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="agent-panel__header">
              <Sparkles size={14} style={{ color: 'var(--accent-deep)' }} />
              <span>Booking assistant</span>
            </div>

            <div className="agent-panel__list" ref={listRef}>
              {messages.map((m, i) => (
                <div key={i} className={`agent-msg agent-msg--${m.role}`}>
                  <div className={`agent-bubble ${m.error ? 'agent-bubble--error' : ''}`}>
                    {m.text}
                    {m.result?.booking_id && (
                      <div className="agent-bubble__meta">ID: {m.result.booking_id.slice(0, 8)}…</div>
                    )}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="agent-msg agent-msg--assistant">
                  <div className="agent-bubble agent-bubble--typing">
                    <span /><span /><span />
                  </div>
                </div>
              )}
            </div>

            <form className="agent-panel__input" onSubmit={send}>
              <input
                className="input"
                placeholder="Ask me to book, cancel, reschedule…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={sending}
              />
              <button className="icon-btn icon-btn--accent" type="submit" disabled={sending || !input.trim()}>
                <Send size={15} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
