"use client";

import { useState } from "react";

type Question = {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
};

interface Props {
  lessonId: string;
  onClose: () => void;
}

export default function Quiz({ lessonId, onClose }: Props) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch quiz on mount
  useState(() => {
    fetch(`/api/quiz?lessonId=${lessonId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.questions) {
          setQuestions(data.questions);
        } else {
          setError(data.error || "Failed to load quiz");
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Network error");
        setLoading(false);
      });
  });

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center space-y-3">
        <svg className="animate-spin w-8 h-8 text-indigo-500 mx-auto" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        <p className="text-gray-500">Generating quiz...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center space-y-3">
        <p className="text-red-500">{error}</p>
        <button onClick={onClose} className="text-sm text-indigo-600 hover:text-indigo-800 underline">
          Go back
        </button>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center space-y-4">
        <p className="text-4xl font-bold text-indigo-600">{score} / {questions.length}</p>
        <p className="text-gray-600">
          {score === questions.length
            ? "Perfect score!"
            : score >= questions.length * 0.6
            ? "Nice work!"
            : "Keep practicing!"}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => {
              setCurrent(0);
              setSelected(null);
              setScore(0);
              setFinished(false);
            }}
            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm font-medium"
          >
            Retry
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-medium"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  const q = questions[current];
  if (!q) return null;

  const answered = selected !== null;
  const isCorrect = selected === q.correct;

  function handleSelect(idx: number) {
    if (answered) return;
    setSelected(idx);
    if (idx === q.correct) setScore((s) => s + 1);
  }

  function handleNext() {
    if (current + 1 >= questions.length) {
      setFinished(true);
    } else {
      setCurrent((c) => c + 1);
      setSelected(null);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
      {/* Progress */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">Question {current + 1} of {questions.length}</span>
        <span className="text-sm font-medium text-indigo-600">{score} correct</span>
      </div>
      <div className="flex gap-1">
        {questions.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full ${
              i < current ? "bg-indigo-500" : i === current ? "bg-indigo-300" : "bg-gray-200"
            }`}
          />
        ))}
      </div>

      {/* Question */}
      <p className="text-lg font-semibold text-gray-900">{q.question}</p>

      {/* Options */}
      <div className="space-y-2">
        {q.options.map((option, idx) => {
          let style = "border-gray-200 hover:bg-gray-50";
          if (answered) {
            if (idx === q.correct) style = "border-green-400 bg-green-50 text-green-800";
            else if (idx === selected) style = "border-red-400 bg-red-50 text-red-800";
            else style = "border-gray-100 text-gray-400";
          } else if (idx === selected) {
            style = "border-indigo-500 bg-indigo-50";
          }

          return (
            <button
              key={idx}
              onClick={() => handleSelect(idx)}
              disabled={answered}
              className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all text-sm font-medium ${style}`}
            >
              <span className="text-gray-400 mr-2">{String.fromCharCode(65 + idx)}.</span>
              {option}
            </button>
          );
        })}
      </div>

      {/* Explanation + Next */}
      {answered && (
        <div className="space-y-3">
          <div className={`px-4 py-3 rounded-lg text-sm ${isCorrect ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            <span className="font-semibold">{isCorrect ? "Correct!" : "Incorrect."}</span>{" "}
            {q.explanation}
          </div>
          <button
            onClick={handleNext}
            className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors text-sm"
          >
            {current + 1 >= questions.length ? "See results" : "Next question"}
          </button>
        </div>
      )}
    </div>
  );
}
