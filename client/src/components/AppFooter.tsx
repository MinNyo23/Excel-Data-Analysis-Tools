import { Link } from "wouter";

export default function AppFooter() {
  return <footer className="application-footer">
    <p>© {new Date().getFullYear()} Excel Master File Tool</p>
    <p>Developed by <strong>Min Nyo</strong></p>
    <Link href="/terms" className="application-footer-link">Terms &amp; Conditions</Link>
  </footer>;
}
