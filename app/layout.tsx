import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Verified Cloud Storage Auditor",
  description: "Ownership-verified cloud storage exposure auditing.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}<footer className="site-footer"><div>Verified Cloud Storage Auditor</div><div>Developed by <strong>Abhishek Pasupathy</strong> · <a href="mailto:abhishekpasupathy2006@gmail.com">abhishekpasupathy2006@gmail.com</a></div></footer></body></html>;
}
