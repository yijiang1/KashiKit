import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import AccountForms from "@/components/auth/AccountForms";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/account");

  const profile = await queryOne<{
    username: string;
    is_admin: number;
    created_at: string;
  }>("SELECT username, is_admin, created_at FROM users WHERE id = ?", [session.uid]);

  const songs = await queryOne<{ n: number }>(
    "SELECT COUNT(*) AS n FROM songs WHERE user_id = ?",
    [session.uid]
  );

  // A valid JWT with no matching row means an ADMIN_MODE session — there is no
  // real account to manage, so fall back to what the token carries.
  const username = profile?.username ?? session.username;
  const isAdmin = profile ? profile.is_admin === 1 : session.admin;
  const songCount = songs?.n ?? 0;
  const memberSince = profile?.created_at
    ? new Date(profile.created_at.replace(" ", "T") + "Z").toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Your account</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your username and password</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Username</dt>
            <dd className="font-medium text-gray-900">{username}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Role</dt>
            <dd className="font-medium text-gray-900">{isAdmin ? "Admin ★" : "Member"}</dd>
          </div>
          {memberSince && (
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Member since</dt>
              <dd className="font-medium text-gray-900">{memberSince}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Songs imported</dt>
            <dd className="font-medium text-gray-900">{songCount}</dd>
          </div>
        </dl>
      </div>

      {profile ? (
        <AccountForms currentUsername={username} />
      ) : (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 text-sm">
          You are signed in through <code>ADMIN_MODE</code> rather than a real account, so
          there is nothing to change here.
        </div>
      )}

      <p className="text-sm text-gray-500 text-center">
        <Link href="/" className="text-indigo-600 hover:text-indigo-800 font-medium">
          &larr; Back to lessons
        </Link>
      </p>
    </div>
  );
}
