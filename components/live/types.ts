export type SessionStatus = "waiting" | "running" | "paused" | "finished" | string;

export type SessionRow = {
  pin: string | null;
  status: string | null;
  run_id: string | null;
  gps_override?: boolean | null;
};

export type SessionMessage = {
  sender_name: string;
  is_teacher: boolean;
  message: string;
  created_at?: string | null;
};

export type StudentRow = {
  id?: string | number | null;
  session_id?: string | null;
  student_name?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  updated_at?: string | null;
  run_started_at?: string | null;
  finished_at?: string | null;
};

export type LiveStudentLocation = {
  id: string;
  name: string;
  student_name: string;
  lat: number | null;
  lng: number | null;
  updated_at?: string | null;
  run_started_at?: string | null;
  finished_at?: string | null;
};

export type RunQuestion = {
  type?: "multiple_choice" | "ai_image";
  lat?: number | string | null;
  lng?: number | string | null;
  text?: string | null;
  aiPrompt?: string | null;
  ai_prompt?: string | null;
};

export type AnswerRow = {
  id?: string | number | null;
  participant_id?: string | number | null;
  student_name?: string | null;
  post_index?: number | string | null;
  question_index?: number | string | null;
  is_correct?: boolean | null;
  awarded_points?: number | string | null;
  image_url?: string | null;
  created_at?: string | null;
  answered_at?: string | null;
};

export type LiveAnswer = {
  id: string;
  participantId: string | null;
  studentName: string;
  postNumber: number | null;
  isCorrect: boolean | null;
  awardedPoints: number;
  image_url: string | null;
  createdAt: string | null;
};

export type LiveModuleId = "leaderboard" | "feed" | "photos";

export type TeacherLiveFeedStatus = "connecting" | "live" | "recovering";

export type TeacherLiveTheme = {
  vm26?: {
    enabled: true;
    templateId: string;
    version: number;
  };
};

export type TeacherLiveStanding = {
  student: LiveStudentLocation;
  score: number;
  correctAnswers: number;
  completedPosts: number;
  progressPercent: number;
  firstAnswerAt: string | null;
  lastActivityAt: string | null;
  elapsedTimeMs: number | null;
};

export type TeacherLiveData = {
  sessionId: string | null;
  pin: string;
  joinPin: string;
  students: string[];
  isLoading: boolean;
  liveFeedStatus: TeacherLiveFeedStatus;
  liveFeedLastSyncedAt: string | null;
  status: SessionStatus;
  gpsOverride: boolean;
  isUpdatingGpsOverride: boolean;
  runRaceType: string | null;
  theme?: TeacherLiveTheme;
  isPhotoMission: boolean;
  messages: SessionMessage[];
  newMessage: string;
  studentLocations: LiveStudentLocation[];
  runQuestions: RunQuestion[];
  liveAnswers: LiveAnswer[];
  sessionAnswers: LiveAnswer[];
  photoAnswers: LiveAnswer[];
  hasParticipantsTable: boolean;
  hasAnswersTable: boolean;
  isEndingRun: boolean;
  isUpdatingPause: boolean;
  activeStudents: LiveStudentLocation[];
  finishers: LiveStudentLocation[];
  finalStandings: TeacherLiveStanding[];
  winnerCelebrationName: string;
  totalPosts: number;
  mapCenter: [number, number];
  mapKey: string;
  setNewMessage: (value: string) => void;
  sendMessage: () => Promise<void>;
  toggleGpsOverride: () => Promise<void>;
  togglePause: () => Promise<void>;
  startSession: () => Promise<void>;
  endRun: () => Promise<void>;
  kickParticipant: (student: LiveStudentLocation) => Promise<void>;
};
