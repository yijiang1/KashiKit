"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import SentenceExamples, { Highlight, speakJapanese } from "@/components/shared/SentenceExamples";

type Entry = {
  word: string;
  furigana: string;
  english_meaning: string;
  part_of_speech: string;
  grammar_notes: string;
  example_sentence: string;
  example_sentence_english: string;
};

const POS_OPTIONS = ["noun", "verb", "adjective", "adverb", "expression", "other"];

const POS_COLORS: Record<string, string> = {
  noun: "bg-blue-100 text-blue-700",
  verb: "bg-red-100 text-red-700",
  adjective: "bg-yellow-100 text-yellow-700",
  adverb: "bg-green-100 text-green-700",
  expression: "bg-purple-100 text-purple-700",
  other: "bg-gray-100 text-gray-600",
};

export default function DictionaryTable() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const params = search ? `?q=${encodeURIComponent(search)}` : "";
    const res = await fetch(`/api/dictionary${params}`);
    const data = await res.json();
    if (Array.isArray(data)) setEntries(data);
    setLoading(false);
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(fetchEntries, 300);
    return () => clearTimeout(timer);
  }, [fetchEntries]);

  async function handleSave() {
    if (!editForm) return;
    await fetch("/api/dictionary", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    setEditing(null);
    setEditForm(null);
    fetchEntries();
  }

  async function handleDelete(word: string) {
    if (!confirm(`Delete "${word}" from dictionary?`)) return;
    await fetch(`/api/dictionary?word=${encodeURIComponent(word)}`, { method: "DELETE" });
    fetchEntries();
  }

  function startEdit(entry: Entry) {
    setEditing(entry.word);
    setEditForm({ ...entry });
  }

  function toggleExpand(word: string) {
    setExpanded(expanded === word ? null : word);
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search words, readings, or meanings..."
          className="w-full px-4 py-2.5 pl-10 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 placeholder-gray-400"
        />
        <svg className="absolute left-3 top-3 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      {/* Count */}
      <p className="text-sm text-gray-500">
        {loading ? "Loading..." : `${entries.length} word${entries.length !== 1 ? "s" : ""} in dictionary`}
      </p>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Word</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Reading</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Meaning</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">POS</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Grammar notes</th>
              <th className="px-4 py-3 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <Fragment key={entry.word}>
                <tr
                  className={`border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer ${expanded === entry.word ? "bg-gray-50" : ""}`}
                  onClick={() => { if (editing !== entry.word) toggleExpand(entry.word); }}
                >
                  {editing === entry.word && editForm ? (
                    <>
                      <td className="px-4 py-2 font-medium text-gray-900">{entry.word}</td>
                      <td className="px-4 py-2">
                        <input
                          value={editForm.furigana}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setEditForm({ ...editForm, furigana: e.target.value })}
                          className="w-full px-2 py-1 rounded border border-gray-300 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          value={editForm.english_meaning}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setEditForm({ ...editForm, english_meaning: e.target.value })}
                          className="w-full px-2 py-1 rounded border border-gray-300 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={editForm.part_of_speech}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setEditForm({ ...editForm, part_of_speech: e.target.value })}
                          className="px-2 py-1 rounded border border-gray-300 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          {POS_OPTIONS.map((pos) => (
                            <option key={pos} value={pos}>{pos}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          value={editForm.grammar_notes}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setEditForm({ ...editForm, grammar_notes: e.target.value })}
                          className="w-full px-2 py-1 rounded border border-gray-300 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <button onClick={handleSave} className="text-green-600 hover:text-green-800 text-xs font-medium">Save</button>
                          <button onClick={() => { setEditing(null); setEditForm(null); }} className="text-gray-400 hover:text-gray-600 text-xs">Cancel</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-2.5 font-medium text-gray-900 text-base">
                        <div className="flex items-center gap-1.5">
                          <svg className={`w-3 h-3 text-gray-400 transition-transform ${expanded === entry.word ? "rotate-90" : ""}`} fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                          {entry.word}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-indigo-500">{entry.furigana}</td>
                      <td className="px-4 py-2.5 text-gray-700">{entry.english_meaning}</td>
                      <td className="px-4 py-2.5">
                        {entry.part_of_speech && (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${POS_COLORS[entry.part_of_speech] ?? POS_COLORS.other}`}>
                            {entry.part_of_speech}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs italic">{entry.grammar_notes}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => startEdit(entry)} className="text-indigo-500 hover:text-indigo-700 text-xs font-medium">Edit</button>
                          <button onClick={() => handleDelete(entry.word)} className="text-red-400 hover:text-red-600 text-xs font-medium">Delete</button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
                {expanded === entry.word && editing !== entry.word && (
                  <tr key={`${entry.word}-detail`} className="bg-gray-50/50">
                    <td colSpan={6} className="px-6 py-4">
                      <div className="max-w-lg space-y-3">
                        {/* Pronounce */}
                        <button
                          onClick={() => speakJapanese(entry.word)}
                          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
                          </svg>
                          Pronounce
                        </button>

                        {/* AI example sentence */}
                        {entry.example_sentence && (
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Example</p>
                              <button
                                onClick={() => speakJapanese(entry.example_sentence)}
                                title="Pronounce"
                                className="w-5 h-5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors"
                              >
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
                                </svg>
                              </button>
                            </div>
                            <p className="text-sm text-gray-800">
                              <Highlight text={entry.example_sentence} word={entry.word} />
                            </p>
                            {entry.example_sentence_english && (
                              <p className="text-xs text-gray-500 italic">{entry.example_sentence_english}</p>
                            )}
                          </div>
                        )}

                        {/* Song examples with YouTube clips */}
                        <SentenceExamples word={entry.word} />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {!loading && entries.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                  {search ? "No words match your search" : "Dictionary is empty — import a song to start building it"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
