import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const SUPABASE_URL = __ENV.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY || "";
const JOIN_PIN = (__ENV.JOIN_PIN || "0000").trim();
const SESSION_ID = (__ENV.SESSION_ID || "").trim();
const PLAY_SESSION_ID =
  (__ENV.PLAY_SESSION_ID || SESSION_ID || "00000000-0000-0000-0000-000000000000").trim();
const STUDENT_PREFIX = (__ENV.STUDENT_PREFIX || "stress-elev").trim();
const PLAY_NAME = (__ENV.PLAY_NAME || "stress-elev").trim();
const ENABLE_EXTERNAL = (__ENV.ENABLE_EXTERNAL || "true").toLowerCase() === "true";
const VUS = Number(__ENV.VUS || 250);
const DURATION = __ENV.DURATION || "3m";

const hasSupabaseConfig =
  ENABLE_EXTERNAL && SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
const joinLookupTrend = new Trend("join_lookup_duration");
const gpsPingTrend = new Trend("gps_ping_duration");
const joinInsertTrend = new Trend("join_insert_duration");
const pageTrend = new Trend("page_duration");
const scenarioFailureRate = new Rate("scenario_failed");

const supabaseHeaders = hasSupabaseConfig
  ? {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    }
  : null;

export const options = {
  vus: VUS,
  duration: DURATION,
  discardResponseBodies: true,
  noConnectionReuse: false,
  noVUConnectionReuse: false,
  thresholds: {
    http_req_failed: ["rate<0.01"],
    page_duration: ["p(95)<1000"],
    join_lookup_duration: ["p(95)<200"],
    scenario_failed: ["rate<0.01"],
  },
};

function supabaseUrl(path) {
  return `${SUPABASE_URL.replace(/\/$/, "")}${path}`;
}

export default function () {
  const studentName = `${STUDENT_PREFIX}-${__VU}-${__ITER}`;
  const playUrl = `${BASE_URL}/play/${PLAY_SESSION_ID}?name=${encodeURIComponent(PLAY_NAME)}`;
  const lat = 55.6761 + (__VU % 10) * 0.0001;
  const lng = 12.5683 + (__ITER % 10) * 0.0001;

  const pageResponses = http.batch([
    ["GET", `${BASE_URL}/`, null, { tags: { flow: "landing", name: "landing" } }],
    [
      "GET",
      `${BASE_URL}/join`,
      null,
      { tags: { flow: "join-page", name: "join-page" } },
    ],
    ["GET", playUrl, null, { tags: { flow: "play-page", name: "play-page" } }],
  ]);

  for (const response of pageResponses) {
    pageTrend.add(response.timings.duration);
  }

  const pageChecksOk = pageResponses.every((response) =>
    check(response, {
      "side svarer": (res) => res.status >= 200 && res.status < 400,
    })
  );

  let joinLookupOk = true;
  let joinInsertOk = true;
  let gpsPingOk = true;

  if (hasSupabaseConfig) {
    const joinLookup = http.get(
      supabaseUrl(
        `/rest/v1/live_sessions?select=id,status,run_id,created_at&pin=eq.${encodeURIComponent(JOIN_PIN)}&status=in.(waiting,running)&order=created_at.desc&limit=1`
      ),
      {
        headers: supabaseHeaders,
        tags: { flow: "join-lookup" },
      }
    );
    joinLookupTrend.add(joinLookup.timings.duration);
    joinLookupOk = check(joinLookup, {
      "join-opslag accepteret": (res) => res.status >= 200 && res.status < 400,
    });

    if (SESSION_ID) {
      const joinInsert = http.post(
        supabaseUrl("/rest/v1/session_students"),
        JSON.stringify({
          session_id: SESSION_ID,
          student_name: studentName,
        }),
        {
          headers: supabaseHeaders,
          tags: { flow: "join-insert" },
        }
      );
      joinInsertTrend.add(joinInsert.timings.duration);
      joinInsertOk = check(joinInsert, {
        "join-insert accepteret": (res) => res.status >= 200 && res.status < 400,
      });

      const gpsPing = http.patch(
        supabaseUrl(
          `/rest/v1/session_students?session_id=eq.${SESSION_ID}&student_name=eq.${encodeURIComponent(studentName)}`
        ),
        JSON.stringify({
          lat,
          lng,
          last_updated: new Date().toISOString(),
        }),
        {
          headers: supabaseHeaders,
          tags: { flow: "gps-ping" },
        }
      );
      gpsPingTrend.add(gpsPing.timings.duration);
      gpsPingOk = check(gpsPing, {
        "gps-ping accepteret": (res) => res.status >= 200 && res.status < 400,
      });
    }
  }

  scenarioFailureRate.add(!(pageChecksOk && joinLookupOk && joinInsertOk && gpsPingOk));
  sleep(1);
}
