/** Sitewide credit line. Mounted once in the root layout so it appears on
 *  every page — landing, auth, dashboard and the offline shell alike. */
export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>Created by VG</span>
      <span aria-hidden className="site-footer-dot">·</span>
      <span>&copy; 2026</span>
    </footer>
  );
}
