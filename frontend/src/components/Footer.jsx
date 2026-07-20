import { BUSINESS_NAME } from './Header';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">© {new Date().getFullYear()} {BUSINESS_NAME}. All appointments reviewed within one business day.</div>
    </footer>
  );
}
