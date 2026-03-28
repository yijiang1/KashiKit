import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LyricLearn",
  description: "Learn Japanese through song lyrics",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
            <a href="/" className="font-bold text-indigo-600 text-lg tracking-tight">
              LyricLearn
            </a>
            <nav className="flex gap-4 text-sm items-center">
              <a href="/" className="text-gray-600 hover:text-gray-900 transition-colors">
                Dashboard
              </a>
              <a href="/dictionary" className="text-gray-600 hover:text-gray-900 transition-colors">
                Dictionary
              </a>
              <a
                href="/import"
                className="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                + Import song
              </a>
            </nav>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
