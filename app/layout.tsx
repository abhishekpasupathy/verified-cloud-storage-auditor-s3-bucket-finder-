import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "CloudGuard | Cloud Security Console",
  description: "Ownership-verified cloud storage security auditing.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
