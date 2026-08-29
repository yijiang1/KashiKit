import { notFound } from "next/navigation";
import SentenceBankTable from "@/components/sentence-bank/SentenceBankTable";
import { query } from "@/lib/db";
import { getSession, isSiteAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SentenceBankPage() {
  if (!isSiteAdmin(await getSession())) notFound();

  const songs = await query<{ song_title: string }>(
    "SELECT DISTINCT song_title FROM sentence_bank ORDER BY song_title ASC"
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sentence Bank</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Example sentences collected from imported songs
        </p>
      </div>
      <SentenceBankTable songTitles={songs.map((s) => s.song_title)} />
    </div>
  );
}
