"use client";

import { AlertTriangle, Building2, CalendarDays, DoorOpen, Rows3 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import {
  getAvailableRoomNames,
  getRoomPreviewLessons,
  getRoomScheduleStats,
  type SkemaPilotPreviewCell,
  weekdays,
} from "./skemaPilotPreviewData";

type SkemaPilotRoomPreviewProps = {
  activeRooms: readonly string[];
  allPreviewLessons: readonly SkemaPilotPreviewCell[];
  lessonCount: number;
  rubikClassName: string;
};

export function SkemaPilotRoomPreview({
  activeRooms,
  allPreviewLessons,
  lessonCount,
  rubikClassName,
}: SkemaPilotRoomPreviewProps) {
  const [selectedRoom, setSelectedRoom] = useState("");
  const availableRooms = useMemo(
    () => getAvailableRoomNames(activeRooms, allPreviewLessons),
    [activeRooms, allPreviewLessons],
  );
  const resolvedRoom = availableRooms.includes(selectedRoom) ? selectedRoom : availableRooms[0] ?? "";
  const roomLessons = useMemo(
    () => getRoomPreviewLessons(allPreviewLessons, resolvedRoom),
    [allPreviewLessons, resolvedRoom],
  );
  const roomStats = useMemo(
    () => getRoomScheduleStats(allPreviewLessons, resolvedRoom, lessonCount),
    [allPreviewLessons, lessonCount, resolvedRoom],
  );

  return (
    <section className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Lokaleskema</p>
          <h4 className={`mt-2 text-2xl font-black tracking-tight text-slate-950 ${rubikClassName}`}>
            Visuel kladde for lokale
          </h4>
          <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">
            Vælg et lokale og se, hvor det bruges i den samme visuelle kladde som klasse- og lærerpreviewet.
            Det er et lokalt estimat, ikke en færdig lokaleplan.
          </p>
        </div>

        <div className="w-full rounded-lg border border-slate-200 bg-slate-50 p-4 lg:w-[320px]">
          <label className="block">
            <span className="text-sm font-black text-slate-950">Lokale</span>
            <select
              className="mt-2 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
              disabled={!availableRooms.length}
              value={resolvedRoom}
              onChange={(event) => setSelectedRoom(event.target.value)}
            >
              {!availableRooms.length ? <option value="">Ingen lokaler endnu</option> : null}
              {availableRooms.map((room) => (
                <option key={room} value={room}>
                  {room}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
            Valgte og brugte lokaler
          </p>
        </div>
      </div>

      {!availableRooms.length ? (
        <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-7 text-amber-950">
          Vælg lokaler i opsætningen for at se lokaleskema.
        </p>
      ) : (
        <div className="mt-5 grid gap-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <RoomMetric
              icon={<Building2 className="h-4 w-4" />}
              label="Placerede lektioner"
              value={String(roomStats.placedLessons)}
            />
            <RoomMetric
              icon={<CalendarDays className="h-4 w-4" />}
              label="Dage i brug"
              value={String(roomStats.usageDays)}
            />
            <RoomMetric icon={<Rows3 className="h-4 w-4" />} label="Travleste dag" value={roomStats.busiestDay} />
            <RoomMetric
              icon={<AlertTriangle className="h-4 w-4" />}
              label="Samtidige bookinger"
              value={String(roomStats.simultaneousBookings)}
            />
            <RoomMetric
              icon={<DoorOpen className="h-4 w-4" />}
              label="Ledige lektioner"
              value={String(roomStats.freeLessons)}
            />
          </div>

          {!roomLessons.length ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-bold leading-7 text-slate-600">
              Lokalet bruges ikke i den visuelle kladde endnu.
            </p>
          ) : null}

          <div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Ugekladde</p>
                <p className="mt-1 break-words text-sm font-black text-slate-950">{resolvedRoom}</p>
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                Bredt preview - scroll vandret på små skærme
              </p>
            </div>

            <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[820px] border-collapse text-left">
                <thead>
                  <tr className="bg-slate-100 text-xs font-black uppercase tracking-[0.12em] text-slate-600">
                    <th className="w-28 border-b border-slate-200 px-3 py-3">Lektion</th>
                    {weekdays.map((day) => (
                      <th key={day} className="border-b border-slate-200 px-3 py-3">
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: lessonCount }, (_, lessonIndex) => (
                    <tr key={lessonIndex + 1} className="border-b border-slate-100 last:border-b-0">
                      <th className="bg-slate-50 px-3 py-3 align-top text-sm font-black text-slate-700">
                        {lessonIndex + 1}. lektion
                      </th>
                      {weekdays.map((day) => {
                        const lessonsInSlot = roomLessons.filter(
                          (lesson) => lesson.day === day && lesson.lesson === lessonIndex + 1,
                        );

                        return (
                          <td key={`${day}-${lessonIndex + 1}`} className="px-2 py-2 align-top">
                            <RoomSlotCell lessons={lessonsInSlot} />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function RoomMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-slate-600">
        {icon}
        <p className="text-xs font-black uppercase tracking-[0.12em]">{label}</p>
      </div>
      <p className="mt-2 break-words text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-bold text-slate-500">Lokalt estimat</p>
    </article>
  );
}

function RoomSlotCell({ lessons }: { lessons: readonly SkemaPilotPreviewCell[] }) {
  if (!lessons.length) {
    return (
      <div className="min-h-16 rounded-lg border border-slate-100 bg-white px-3 py-3 text-sm font-bold text-slate-400">
        Ledig
      </div>
    );
  }

  const isDoubleBooked = new Set(lessons.map((lesson) => lesson.className)).size > 1;

  return (
    <div
      className={`min-h-16 rounded-lg border px-3 py-3 shadow-sm ${
        isDoubleBooked
          ? "border-amber-200 bg-amber-50 text-amber-950"
          : "border-sky-200 bg-sky-50 text-sky-950"
      }`}
    >
      <div className="grid gap-2">
        {lessons.map((lesson) => (
          <div key={`${lesson.className}-${lesson.subject}-${lesson.day}-${lesson.lesson}`} className="min-w-0">
            <p className="break-words text-sm font-black leading-5">{lesson.className}</p>
            <p className="mt-1 break-words text-xs font-black leading-5 opacity-85">{lesson.subject}</p>
            {lesson.teacherName ? (
              <p className="mt-1 break-words text-xs font-bold leading-5 opacity-75">Lærer: {lesson.teacherName}</p>
            ) : null}
            {lesson.teacherMissing ? (
              <p className="mt-2 rounded-md border border-amber-200 bg-white/80 px-2 py-1 text-xs font-black leading-4 text-amber-800">
                Lærer ikke fordelt
              </p>
            ) : null}
          </div>
        ))}
      </div>
      {isDoubleBooked ? (
        <p className="mt-2 rounded-md border border-amber-200 bg-white/80 px-2 py-1 text-xs font-black leading-4 text-amber-800">
          Mulig dobbeltbooking
        </p>
      ) : null}
    </div>
  );
}
