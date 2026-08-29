import {
  CharacterConversationError,
  type CharacterConversationErrorCode,
  type CharacterConversationHandle,
  type CharacterConversationService,
  type CharacterConversationStartInput,
  type CharacterConversationStopReason,
} from "@/lib/characterConversation";

type TrackLike = { stop: () => void };
type StreamLike = { getTracks: () => TrackLike[] };
type SenderLike = { track?: TrackLike | null };
type ReceiverLike = { track?: TrackLike | null };

type DataChannelLike = {
  readyState: string;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
  send: (data: string) => void;
  close: () => void;
};

type PeerConnectionLike = {
  connectionState: string;
  localDescription: RTCSessionDescriptionInit | null;
  ontrack:
    ((event: { streams: StreamLike[]; track?: TrackLike }) => void) | null;
  onconnectionstatechange: (() => void) | null;
  createDataChannel: (label: string) => DataChannelLike;
  addTrack: (track: TrackLike, stream: StreamLike) => unknown;
  createOffer: () => Promise<RTCSessionDescriptionInit>;
  setLocalDescription: (
    description: RTCSessionDescriptionInit,
  ) => Promise<void>;
  setRemoteDescription: (
    description: RTCSessionDescriptionInit,
  ) => Promise<void>;
  getSenders: () => SenderLike[];
  getReceivers: () => ReceiverLike[];
  close: () => void;
};

type AudioElementLike = {
  autoplay: boolean;
  playsInline: boolean;
  srcObject: StreamLike | null;
  play: () => Promise<void>;
  pause: () => void;
  removeAttribute: (name: string) => void;
  load: () => void;
};

export type CharacterRealtimeClientDependencies = {
  isSupported: () => boolean;
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<StreamLike>;
  createPeerConnection: () => PeerConnectionLike;
  createAudioElement: () => AudioElementLike;
  fetch: typeof fetch;
  now: () => number;
  setTimeout: (
    callback: () => void,
    delayMs: number,
  ) => ReturnType<typeof setTimeout>;
  clearTimeout: (timeoutId: ReturnType<typeof setTimeout>) => void;
};

const defaultDependencies: CharacterRealtimeClientDependencies = {
  isSupported: () =>
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof RTCPeerConnection !== "undefined",
  getUserMedia: (constraints) =>
    navigator.mediaDevices.getUserMedia(constraints),
  createPeerConnection: () =>
    new RTCPeerConnection() as unknown as PeerConnectionLike,
  createAudioElement: () =>
    document.createElement("audio") as unknown as AudioElementLike,
  fetch: (...args) => fetch(...args),
  now: () => Date.now(),
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimeout: (timeoutId) => clearTimeout(timeoutId),
};

function getServerEventType(data: unknown) {
  if (typeof data !== "string") return "";
  const match = /"type"\s*:\s*"([a-z0-9_.-]{1,100})"/i.exec(data.slice(0, 256));
  return match?.[1] ?? "";
}

function mapServerErrorCode(value: unknown): CharacterConversationErrorCode {
  switch (value) {
    case "PARTICIPANT_UNAUTHORIZED":
      return "PARTICIPANT_UNAUTHORIZED";
    case "POST_NOT_FOUND":
    case "PROGRESS_MISMATCH":
    case "CHARACTER_CONFIG_INVALID":
    case "SESSION_CLOSED":
    case "SPECIAL_FLOW_UNSUPPORTED":
      return "POST_UNAVAILABLE";
    case "LOCATION_REQUIRED":
    case "LOCATION_STALE":
    case "LOCATION_INACCURATE":
    case "POST_LOCKED":
      return "POST_LOCKED";
    case "RATE_LIMITED":
      return "RATE_LIMITED";
    case "FEATURE_DISABLED":
    case "CREDENTIALS_MISSING":
    case "EU_RESIDENCY_UNCONFIRMED":
    case "UNDER_18_REVIEW_UNCONFIRMED":
    case "PRODUCTION_APPROVAL_MISSING":
    case "RATE_LIMIT_UNAVAILABLE":
      return "FEATURE_UNAVAILABLE";
    default:
      return "NETWORK_ERROR";
  }
}

