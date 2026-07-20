import { motion } from 'framer-motion';

export default function Tabs({ items, active, onChange }) {
  return (
    <div className="tabs" role="tablist" aria-label="Booking navigation">
      {items.map((item) => (
        <button
          key={item.key}
          role="tab"
          aria-selected={active === item.key}
          data-active={active === item.key}
          className="tabs__btn"
          onClick={() => onChange(item.key)}
        >
          {active === item.key && (
            <motion.span
              layoutId="tabs-pill"
              className="tabs__pill"
              transition={{ type: 'spring', stiffness: 500, damping: 38 }}
            />
          )}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
