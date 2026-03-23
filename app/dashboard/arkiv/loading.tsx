export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-sky-300 via-emerald-50 to-emerald-200 p-6 text-blue-900">
      <div className="rounded-3xl bg-white/95 p-8 shadow-xl backdrop-blur-md flex flex-col items-center gap-4">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="animate-spin h-10 w-10 text-blue-600"
        >
          <path d="M12 2v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M12 18v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M4.93 4.93l2.83 2.83" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M16.24 16.24l2.83 2.83" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <p className="text-lg font-semibold">Indlæser...</p>
      </div>
    </div>
  );
}
