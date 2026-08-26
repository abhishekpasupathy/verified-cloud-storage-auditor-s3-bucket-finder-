import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Verified Cloud Storage Auditor",
  description: "Ownership-verified cloud storage exposure auditing.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <footer className="site-footer">
          <div className="footer-inner">
            <span className="footer-brand">Verified Cloud Storage Auditor</span>
            <span className="footer-credit">
              Built by <strong>Abhishek Pasupathy</strong>
              <span className="footer-dot">•</span>
              <a href="mailto:abhishekpasupathy2006@gmail.com">Get in touch</a>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
