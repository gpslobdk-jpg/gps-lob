import type {
  LiveAnswer,
  LiveStudentLocation,
  SessionMessage,
} from "@/components/live/types";

export type LeaderboardEntry = {
  student: LiveStudentLocation;
  score: number;
  correctAnswers: number;
  wrongAnswers: number;
  progressPercent: number;
  elapsedTimeMs: number | null;
};

export type FeedItem =
  | {
      id: string;
      type: "answer";
      createdAt: string | null;
      answer: LiveAnswer;
    }
  | {
      id: string;
      type: "message";
      createdAt: string | null;
      message: SessionMessage;
    };

export function formatFeedTime(value: string | null | undefined) {
  if (!value) return "Nu";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Nu";

  return date.toLocaleTimeString("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getStudentInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function getPhotoLabel(answer: LiveAnswer) {
  return answer.postNumber !== null ? `Post ${answer.postNumber}` : "Foto-mission";
}

export function getPhotoAltText(answer: LiveAnswer) {
  return `${answer.studentName} - ${getPhotoLabel(answer)}`;
}

function toTimestamp(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

export function buildLeaderboardEntries(
  activeStudents: LiveStudentLocation[],
  allParticipants: LiveStudentLocation[] | undefined,
  sessionAnswers: LiveAnswer[]
): LeaderboardEntry[] {
  const participants = allParticipants ?? activeStudents;
  const scores = new Map<string, number>();
  const correctAnswers = new Map<string, number>();
  const wrongAnswers = new Map<string, number>();
  const firstAnswerAt = new Map<string, string | null>();
  const lastAnswerAt = new Map<string, string | null>();

  for (const answer of sessionAnswers) {
    const scoreKey = answer.participantId ?? answer.studentName;

    if (answer.isCorrect === true) {
      scores.set(scoreKey, (scores.get(scoreKey) ?? 0) + answer.awardedPoints);
      correctAnswers.set(scoreKey, (correctAnswers.get(scoreKey) ?? 0) + 1);
    } else if (answer.isCorrect === false) {
      wrongAnswers.set(scoreKey, (wrongAnswers.get(scoreKey) ?? 0) + 1);
    }

    const answerTs = toTimestamp(answer.createdAt);
    if (answerTs !== null) {
      const existingFirst = toTimestamp(firstAnswerAt.get(scoreKey));
      if (existingFirst === null || answerTs < existingFirst) {
        firstAnswerAt.set(scoreKey, answer.createdAt);
      }
      const existingLast = toTimestamp(lastAnswerAt.get(scoreKey));
      if (existingLast === null || answerTs > existingLast) {
        lastAnswerAt.set(scoreKey, answer.createdAt);
      }
    }
  }

  const highestScore = Math.max(1, ...participants.map((student) => scores.get(student.id) ?? 0));

  return [...participants]
    .map((student) => {
      const score = scores.get(student.id) ?? scores.get(student.name) ?? 0;
      const startTs = toTimestamp(student.run_started_at) ?? toTimestamp(firstAnswerAt.get(student.id) ?? firstAnswerAt.get(student.name));
      const endTs = toTimestamp(student.finished_at) ?? toTimestamp(lastAnswerAt.get(student.id) ?? lastAnswerAt.get(student.name));
      const elapsedTimeMs =
        startTs !== null && endTs !== null && endTs >= startTs ? endTs - startTs : null;

      return {
        student,
        score,
        correctAnswers:
          correctAnswers.get(student.id) ?? correctAnswers.get(student.name) ?? 0,
        wrongAnswers:
          wrongAnswers.get(student.id) ?? wrongAnswers.get(student.name) ?? 0,
        progressPercent: Math.max(8, Math.round((score / highestScore) * 100)),
        elapsedTimeMs,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.correctAnswers !== a.correctAnswers) return b.correctAnswers - a.correctAnswers;

      // Tie-break by total elapsed time (faster wins)
      const aTime = a.elapsedTimeMs ?? Number.POSITIVE_INFINITY;
      const bTime = b.elapsedTimeMs ?? Number.POSITIVE_INFINITY;
      if (aTime !== bTime) return aTime - bTime;

      return a.student.name.localeCompare(b.student.name, "da");
    });
}

export function buildLiveFeed(
  hasAnswersTable: boolean,
  liveAnswers: LiveAnswer[],
  messages: SessionMessage[]
): FeedItem[] {
  const answerItems: FeedItem[] = hasAnswersTable
    ? liveAnswers.map((answer) => ({
        id: `answer-${answer.id}`,
        type: "answer",
        createdAt: answer.createdAt,
        answer,
      }))
    : [];

  const messageItems: FeedItem[] = messages.map((message, index) => ({
    id: `message-${message.sender_name}-${message.created_at ?? index}`,
    type: "message",
    createdAt: message.created_at ?? null,
    message,
  }));

  return [...answerItems, ...messageItems].sort((a, b) => {
    const aTs = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTs = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTs - aTs;
  });
}

export function getPhotoAnswers(liveAnswers: LiveAnswer[]) {
  return liveAnswers.filter((answer) => Boolean(answer.image_url));
}