function mapMicrophoneError(error: unknown) {
  const name =
    error && typeof error === "object" && "name" in error
      ? String((error as { name?: unknown }).name ?? "")
      : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return new CharacterConversationError("MICROPHONE_DENIED");
  }
  return new CharacterConversationError("MICROPHONE_UNAVAILABLE");
}

async function readStaticServerError(response: Response) {
  try {
    const payload = (await response.json()) as { code?: unknown };
    return mapServerErrorCode(payload.code);
  } catch {
    return "NETWORK_ERROR" as const;
  }
}

export function createRealtimeCharacterConversationService(
  dependencies: CharacterRealtimeClientDependencies = defaultDependencies,
): CharacterConversationService {
  return {
    mode: "realtime",
    async start(input: CharacterConversationStartInput) {
      if (
        typeof input.sessionId !== "string" ||
        !input.sessionId.trim() ||
        !Number.isInteger(input.postIndex) ||
        (input.postIndex ?? -1) < 0
      ) {
        throw new CharacterConversationError("POST_UNAVAILABLE");
      }

      input.onStatusChange?.("connecting");

      let localStream: StreamLike | null = null;
      let remoteStream: StreamLike | null = null;
      let peerConnection: PeerConnectionLike | null = null;
      let dataChannel: DataChannelLike | null = null;
      let audioElement: AudioElementLike | null = null;
      let stopToken: string | null = null;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      let startedAtMs = 0;
      let stoppedAtMs: number | null = null;
      let stopped = false;
      let abortHandler: (() => void) | null = null;

      const cleanLocalResources = () => {
        if (abortHandler) {
          input.signal?.removeEventListener("abort", abortHandler);
          abortHandler = null;
        }

        if (timeoutId !== null) {
          dependencies.clearTimeout(timeoutId);
          timeoutId = null;
        }

        if (dataChannel) {
          dataChannel.onopen = null;
          dataChannel.onmessage = null;
          dataChannel.onclose = null;
          dataChannel.onerror = null;
          if (dataChannel.readyState !== "closed") dataChannel.close();
          dataChannel = null;
        }

        if (peerConnection) {
          peerConnection.ontrack = null;
          peerConnection.onconnectionstatechange = null;
          for (const sender of peerConnection.getSenders())
            sender.track?.stop();
          for (const receiver of peerConnection.getReceivers())
            receiver.track?.stop();
          peerConnection.close();
          peerConnection = null;
        }

        for (const track of localStream?.getTracks() ?? []) track.stop();
        for (const track of remoteStream?.getTracks() ?? []) track.stop();
        localStream = null;
        remoteStream = null;

        if (audioElement) {
          audioElement.pause();
          audioElement.srcObject = null;
          audioElement.removeAttribute("src");
          audioElement.load();
          audioElement = null;
        }
      };

      const requestProviderHangup = () => {
        const token = stopToken;
        stopToken = null;
        if (!token) return;
        void dependencies
          .fetch("/api/play/character-realtime/stop", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
            cache: "no-store",
            keepalive: true,
          })
          .catch(() => undefined);
      };

      const stop = async (
        reason: CharacterConversationStopReason,
        notify = true,
      ) => {
        if (!stopped) {
          stopped = true;
          stoppedAtMs = dependencies.now();
          requestProviderHangup();
          cleanLocalResources();
          if (notify) input.onEnded?.(reason);
        }
        return {
          durationSeconds: Math.max(
            0,
            Math.round(
              ((stoppedAtMs ?? dependencies.now()) - startedAtMs) / 1000,
            ),
          ),
        };
      };

      const failConnectedSession = (code: CharacterConversationErrorCode) => {
        if (stopped) return;
        const failure = new CharacterConversationError(code);
        void stop("network_failure", false);
        input.onFailure?.(failure);
      };

      abortHandler = () => {
        if (stopped) return;
        stopped = true;
        stoppedAtMs = dependencies.now();
        requestProviderHangup();
        cleanLocalResources();
      };
      input.signal?.addEventListener("abort", abortHandler, { once: true });
      if (input.signal?.aborted) abortHandler();

      try {
        if (stopped) throw new CharacterConversationError("NETWORK_ERROR");
        if (!dependencies.isSupported()) {
          throw new CharacterConversationError("UNSUPPORTED_BROWSER");
        }

        try {
          localStream = await dependencies.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video: false,
          });
        } catch (error) {
          throw mapMicrophoneError(error);
        }
        if (stopped) {
          for (const track of localStream.getTracks()) track.stop();
          localStream = null;
          throw new CharacterConversationError("NETWORK_ERROR");
        }

        peerConnection = dependencies.createPeerConnection();
        audioElement = dependencies.createAudioElement();
        audioElement.autoplay = true;
        audioElement.playsInline = true;

        const activeAudioElement = audioElement;
        peerConnection.ontrack = (event) => {
          if (stopped) return;
          remoteStream = event.streams[0] ?? null;
          if (remoteStream) {
            activeAudioElement.srcObject = remoteStream;
            void activeAudioElement.play().catch(() => undefined);
          }
        };

        for (const track of localStream.getTracks()) {
          peerConnection.addTrack(track, localStream);
        }

        dataChannel = peerConnection.createDataChannel("oai-events");
        dataChannel.onopen = () => {
          if (stopped || !dataChannel) return;
          input.onStatusChange?.("listening");
          dataChannel.send('{"type":"response.create"}');
        };
        dataChannel.onmessage = (event) => {
          if (stopped) return;
          const eventType = getServerEventType(event.data);
          if (
            eventType === "response.created" ||
            eventType === "response.output_audio.delta" ||
            eventType === "output_audio_buffer.started"
          ) {
            input.onStatusChange?.("speaking");
          } else if (
            eventType === "response.done" ||
            eventType === "response.output_audio.done" ||
            eventType === "output_audio_buffer.stopped" ||
            eventType === "input_audio_buffer.speech_started"
          ) {
            input.onStatusChange?.("listening");
          } else if (eventType === "error") {
            failConnectedSession("NETWORK_ERROR");
          }
        };
        dataChannel.onerror = () => failConnectedSession("NETWORK_ERROR");
        dataChannel.onclose = () => {
          if (!stopped) failConnectedSession("NETWORK_ERROR");
        };

        peerConnection.onconnectionstatechange = () => {
          if (
            !stopped &&
            (peerConnection?.connectionState === "failed" ||
              peerConnection?.connectionState === "closed")
          ) {
            failConnectedSession("NETWORK_ERROR");
          }
        };

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        const localSdp = peerConnection.localDescription?.sdp;
        if (!localSdp) throw new CharacterConversationError("NETWORK_ERROR");

        const response = await dependencies.fetch(
          "/api/play/character-realtime",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/sdp",
              "X-Pilen-Session-Id": input.sessionId,
              "X-Pilen-Post-Index": String(input.postIndex),
            },
            body: localSdp,
            cache: "no-store",
            signal: input.signal,
          },
        );
        if (!response.ok) {
          throw new CharacterConversationError(
            await readStaticServerError(response),
          );
        }

        const answerSdp = await response.text();
        const returnedStopToken = response.headers
          .get("x-pilen-stop-token")
          ?.trim();
        if (!answerSdp || !returnedStopToken) {
          throw new CharacterConversationError("NETWORK_ERROR");
        }
        stopToken = returnedStopToken;
        await peerConnection.setRemoteDescription({
          type: "answer",
          sdp: answerSdp,
        });

        startedAtMs = dependencies.now();
        timeoutId = dependencies.setTimeout(() => {
          void stop("time_limit");
        }, input.config.maxDurationSeconds * 1000);

        return {
          startedAtMs,
          stop: (reason: CharacterConversationStopReason) => stop(reason),
        } satisfies CharacterConversationHandle;
      } catch (error) {
        requestProviderHangup();
        cleanLocalResources();
        if (error instanceof CharacterConversationError) throw error;
        throw new CharacterConversationError("NETWORK_ERROR");
      }
    },
  };
}

export const realtimeCharacterConversationService =
  createRealtimeCharacterConversationService();

export function isPilenRealtimeClientEnabled() {
  return process.env.NEXT_PUBLIC_PILEN_REALTIME_ENABLED === "true";
}
