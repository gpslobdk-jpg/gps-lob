"use client";

import { usePathname } from "next/navigation";

import TeacherSoundControl from "@/components/teacher-sound/TeacherSoundControl";
import { isTeacherSoundPublicSubroute } from "@/lib/teacherSound/catalog";

/**
 * Public teacher articles do not share a site header. Keep the one audio
 * control reachable after a normal Next navigation without adding anything to
 * student, shared or live routes.
 */
export default function TeacherSoundPublicDock() {
  const pathname = usePathname();

  if (!pathname || !isTeacherSoundPublicSubroute(pathname)) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-[90] print:hidden sm:bottom-6 sm:right-6">
      <TeacherSoundControl variant="floating" />
    </div>
  );
}
