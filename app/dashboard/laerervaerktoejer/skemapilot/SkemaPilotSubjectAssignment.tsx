"use client";

export type SubjectAssignmentMap = Record<string, string>;

export type SubjectAssignmentTeacher = {
  id: string;
  name: string;
  subjects: string;
  wishes: string;
};

export type SubjectAssignmentRow = {
  assignmentKey: string;
  className: string;
  lessons: number;
  subject: string;
  teacherId: string;
};

export type SubjectAssignmentStatus = {
  assignedItems: number;
  completionPercentage: number;
  missingItems: number;
  totalItems: number;
};

export type TeacherLoad = {
  lessons: number;
  teacherId: string;
  teacherName: string;
};

type SkemaPilotSubjectAssignmentProps = {
  activeClasses: readonly string[];
  getLessonValue: (className: string, subject: string) => string;
  rubikClassName: string;
  subjectAssignments: SubjectAssignmentMap;
  subjects: readonly string[];
  teachers: readonly SubjectAssignmentTeacher[];
  onUpdateAssignment: (assignmentKey: string, teacherId: string) => void;
};

const selectClassName =
  "min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";

export function SkemaPilotSubjectAssignment({
  activeClasses,
  getLessonValue,
  rubikClassName,
  subjectAssignments,
  subjects,
  teachers,
  onUpdateAssignment,
}: SkemaPilotSubjectAssignmentProps) {
  const rows = buildSubjectAssignmentRows(activeClasses, subjects, getLessonValue, subjectAssignments);
  const status = getSubjectAssignmentStatus(rows, teachers);
  const availableTeachers = getAvailableSubjectTeachers(teachers);
  const availableTeacherIds = new Set(availableTeachers.map((teacher) => teacher.id));
  const teacherLoads = getTeacherLoadStats(rows, teachers);

  return (
    <div className="grid gap-6">
      <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Fagfordeling</p>
        <h3 className={`mt-2 text-2xl font-black tracking-tight ${rubikClassName}`}>
          Fordel fagposter til lærere
        </h3>
        <p className="mt-3 max-w-3xl text-sm font-bold leading-7">
          Vælg en lærer for hvert fag og hver klasse med lokalt timetal. Fagfordelingen bruges kun lokalt i
          prototypen og bygger ikke et færdigt arbejdsskema.
        </p>
      </section>

      <div className="grid gap-3 md:grid-cols-4">
        <StatusBox label="Fagposter i alt" value={String(status.totalItems)} />
        <StatusBox label="Fordelt til lærer" value={String(status.assignedItems)} />
        <StatusBox label="Mangler lærer" value={String(status.missingItems)} />
        <StatusBox label="Klar" value={`${status.completionPercentage} %`} />
      </div>

      {!availableTeachers.length ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-7 text-amber-950">
          Tilføj lærere på forrige trin for at kunne lave fagfordeling.
        </section>
      ) : null}

      <div className="grid gap-4">
        {activeClasses.map((className) => {
          const classRows = rows.filter((row) => row.className === className);

          return (
            <section key={className} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Klasse</p>
                  <h4 className={`mt-1 text-2xl font-black tracking-tight text-slate-950 ${rubikClassName}`}>
                    {className}
                  </h4>
                </div>
                <p className="text-sm font-bold text-slate-500">
                  {classRows.length} relevante fagposter
                </p>
              </div>

              {classRows.length ? (
                <div className="mt-4 grid gap-3">
                  {classRows.map((row) => {
                    const selectedTeacherId = availableTeacherIds.has(row.teacherId) ? row.teacherId : "";

                    return (
                      <div
                        key={row.assignmentKey}
                        className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_240px]"
                      >
                        <div className="min-w-0">
                          <p className="break-words text-sm font-black text-slate-950">{row.subject}</p>
                          <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                            {formatLessonCount(row.lessons)} lektioner/uge
                          </p>
                        </div>
                        <label className="block">
                          <span className="sr-only">
                            Vælg lærer til {row.subject} i {row.className}
                          </span>
                          <select
                            className={selectClassName}
                            disabled={!availableTeachers.length}
                            value={selectedTeacherId}
                            onChange={(event) => onUpdateAssignment(row.assignmentKey, event.target.value)}
                          >
                            <option value="">Ikke fordelt endnu</option>
                            {availableTeachers.map((teacher) => (
                              <option key={teacher.id} value={teacher.id}>
                                {getTeacherDisplayName(teacher)}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-600">
                  Klassen har ingen fagposter med lokalt timetal over 0.
                </p>
              )}
            </section>
          );
        })}
      </div>

      <section className="rounded-lg border border-slate-200 bg-slate-50 p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Lærerbelastning</p>
            <h4 className={`mt-2 text-2xl font-black tracking-tight text-slate-950 ${rubikClassName}`}>
              Lokalt estimat
            </h4>
          </div>
          <p className="text-sm font-bold leading-6 text-slate-600">
            Baseret på fordelte fagposter, ikke et færdigt arbejdsskema.
          </p>
        </div>

        {teacherLoads.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {teacherLoads.map((load) => (
              <article key={load.teacherId} className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="break-words text-sm font-black text-slate-950">{load.teacherName}</p>
                <p className="mt-2 text-2xl font-black text-emerald-700">{formatLessonCount(load.lessons)}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                  lektioner/uge
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-lg border border-slate-200 bg-white p-4 text-sm font-bold text-slate-600">
            Lærerbelastning vises, når der er navngivne lærere.
          </p>
        )}
      </section>
    </div>
  );
}

function StatusBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

export function buildSubjectAssignmentRows(
  activeClasses: readonly string[],
  subjects: readonly string[],
  getLessonValue: (className: string, subject: string) => string,
  subjectAssignments: SubjectAssignmentMap,
): SubjectAssignmentRow[] {
  return activeClasses.flatMap((className) =>
    subjects
      .map((subject) => {
        const assignmentKey = getSubjectAssignmentKey(className, subject);
        const lessons = Number(getLessonValue(className, subject)) || 0;

        return {
          assignmentKey,
          className,
          lessons,
          subject,
          teacherId: subjectAssignments[assignmentKey] ?? "",
        };
      })
      .filter((row) => row.lessons > 0),
  );
}

export function getSubjectAssignmentStatus(
  rows: readonly SubjectAssignmentRow[],
  teachers: readonly SubjectAssignmentTeacher[],
): SubjectAssignmentStatus {
  const availableTeacherIds = new Set(getAvailableSubjectTeachers(teachers).map((teacher) => teacher.id));
  const assignedItems = rows.filter((row) => row.teacherId && availableTeacherIds.has(row.teacherId)).length;
  const totalItems = rows.length;
  const missingItems = Math.max(0, totalItems - assignedItems);

  return {
    assignedItems,
    completionPercentage: totalItems ? Math.round((assignedItems / totalItems) * 100) : 0,
    missingItems,
    totalItems,
  };
}

export function getTeacherLoadStats(
  rows: readonly SubjectAssignmentRow[],
  teachers: readonly SubjectAssignmentTeacher[],
): TeacherLoad[] {
  const availableTeachers = getAvailableSubjectTeachers(teachers);

  return availableTeachers.map((teacher) => {
    const lessons = rows
      .filter((row) => row.teacherId === teacher.id)
      .reduce((total, row) => total + row.lessons, 0);

    return {
      lessons,
      teacherId: teacher.id,
      teacherName: getTeacherDisplayName(teacher),
    };
  });
}

export function getAvailableSubjectTeachers(teachers: readonly SubjectAssignmentTeacher[]) {
  return teachers.filter((teacher) => Boolean(teacher.name.trim()));
}

export function getSubjectAssignmentKey(className: string, subject: string) {
  return `${className}::${subject}`;
}

export function getTeacherDisplayName(teacher: SubjectAssignmentTeacher) {
  return teacher.name.trim() || "Unavngiven lærer";
}

export function formatLessonCount(lessons: number) {
  return Number.isInteger(lessons) ? String(lessons) : lessons.toFixed(1).replace(".", ",");
}
