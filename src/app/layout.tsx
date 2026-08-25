import type { Metadata } from "next";
import "./globals.css";
import LogoText from "@/components/dashboard/LogoText";
import HeaderNav from "@/components/dashboard/HeaderNav";
import { LanguageProvider } from "@/lib/language-context";
import { isAdmin } from "@/lib/admin";
import { isDbAvailable } from "@/lib/db";

export const metadata: Metadata = {
  title: "KashiKit",
  description: "The AI-powered toolkit for turning song lyrics into language mastery.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const dbAvailable = await isDbAvailable();
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        <LanguageProvider>
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
              <HeaderNav isAdmin={isAdmin} />
            </div>
          </header>
          <main className="max-w-screen-2xl mx-auto px-8 py-8">{children}</main>
        </LanguageProvider>
      </body>
    </html>
  );
}
