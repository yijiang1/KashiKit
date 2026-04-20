import type { Metadata } from "next";
import "./globals.css";
import NavStats from "@/components/dashboard/NavStats";
import LogoText from "@/components/dashboard/LogoText";
import { isAdmin } from "@/lib/admin";
import { isDbAvailable } from "@/lib/db";

export const metadata: Metadata = {
  title: "KashiKit",
  description: "The AI-powered toolkit for turning Japanese lyrics into language mastery.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const dbAvailable = await isDbAvailable();
  return (
    <html lang="ja">
      <body className="min-h-screen bg-gray-50">
        {!dbAvailable && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-sm text-center py-2 px-4">
            Database unavailable — running in offline mode. No content can be loaded.
          </div>
        )}
        <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
          <div className="max-w-screen-2xl mx-auto px-8 h-14 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2.5 overflow-x-clip min-w-0">
              <img src="/logo-icon.png" alt="KashiKit" className="h-11 w-auto shrink-0 animate-fade-up" style={{ animationDelay: '0ms' }} />
              <LogoText />
            </a>
            <nav className="flex gap-4 text-sm items-center shrink-0 ml-4">
              <NavStats isAdmin={isAdmin} />
              <span className="w-px h-5 bg-gray-200" />
              <a href="/" className="text-gray-600 hover:text-gray-900 transition-colors">
                Lessons
              </a>
              <a href="/dictionary" className="text-gray-600 hover:text-gray-900 transition-colors">
                Dictionary
              </a>
              <a href="/kana" className="text-gray-600 hover:text-gray-900 transition-colors">
                Kana
              </a>
              <a href="/grammar" className="text-gray-600 hover:text-gray-900 transition-colors">
                Grammar
              </a>
              {isAdmin && (
                <>
                  <a href="/sentence-bank" className="text-gray-600 hover:text-gray-900 transition-colors">
                    Sentence Bank
                  </a>
                  <a href="/admin/lyrics-editor" className="text-gray-600 hover:text-gray-900 transition-colors">
                    Lyrics Editor
                  </a>
                  <a
                    href="/import"
                    className="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    + Import song
                  </a>
                </>
              )}
            </nav>
          </div>
        </header>
        <main className="max-w-screen-2xl mx-auto px-8 py-8">{children}</main>
      </body>
    </html>
  );
}
