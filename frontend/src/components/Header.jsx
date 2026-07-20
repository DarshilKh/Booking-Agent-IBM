const BUSINESS_NAME = import.meta.env.VITE_BUSINESS_NAME || 'Meridian Clinic';

export default function Header({ mode, onToggleMode }) {
  const initial = BUSINESS_NAME.trim().charAt(0).toUpperCase() || 'M';
  return (
    <header className="header">
      <div className="wrap header__row">
        <span className="header__mark">{initial}</span>
        <span className="header__name">{BUSINESS_NAME}</span>
        <button className="header__link" style={{ marginLeft: 'auto' }} onClick={onToggleMode}>
          {mode === 'admin' ? 'Customer site' : 'Admin sign in'}
        </button>
      </div>
    </header>
  );
}

export { BUSINESS_NAME };
