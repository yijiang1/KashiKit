import { Suspense } from "react";
import { redirect } from "next/navigation";
import AuthForm from "@/components/auth/AuthForm";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getSession()) redirect("/");

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Log in</h1>
        <p className="text-sm text-gray-500 mt-1">
          Log in to study courses and to create your own
        </p>
      </div>
      <Suspense fallback={null}>
        <AuthForm mode="login" />
      </Suspense>
    </div>
  );
}
