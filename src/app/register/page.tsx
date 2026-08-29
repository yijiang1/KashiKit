import { Suspense } from "react";
import { redirect } from "next/navigation";
import AuthForm from "@/components/auth/AuthForm";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (await getSession()) redirect("/");

  const signupsClosed = process.env.SIGNUPS_DISABLED === "true";

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Create an account</h1>
        <p className="text-sm text-gray-500 mt-1">
          Free — you only need a username and a password
        </p>
      </div>
      {signupsClosed ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 text-sm">
          New registrations are currently closed.
        </div>
      ) : (
        <Suspense fallback={null}>
          <AuthForm mode="register" />
        </Suspense>
      )}
    </div>
  );
}
