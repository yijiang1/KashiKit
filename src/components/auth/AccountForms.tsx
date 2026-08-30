"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CARD =
  "space-y-5 bg-white rounded-2xl shadow-sm border border-gray-100 p-8";
const BUTTON =
  "w-full py-3 px-6 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors";
const INPUT =
  "w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 placeholder-gray-400";

function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
  placeholder,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        autoComplete={autoComplete}
        placeholder={placeholder}
        className={INPUT}
      />
    </div>
  );
}

function Notice({ error, success }: { error: string | null; success: string | null }) {
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
        {error}
      </div>
    );
  }
  if (success) {
    return (
      <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">
        {success}
      </div>
    );
  }
  return null;
}

export default function AccountForms({ currentUsername }: { currentUsername: string }) {
  const router = useRouter();

  // --- change password ---
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(null);
    if (newPw !== confirmPw) {
      setPwError("The new passwords do not match.");
      return;
    }
    setPwLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: curPw, newPassword: newPw }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPwError(data.error || "Could not change your password.");
        return;
      }
      setPwSuccess("Password changed.");
      setCurPw("");
      setNewPw("");
      setConfirmPw("");
    } catch {
      setPwError("Network error. Please try again.");
    } finally {
      setPwLoading(false);
    }
  }

  // --- change username ---
  const [newUsername, setNewUsername] = useState(currentUsername);
  const [unPw, setUnPw] = useState("");
  const [unLoading, setUnLoading] = useState(false);
  const [unError, setUnError] = useState<string | null>(null);
  const [unSuccess, setUnSuccess] = useState<string | null>(null);

  async function submitUsername(e: React.FormEvent) {
    e.preventDefault();
    setUnError(null);
    setUnSuccess(null);
    setUnLoading(true);
    try {
      const res = await fetch("/api/auth/change-username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newUsername, password: unPw }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUnError(data.error || "Could not change your username.");
        return;
      }
      setUnSuccess("Username updated.");
      setUnPw("");
      router.refresh();
    } catch {
      setUnError("Network error. Please try again.");
    } finally {
      setUnLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submitPassword} className={CARD}>
        <h2 className="text-lg font-semibold text-gray-900">Change password</h2>
        <Field
          label="Current password"
          type="password"
          value={curPw}
          onChange={setCurPw}
          autoComplete="current-password"
          placeholder="Your current password"
        />
        <Field
          label="New password"
          type="password"
          value={newPw}
          onChange={setNewPw}
          autoComplete="new-password"
          placeholder="At least 8 characters"
        />
        <Field
          label="Confirm new password"
          type="password"
          value={confirmPw}
          onChange={setConfirmPw}
          autoComplete="new-password"
          placeholder="Re-type the new password"
        />
        <Notice error={pwError} success={pwSuccess} />
        <button type="submit" disabled={pwLoading} className={BUTTON}>
          {pwLoading ? "Please wait…" : "Change password"}
        </button>
      </form>

      <form onSubmit={submitUsername} className={CARD}>
        <h2 className="text-lg font-semibold text-gray-900">Change username</h2>
        <Field
          label="New username"
          type="text"
          value={newUsername}
          onChange={setNewUsername}
          autoComplete="username"
          placeholder="3–20 letters, numbers, or _"
        />
        <Field
          label="Current password"
          type="password"
          value={unPw}
          onChange={setUnPw}
          autoComplete="current-password"
          placeholder="Confirm with your password"
        />
        <Notice error={unError} success={unSuccess} />
        <button type="submit" disabled={unLoading} className={BUTTON}>
          {unLoading ? "Please wait…" : "Change username"}
        </button>
      </form>
    </div>
  );
}
