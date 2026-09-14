import { MapPin, Sparkles } from "lucide-react";
import Image from "next/image";

import Mascot from "@/components/brand/Mascot";
import RoutePath from "@/components/brand/RoutePath";

type TeacherAdventureSceneProps = {
  className?: string;
};

/** A quiet piece of the outdoor SkoleGPS world for teacher-only overview pages. */
export default function TeacherAdventureScene({ className = "" }: TeacherAdventureSceneProps) {
  return (
    <aside
      aria-hidden="true"
      className={`skolegps-teacher-adventure-scene relative isolate overflow-hidden rounded-[1.5rem] ${className}`}
    >
      <Image
        src="/brand/heroes/teacher-outdoor-route.webp"
        alt=""
        fill
        sizes="(max-width: 1279px) 0px, 320px"
        className="skolegps-scenic-drift object-cover object-[62%_center]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(7,26,58,0.18),rgba(7,26,58,0.02)_54%,rgba(34,164,71,0.24))]" />
      <RoutePath tone="white" className="skolegps-route-drift absolute -right-12 bottom-6 h-20 w-[118%]" />
      <span className="skolegps-adventure-sparkle absolute left-6 top-6 inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white/88 text-amber-500 shadow-[0_10px_24px_rgba(7,26,58,0.18)]">
        <Sparkles className="h-4 w-4" />
      </span>
      <span className="skolegps-adventure-pin absolute right-7 top-8 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/75 bg-sky-600 text-white shadow-[0_12px_26px_rgba(7,26,58,0.28)]">
        <MapPin className="h-5 w-5" />
      </span>
      <Mascot variant="wave" size="sm" className="absolute right-5 bottom-2 z-10" />
      <span className="absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(0deg,rgba(7,26,58,0.34),transparent)]" />
      <p className="absolute bottom-5 left-6 z-10 text-xs font-black tracking-[0.16em] text-white uppercase drop-shadow-[0_2px_6px_rgba(7,26,58,0.5)]">
        Klar til at komme ud
      </p>
    </aside>
  );
}
