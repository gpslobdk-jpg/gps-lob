export type QuestionType = "multiple_choice" | "ai_image" | "unknown";

export type Question = {
  type: QuestionType;
  text: string;
  aiPrompt?: string;
  hint?: string;
  answers: string[];
  correctIndex: number | null;
  lat: number;
  lng: number;
  mediaUrl?: string;
  isSelfie?: boolean;
};

export type Post = {
  id: number;
  type: Extract<QuestionType, "multiple_choice" | "ai_image">;
  lat: number;
  lng: number;
  question: string;
  options: [string, string, string, string];
  answer: string;
  mission: string;
  unlockRange: number;
};

export type ActivePostVariant = "quiz" | "photo" | "escape" | "roleplay" | "unknown";
export type RaceMode = ActivePostVariant;
export type GpsErrorState = "permission_denied" | "position_unavailable" | "timeout" | "unsupported";
export type FeedbackTone = "success" | "error";
export type RoleplayReplyTone = "success" | "hint";
export type MasterLockStatus = "locked" | "unlocked";
export type PlayScreenMode =
  | "loading"
  | "load_error"
  | "kicked"
  | "name_gate"
  | "gps_blocked"
  | "escape_master_lock"
  | "escape_results"
  | "finished"
  | "active";

export type PhotoFeedbackState = {
  key: string;
  tone: FeedbackTone;
  message: string;
} | null;

export type PostActionErrorState = {
  key: string;
  message: string;
} | null;

export type QuizAnswerFeedbackState = {
  key: string;
  selectedIndex: number;
  tone: FeedbackTone;
} | null;

export type EscapeRewardState = {
  key: string;
  brick: string;
} | null;

export type EscapeCodeEntry = {
  postIndex: number;
  brick: string;
};

export type RoleplayReplyState = {
  key: string;
  message: string;
  tone: RoleplayReplyTone;
  canContinue: boolean;
  isLoading?: boolean;
} | null;

export type Location = {
  lat: number;
  lng: number;
};

export type GpsErrorContent = {
  title: string;
  message: string;
  helper: string;
};

export type SupabaseErrorLike = {
  code?: string;
  message?: string;
};

export type StoredActiveParticipant = {
  participantId: string;
  sessionId: string;
  studentName: string;
  savedAt: string;
};

export type ParticipantRow = {
  id?: string | null;
  session_id?: string | null;
  student_name?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  finished_at?: string | null;
};

export type EscapeResultEntry = {
  place: number;
  studentName: string;
  finishedAt: string | null;
};

export type PlaySessionPayload = {
  questions?: unknown;
  raceType?: unknown;
  error?: string;
};

export type AnswerProgressRow = {
  post_index?: number | string | null;
  question_index?: number | string | null;
  is_correct?: boolean | null;
};

export type ValidateAnswerPayload = {
  isCorrect?: boolean;
  brick?: string | null;
  error?: string;
};

export type WakeLockSentinelLike = {
  released?: boolean;
  release: () => Promise<void>;
};

export type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockSentinelLike>;
  };
};

export interface PlayPlayerState {
  pendingPlayerName: string;
  playerName: string;
  hasConfirmedName: boolean;
  nameError: string | null;
  participantId: string | null;
  activeDisplayName: string;
  celebrationName: string;
}

export interface PlayGpsState {
  myLoc: Location | null;
  distance: number | null;
  gpsError: GpsErrorState | null;
  gpsErrorContent: GpsErrorContent | null;
  gpsWarningContent: GpsErrorContent | null;
}

export interface PlayProgressState {
  questions: Question[];
  raceMode: RaceMode;
  currentPostIndex: number;
  totalQuestions: number;
  progressPercent: number;
  correctAnswersCount: number;
  dismissedPostIndex: number | null;
  showQuestion: boolean;
  currentPost: PlayCurrentPostState;
  escape: PlayEscapeState;
  feedback: PlayFeedbackState;
  screen: PlayScreenState;
  map: PlayMapState;
}

