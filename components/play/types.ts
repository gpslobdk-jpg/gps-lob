export type QuestionType = "multiple_choice" | "ai_image" | "unknown";

export type Question = {
  type: QuestionType;
  postType?: PostType;
  text: string;
  aiPrompt?: string;
  hint?: string;
  answers: string[];
  correctIndex: number | null;
  points: number;
  lat: number;
  lng: number;
  mediaUrl?: string;
  isSelfie?: boolean;
  /** Musikquiz: 30s preview-lyd fra iTunes/lignende udbyder */
  previewUrl?: string;
  /** Musikquiz: album-artwork thumbnail URL */
  artworkUrl?: string;
  /** Musikquiz: kunstnernavn */
  musicArtist?: string;
  /** Musikquiz: kilde-udbyder, fx "itunes" */
  musicProvider?: string;
  /** Musikquiz: udbyderens unikke track-id */
  providerTrackId?: string | number;
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
export type RaceMode = ActivePostVariant | "zone_krig" | "stratego";
export type PostType = "quiz" | "intro";
export type FeedbackTone = "success" | "error";
export type RoleplayReplyTone = "success" | "hint";
export type MasterLockStatus = "locked" | "unlocked";
export type PlayScreenMode =
  | "loading"
  | "load_error"
  | "waiting"
  | "kicked"
  | "name_gate"
  | "avatar_gate"
  | "escape_master_lock"
  | "escape_results"
  | "finished"
  | "active";

export type PlayLoadErrorVariant =
  | "generic"
  | "restore_recovery"
  | "participant_auth_expired"
  | "join_session_missing";

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

export type ZoneKrigCaptureStatus =
  | "captured"
  | "blocked_by_shield"
  | "already_owned"
  | "zone_missing"
  | "game_over";

export type ZoneKrigCaptureApiResult = {
  status?: ZoneKrigCaptureStatus;
  shieldRemainingSeconds?: number | null;
} | null;

export type ZoneKrigCaptureFeedbackState = {
  key: string;
  status: ZoneKrigCaptureStatus;
  message: string;
  shieldRemainingSeconds?: number;
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
  accuracy?: number | null;
  timestampMs?: number | null;
};

export type TeacherBroadcastMessage = {
  key: string;
  message: string;
  createdAt: string | null;
};

export type SupabaseErrorLike = {
  code?: string;
  message?: string;
};

export type StoredActiveParticipant = {
  participantId: string;
  sessionId: string;
  studentName: string;
  startOffset?: number;
  savedAt: string;
  teamId?: string | null;
  teamColor?: string | null;
  avatarUrl?: string | null;
  sessionStatus?: string | null;
  hasCompletedAvatarGate?: boolean;
};

export type StoredPendingAnswer = {
  id: string;
  payloads: Record<string, unknown>[];
  solvedPostIndex: number;
  awardedPoints: number;
};

export type StoredPlaySnapshot = {
  participantId: string;
  sessionId: string;
  currentPostIndex: number;
  solvedPostIndexes: number[];
  answeredPostIndexes: number[];
  burnedPosts: number[];
  correctAnswersCount: number;
  score: number;
  showQuestion: boolean;
  dismissedPostIndex: number | null;
  playStartedAtMs: number | null;
  playFinishedAtMs: number | null;
  pendingAnswers: StoredPendingAnswer[];
  savedAt: string;
};

export type ParticipantRow = {
  id?: string | null;
  session_id?: string | null;
  student_name?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  accuracy?: number | string | null;
  spawn_shield_until?: string | null;
  run_started_at?: string | null;
  finished_at?: string | null;
  start_offset?: number | string | null;
};

export type EscapeResultEntry = {
  place: number;
  studentName: string;
  finishedAt: string | null;
};

export type StrategoPresenceEntry = {
  participantId: string;
  sessionId: string;
  teamCode: string;
  state: string;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  updatedAt: string | null;
  spawnShieldUntil: string | null;
};

export type StrategoSelfPlayer = {
  participantId: string;
  sessionId: string;
  teamCode: string;
  state: string;
  rankKey: string | null;
  lastDuelAt: string | null;
};

export type StrategoDuelEvent = {
  id: string;
  sessionId: string;
  winnerId: string | null;
  loserId: string | null;
  attackerId: string;
  defenderId: string;
  attackerRoleKey: string;
  defenderRoleKey: string;
  isDraw: boolean;
  createdAt: string | null;
};

export type PlaySessionPayload = {
  questions?: unknown;
  raceType?: unknown;
  radius?: number | null;
  gpsOverride?: boolean;
  bonusEnabled?: boolean;
  error?: string;
};

export type AnswerProgressRow = {
  post_index?: number | string | null;
  question_index?: number | string | null;
  is_correct?: boolean | null;
  awarded_points?: number | string | null;
};

export type ValidateAnswerPayload = {
  isCorrect?: boolean;
  isLocked?: boolean;
  brick?: string | null;
  awardedPoints?: number;
  zoneKrigCapture?: ZoneKrigCaptureApiResult;
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
  pendingAvatarUrl?: string;
  playerName: string;
  avatarUrl?: string;
  hasConfirmedName: boolean;
  hasCompletedAvatarGate: boolean;
  nameError: string | null;
  participantId: string | null;
  teamId: string | null;
  teamColor: string | null;
  activeDisplayName: string;
  celebrationName: string;
}

export interface PlayGpsState {
  myLoc: Location | null;
  distance: number | null;
  autoUnlockRadius: number | null;
}

export interface PlayProgressState {
  questions: Question[];
  raceMode: RaceMode;
  currentPostIndex: number;
  solvedPostIndexes: number[];
  answeredPostIndexes: number[];
  displayPostNumber: number;
  totalQuestions: number;
  progressPercent: number;
  score: number;
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
  activeQuizPostBurned: boolean;
  activeZoneKrigCaptureFeedback: ZoneKrigCaptureFeedbackState;
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
  zoneKrigCaptureFeedback: ZoneKrigCaptureFeedbackState;
  escapeReward: EscapeRewardState;
  roleplayReply: RoleplayReplyState;
  typedAnswerError: {
    key: string;
    message: string;
  } | null;
  latestMessage: TeacherBroadcastMessage | null;
  resumeMessage: string | null;
  wrongAnswerFeedback: string | null;
}

export interface PlayScreenState {
  mode: PlayScreenMode;
  isLoading: boolean;
  loadError: string;
  loadErrorVariant: PlayLoadErrorVariant;
  isFinished: boolean;
  isKicked: boolean;
  playStartedAtMs: number | null;
  playFinishedAtMs: number | null;
}

export interface PlayStrategoState {
  selfPlayer: StrategoSelfPlayer | null;
  selfPresence: StrategoPresenceEntry | null;
  allyPresence: StrategoPresenceEntry[];
  enemyPresence: StrategoPresenceEntry[];
  nearestEnemyDistanceMeters: number | null;
  nearestEnemySignalBand: "none" | "far" | "medium" | "near" | "attack";
  isInSafeZone: boolean;
  isRealtimeRecovering: boolean;
  isDuelCooldownActive: boolean;
  duelCooldownRemainingSeconds: number;
  isSpawnShieldActive: boolean;
  spawnShieldRemainingSeconds: number;
  targetInSight: StrategoPresenceEntry | null;
  duelEvent: StrategoDuelEvent | null;
  duelInFlight: boolean;
  duelError: string | null;
  respawnMessage: string | null;
  isLoading: boolean;
  error: string | null;
}

export interface PlayUiFlags {
  canManualUnlock: boolean;
  gpsOverrideEnabled: boolean;
  hasActivePhotoSuccess: boolean;
  hasActiveQuizSuccess: boolean;
  hasAllEscapeBricks: boolean;
  hasRoleplayInputErrorTone: boolean;
  isProvisioningParticipant: boolean;
  isEscapeRace: boolean;
  isStrategoRace: boolean;
  isRoleplayImmersed: boolean;
  isSelfiePhotoTask: boolean;
  isClosing: boolean;
  isSubmitting: boolean;
  isSubmittingAnswer: boolean;
  isAnalyzingPhoto: boolean;
  isCheckingEscapeAnswer: boolean;
  isSessionPaused: boolean;
  shouldKeepScreenAwake: boolean;
  /** Feature-flag fra gps_runs.bonus_enabled. false = CTA vises ikke. */
  bonusEnabled: boolean;
}

export interface PlayMapState {
  playerLocation: Location | null;
  playerName: string;
  avatarUrl?: string;
  targetLocation: Location | null;
  targetLabel: string;
  targetNumber: number | null;
  isNearTarget: boolean;
  canOpenTarget: boolean;
  distanceToTargetMeters: number | null;
}

export interface MapDisplayProps {
  playerLocation: Location | null;
  targetLocation: Location | null;
  targetLabel: string;
  targetNumber: number | null;
  playerName: string;
  avatarUrl?: string;
  dimmed: boolean;
  isNearTarget: boolean;
  canOpenTarget: boolean;
  distanceToTargetMeters: number | null;
  onTargetClick?: () => void;
}

export interface PlayActions {
  confirmName: (name: string) => void;
  completeAvatarSetup: (skip: boolean) => void;
  setPendingPlayerName: (value: string) => void;
  setPendingAvatarUrl: (value: string | null) => void;
  selectPostIndex: (index: number) => void;
  setMasterLockInput: (value: string) => void;
  setShowEscapeResults: (value: boolean) => void;
  dismissLatestMessage: () => void;
  clearTypedAnswerError: () => void;
  clearPostActionError: () => void;
  clearRoleplayInputErrorTone: () => void;
  clearStrategoDuelEvent: () => void;
  triggerStrategoDuel: (targetId: string) => Promise<void>;
  unlockCurrentPost: () => void;
  dismissCurrentPost: () => void;
  clearDismissedPost: () => void;
  retryRestoreConnection: () => void;
  reloadPage: () => void;
  resetFromExpired: () => void;
  retrySessionStatus: () => Promise<void>;
  startOver: () => void;
  continueFromSolvedPost: () => Promise<boolean>;
  submitQuizAnswer: (selectedIndex: number) => Promise<void>;
  submitTypedAnswer: (answer: string) => Promise<void>;
  submitPhoto: (file: File) => Promise<void>;
  submitMasterCode: (code: string) => Promise<void>;
  setLiveLocation: (location: Location | null) => void;
  setDistance: (distance: number | null) => void;
  syncParticipantLocation: (lat: number, lng: number, accuracy: number | null) => Promise<void>;
}

export interface PlayGameState {
  player: PlayPlayerState;
  gps: PlayGpsState;
  progress: PlayProgressState;
  stratego: PlayStrategoState;
  flags: PlayUiFlags;
  actions: PlayActions;
}

export type PlayUiState = Omit<PlayGameState, "actions">;
