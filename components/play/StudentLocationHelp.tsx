"use client";

import type { StudentLocationStatus } from "@/lib/location/studentLocationState";

const HELP_STATUSES = new Set<StudentLocationStatus>([
  "weak_accuracy",
  "temporarily_unavailable",
  "permission_denied",
  "timed_out",
]);

export function shouldShowStudentLocationHelp(status: StudentLocationStatus) {
  return HELP_STATUSES.has(status);
}

export default function StudentLocationHelp({
  className = "",
}: {
  className?: string;
}) {
  return (
    <details className={`text-sm leading-6 text-white/80 ${className}`}>
      <summary className="w-fit cursor-pointer rounded font-bold text-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200">
        Få hjælp
      </summary>
      <ol className="mt-2 list-decimal space-y-1 pl-5">
        <li>Tjek, at placering er tilladt for SkoleGPS i browseren.</li>
        <li>Gå udenfor og hold telefonen i ro et øjeblik.</li>
        <li>Tryk på “Prøv igen”. Dit hold og din fremdrift bliver bevaret.</li>
      </ol>
    </details>
  );
}
