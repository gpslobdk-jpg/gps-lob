import type {
  LiveAnswer,
  LiveStudentLocation,
  SessionMessage,
} from "@/components/live/types";

export type LeaderboardEntry = {
  student: LiveStudentLocation;
  score: number;
  correctAnswers: number;
  progressPercent: number;
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

export function buildLeaderboardEntries(
  activeStudents: LiveStudentLocation[],
  allParticipants: LiveStudentLocation[] | undefined,
  liveAnswers: LiveAnswer[]
): LeaderboardEntry[] {
  const participants = allParticipants ?? activeStudents;
  const scores = new Map<string, number>();
  const correctAnswers = new Map<string, number>();

  for (const answer of liveAnswers) {
    if (answer.isCorrect !== true) continue;
    const scoreKey = answer.participantId ?? answer.studentName;
    scores.set(scoreKey, (scores.get(scoreKey) ?? 0) + answer.awardedPoints);
    correctAnswers.set(scoreKey, (correctAnswers.get(scoreKey) ?? 0) + 1);
  }

  const highestScore = Math.max(1, ...participants.map((student) => scores.get(student.id) ?? 0));

  return [...participants]
    .map((student) => {
      const score = scores.get(student.id) ?? scores.get(student.name) ?? 0;

      return {
        student,
        score,
        correctAnswers:
          correctAnswers.get(student.id) ?? correctAnswers.get(student.name) ?? 0,
        progressPercent: Math.max(8, Math.round((score / highestScore) * 100)),
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.correctAnswers !== a.correctAnswers) return b.correctAnswers - a.correctAnswers;
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