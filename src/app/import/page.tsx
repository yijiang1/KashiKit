import { redirect } from "next/navigation";
import ImportForm from "@/components/importer/ImportForm";
import { getSession, ENV_ADMIN } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const session = await getSession();
  if (!session && !ENV_ADMIN) redirect("/login?next=/import");

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Import a song</h1>
        <p className="text-sm text-gray-500 mt-1">
          Paste a YouTube URL and LRC lyrics to generate your Japanese course
        </p>
      </div>
      <ImportForm />
    </div>
  );
}
