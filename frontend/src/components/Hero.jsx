import { motion } from 'framer-motion';
import { Sparkle } from 'lucide-react';

export default function Hero() {
  return (
    <section className="hero wrap">
      <motion.span
        className="hero__eyebrow"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Sparkle size={13} strokeWidth={2.5} />
        Reserve in under a minute
      </motion.span>
      <motion.h1
        className="hero__title"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.05 }}
      >
        Book your <span className="hero__accent">appointment</span>,
        <br />
        hold your time.
      </motion.h1>
      <motion.p
        className="hero__sub"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.1 }}
      >
        Just tell our assistant what you need — it'll find you a free slot and
        get you booked in.
      </motion.p>
    </section>
  );
}
