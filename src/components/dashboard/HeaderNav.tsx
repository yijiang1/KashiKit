"use client";

import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/language-context";
import { LANGUAGE_LIST, getLanguageConfig } from "@/lib/languages";
import NavStats from "./NavStats";

interface Props {
  user: { username: string; admin: boolean } | null;
  /** True when the viewer can reach global tools (DB admin or ADMIN_MODE). */
  isAdmin: boolean;
}

export default function HeaderNav({ user, isAdmin }: Props) {
  const router = useRouter();
  const { language, setLanguage } = useLanguage();
  const langConfig = getLanguageConfig(language);

  const canCreate = !!user || isAdmin;

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <nav className="flex gap-4 text-sm items-center shrink-0 ml-4">
      <NavStats isAdmin={isAdmin} />
      <span className="w-px h-5 bg-gray-200" />
      <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
        {LANGUAGE_LIST.map((lang) => (
          <button
            key={lang.id}
            onClick={() => setLanguage(lang.id)}
            title={lang.label}
            className={`px-2 py-1 rounded-md text-sm transition-all ${
              language === lang.id ? "bg-white shadow-sm" : "opacity-40 hover:opacity-70"
            }`}
          >
            {lang.flag}
          </button>
        ))}
      </div>
      <span className="w-px h-5 bg-gray-200" />
      <a href="/" className="text-gray-600 hover:text-gray-900 transition-colors">
        Lessons
      </a>
      <a href="/dictionary" className="text-gray-600 hover:text-gray-900 transition-colors">
        Dictionary
      </a>
      <a href="/kana" className="text-gray-600 hover:text-gray-900 transition-colors">
        {langConfig.referenceLabel}
      </a>
      <a href="/grammar" className="text-gray-600 hover:text-gray-900 transition-colors">
        Grammar
      </a>
      {isAdmin && (
        <a href="/sentence-bank" className="text-gray-600 hover:text-gray-900 transition-colors">
          Sentence Bank
        </a>
      )}
      {canCreate && (
        <a href="/admin/lyrics-editor" className="text-gray-600 hover:text-gray-900 transition-colors">
          Lyrics Editor
        </a>
      )}
      {canCreate && (
        <a
          href="/import"
          className="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          + Import song
        </a>
      )}
      {user ? (
        <span className="flex items-center gap-2 pl-1">
          <a
            href="/account"
            className="text-gray-500 hover:text-gray-900 transition-colors"
            title={user.admin ? "Admin — account settings" : "Account settings"}
          >
            {user.username}
            {user.admin && " ★"}
          </a>
          <button
            onClick={handleLogout}
            className="text-gray-500 hover:text-gray-900 transition-colors"
          >
            Log out
          </button>
        </span>
      ) : (
        <a
          href="/login"
          className="text-gray-600 hover:text-gray-900 transition-colors font-medium"
        >
          Log in
        </a>
      )}
    </nav>
  );
}
