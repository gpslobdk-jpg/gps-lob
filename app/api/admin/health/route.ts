import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { logHandledServerError } from "@/utils/telemetry/serverLogs";

type RaceTypeCount = { race_type: string; count: number };
type TopUser = { name: string; runsCreated: number };

type HealthPayload = {
  activeSessions: number;
  liveStudents: number;
  runsCreated: number;
  stjerneloebCreated: number;
  correctAnswerRate: number | null;
  totalAnswersToday: number;
  raceTypes: RaceTypeCount[];
  topUsers: TopUser[];
  generatedAt: string;
  hours: number;
};

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Du skal være logget ind." }, { status: 401 });
    }

    const adminSupabase = createAdminClient();
    if (!adminSupabase) {
      return NextResponse.json(
        { error: "Serveradgang mangler. Kontakt en administrator." },
        { status: 503 }
      );
    }

    const hoursParam = request.nextUrl.searchParams.get("hours");
    const hours = Math.min(Math.max(Number(hoursParam) || 24, 1), 168);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todaySince = todayStart.toISOString();

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const [
      sessionsResult,
      studentsResult,
      runsResult,
      stjerneloebResult,
      answersResult,
      raceTypesResult,
      topUserRunsResult,
    ] = await Promise.all([
      // Active sessions
      adminSupabase
        .from("live_sessions")
        .select("id", { count: "exact", head: true })
        .in("status", ["active", "running", "waiting"]),

      // Live students: participants with recent activity in active sessions
      adminSupabase.rpc("count_live_students", { since_ts: fiveMinutesAgo }).single(),

      // Runs created in time window
      adminSupabase
        .from("gps_runs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since),

      // Stjerneloeb created in time window
      adminSupabase
        .from("stjerneloeb")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since),

      // Today's answers: correct rate
      adminSupabase
        .from("answers")
        .select("is_correct")
        .gte("created_at", todaySince)
        .limit(5000),

      // Race types today
      adminSupabase
        .from("gps_runs")
        .select("race_type")
        .gte("created_at", todaySince),

      // Top users by runs created in time window
      adminSupabase
        .from("gps_runs")
        .select("user_id")
        .gte("created_at", since),
    ]);

    // -- Active sessions --
    const activeSessions = sessionsResult.count ?? 0;

    // -- Live students (via RPC or fallback) --
    let liveStudents = 0;
    if (studentsResult.error) {
      // Fallback: direct query if RPC doesn't exist
      const fallback = await adminSupabase
        .from("participants")
        .select("student_name", { count: "exact", head: true })
        .gte("last_updated", fiveMinutesAgo);
      liveStudents = fallback.count ?? 0;
    } else {
      liveStudents = (studentsResult.data as { count: number } | null)?.count ?? 0;
    }

    // -- Runs created --
    const runsCreated = runsResult.count ?? 0;
    const stjerneloebCreated = stjerneloebResult.count ?? 0;

    // -- Correct answer rate --
    let correctAnswerRate: number | null = null;
    let totalAnswersToday = 0;
    if (!answersResult.error && answersResult.data) {
      const rows = answersResult.data as { is_correct: boolean | null }[];
      totalAnswersToday = rows.length;
      if (totalAnswersToday > 0) {
        const correctCount = rows.filter((r) => r.is_correct === true).length;
        correctAnswerRate = Math.round((correctCount / totalAnswersToday) * 100);
      }
    }

    // -- Race types --
    const raceTypes: RaceTypeCount[] = [];
    if (!raceTypesResult.error && raceTypesResult.data) {
      const counts = new Map<string, number>();
      for (const row of raceTypesResult.data as { race_type: string | null }[]) {
        const rt = row.race_type ?? "unknown";
        counts.set(rt, (counts.get(rt) ?? 0) + 1);
      }
      for (const [race_type, count] of counts) {
        raceTypes.push({ race_type, count });
      }
      raceTypes.sort((a, b) => b.count - a.count);
    }

    // -- Top 5 users by runs created --
    const topUsers: TopUser[] = [];
    if (!topUserRunsResult.error && topUserRunsResult.data) {
      const userCounts = new Map<string, number>();
      for (const row of topUserRunsResult.data as { user_id: string | null }[]) {
        if (row.user_id) {
          userCounts.set(row.user_id, (userCounts.get(row.user_id) ?? 0) + 1);
        }
      }
      const sorted = [...userCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      if (sorted.length > 0) {
        const userIds = sorted.map(([id]) => id);
        const { data: usersData } = await adminSupabase.auth.admin.listUsers({
          perPage: 50,
        });
        const userMap = new Map<string, string>();
        if (usersData?.users) {
          for (const u of usersData.users) {
            if (userIds.includes(u.id)) {
              const name =
                (u.user_metadata?.full_name as string) ||
                u.email?.split("@")[0] ||
                u.id.slice(0, 8);
              userMap.set(u.id, name);
            }
          }
        }
        for (const [userId, count] of sorted) {
          topUsers.push({
            name: userMap.get(userId) ?? userId.slice(0, 8),
            runsCreated: count,
          });
        }
      }
    }

    const payload: HealthPayload = {
      activeSessions,
      liveStudents,
      runsCreated,
      stjerneloebCreated,
      correctAnswerRate,
      totalAnswersToday,
      raceTypes,
      topUsers,
      generatedAt: new Date().toISOString(),
      hours,
    };

    return NextResponse.json(payload, { headers: NO_STORE_HEADERS });
  } catch (error) {
    await logHandledServerError({
      route: "/api/admin/health",
      method: "GET",
      status: 500,
      error,
      requestPath: "/api/admin/health",
      routeType: "route",
    });

    return NextResponse.json(
      { error: "Health-data kunne ikke hentes." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
