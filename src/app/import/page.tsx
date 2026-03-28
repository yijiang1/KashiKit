import ImportForm from "@/components/importer/ImportForm";

export default function ImportPage() {
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
