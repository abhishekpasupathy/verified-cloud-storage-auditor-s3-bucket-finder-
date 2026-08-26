import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Verified Cloud Storage Auditor",
  description: "Ownership-verified cloud storage exposure auditing.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
