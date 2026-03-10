export type SessionStatus = "waiting" | "running" | "finished" | string;

export type SessionRow = {
  pin: string | null;
  status: string | null;
  run_id: string | null;
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
  finished_at?: string | null;
};

export type LiveStudentLocation = {
  id: string;
  name: string;
  student_name: string;
  lat: number | null;
  lng: number | null;
  updated_at?: string | null;
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
  student_name?: string | null;
  post_index?: number | string | null;
  question_index?: number | string | null;
  is_correct?: boolean | null;
  created_at?: string | null;
  answered_at?: string | null;
};

export type LiveAnswer = {
  id: string;
  studentName: string;
  postNumber: number | null;
  isCorrect: boolean | null;
  createdAt: string | null;
};

export type TeacherLiveData = {
  sessionId: string | null;
  pin: string;
  joinPin: string;
  students: string[];
  isLoading: boolean;
  status: SessionStatus;
  messages: SessionMessage[];
  newMessage: string;
  studentLocations: LiveStudentLocation[];
  runQuestions: RunQuestion[];
  liveAnswers: LiveAnswer[];
  hasParticipantsTable: boolean;
  hasAnswersTable: boolean;
  isEndingRun: boolean;
  activeStudents: LiveStudentLocation[];
  finishers: LiveStudentLocation[];
  winnerCelebrationName: string;
  mapCenter: [number, number];
  mapKey: string;
  setNewMessage: (value: string) => void;
  sendMessage: () => Promise<void>;
  startSession: () => Promise<void>;
  endRun: () => Promise<void>;
  kickParticipant: (student: LiveStudentLocation) => Promise<void>;
};
