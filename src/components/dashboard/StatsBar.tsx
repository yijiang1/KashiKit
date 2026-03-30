interface Props {
  streak: number;
  today: number;
  total: number;
  apiTodayCalls: number;
}

export default function StatsBar({ streak, today, total, apiTodayCalls }: Props) {
  return (
    <div className="space-y-3">
      {/* Study stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-3xl font-bold text-indigo-600">{streak}</p>
          <p className="text-xs text-gray-500 mt-1">day streak 🔥</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-3xl font-bold text-green-600">{today}</p>
          <p className="text-xs text-gray-500 mt-1">completed today</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-3xl font-bold text-gray-700">{total}</p>
          <p className="text-xs text-gray-500 mt-1">total lessons done</p>
        </div>
      </div>

      {/* API usage stats */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center max-w-xs">
        <p className={`text-xl font-bold ${apiTodayCalls >= 1350 ? "text-red-500" : "text-amber-600"}`}>
          {apiTodayCalls}<span className="text-sm font-normal text-gray-400"> / 1,500</span>
        </p>
        <p className="text-xs text-gray-500 mt-0.5">API calls today</p>
      </div>
    </div>
  );
}