export interface PlayCurrentPostState {
  activeQuestion: Question | undefined;
  activePostVariant: ActivePostVariant;
  activeQuestionDisplayText: string;
  activeTypedAnswerKey: string;
  activeTypedAnswerError: string | null;
  activePostActionError: string | null;
  activePhotoFeedback: PhotoFeedbackState;
  activeQuizAnswerFeedback: QuizAnswerFeedbackState;
  activeEscapeReward: string | null;
  activeEscapeHint: string;
  activeRoleplayReply: RoleplayReplyState;
  activeRoleplayReplyMessage: string | null;
  roleplayCharacterName: string;
  roleplayAvatar: string;
}

export interface PlayEscapeState {
  collectedRewards: EscapeCodeEntry[];
  collectedRewardsCount: number;
  escapeCodeOverview: string[];
  escapeCodeOverviewText: string;
  escapeResults: EscapeResultEntry[];
  escapeResultsError: string | null;
  isLoadingEscapeResults: boolean;
  masterLockInput: string;
  masterLockError: string | null;
  masterLockStatus: MasterLockStatus;
  masterLockShakeNonce: number;
  isFinalizingEscape: boolean;
  showEscapeResults: boolean;
  showMasterVictory: boolean;
  wrongAttempts: number;
  myEscapePlacement: EscapeResultEntry | null;
}

export interface PlayFeedbackState {
  photoFeedback: PhotoFeedbackState;
  postActionError: PostActionErrorState;
  quizAnswerFeedback: QuizAnswerFeedbackState;
  escapeReward: EscapeRewardState;
  roleplayReply: RoleplayReplyState;
  typedAnswerError: {
    key: string;
    message: string;
  } | null;
  latestMessage: string | null;
  resumeMessage: string | null;
}

export interface PlayScreenState {
  mode: PlayScreenMode;
  isLoading: boolean;
  loadError: string;
  isFinished: boolean;
  isKicked: boolean;
}

export interface PlayUiFlags {
  canManualUnlock: boolean;
  hasActivePhotoSuccess: boolean;
  hasActiveQuizSuccess: boolean;
  hasAllEscapeBricks: boolean;
  hasRoleplayInputErrorTone: boolean;
  isBlockingGpsError: boolean;
  isEscapeRace: boolean;
  isRoleplayImmersed: boolean;
  isSelfiePhotoTask: boolean;
  isSubmitting: boolean;
  isSubmittingAnswer: boolean;
  isAnalyzingPhoto: boolean;
  isCheckingEscapeAnswer: boolean;
  shouldKeepScreenAwake: boolean;
}

export interface PlayMapState {
  playerLocation: Location | null;
  playerName: string;
  targetLocation: Location | null;
  targetLabel: string;
}

export interface PlayActions {
  confirmName: (name: string) => void;
  setPendingPlayerName: (value: string) => void;
  setMasterLockInput: (value: string) => void;
  setShowEscapeResults: (value: boolean) => void;
  clearTypedAnswerError: () => void;
  clearPostActionError: () => void;
  clearRoleplayInputErrorTone: () => void;
  unlockCurrentPost: () => void;
  dismissCurrentPost: () => void;
  clearDismissedPost: () => void;
  reloadPage: () => void;
  continueFromSolvedPost: () => Promise<boolean>;
  submitQuizAnswer: (selectedIndex: number) => Promise<void>;
  submitTypedAnswer: (answer: string) => Promise<void>;
  submitPhoto: (file: File) => Promise<void>;
  submitMasterCode: (code: string) => Promise<void>;
  setLiveLocation: (location: Location | null) => void;
  setDistance: (distance: number | null) => void;
  setGpsError: (error: GpsErrorState | null) => void;
  syncParticipantLocation: (lat: number, lng: number) => Promise<void>;
}

export interface PlayGameState {
  player: PlayPlayerState;
  gps: PlayGpsState;
  progress: PlayProgressState;
  flags: PlayUiFlags;
  actions: PlayActions;
}

export type PlayUiState = Omit<PlayGameState, "actions">;
