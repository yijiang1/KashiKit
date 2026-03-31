import DictionaryTable from "@/components/dictionary/DictionaryTable";
import { isAdmin } from "@/lib/admin";

export default function DictionaryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dictionary</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Your personal vocabulary database — words are cached here as you import songs
        </p>
      </div>
      <DictionaryTable isAdmin={isAdmin} />
    </div>
  );
}
