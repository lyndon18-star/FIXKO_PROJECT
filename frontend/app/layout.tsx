// This is the root layout: it wraps every page in the app.
// It loads Bootstrap and the global stylesheet, and sets the browser tab title/description.
import type { Metadata } from "next";
import "bootstrap/dist/css/bootstrap.min.css";
import "./globals.css";

// The browser-tab title and description used for search results / link previews.
export const metadata: Metadata = {
  title: "Fixko | Facility reporting for schools",
  description: "Report, track, and resolve campus facility issues.",
};

// The shared page shell every screen renders inside (just <html> and <body> here).
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
