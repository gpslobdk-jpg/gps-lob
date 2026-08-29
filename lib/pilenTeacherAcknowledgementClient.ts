type PilenTeacherAcknowledgementResponse = {
  accepted?: boolean;
  version?: string;
  error?: string;
};

const ACKNOWLEDGEMENT_ENDPOINT = "/api/pilen/teacher-acknowledgement";

async function readResponse(response: Response) {
  try {
    return (await response.json()) as PilenTeacherAcknowledgementResponse;
  } catch {
    return {};
  }
}

export async function getPilenTeacherAcknowledgement() {
  const response = await fetch(ACKNOWLEDGEMENT_ENDPOINT, {
    method: "GET",
    cache: "no-store",
    credentials: "same-origin",
  });
  const body = await readResponse(response);
  if (!response.ok) {
    throw new Error(body.error ?? "Bekræftelsen kunne ikke hentes.");
  }
  return body.accepted === true;
}

export async function acceptPilenTeacherAcknowledgement() {
  const response = await fetch(ACKNOWLEDGEMENT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accepted: true }),
    cache: "no-store",
    credentials: "same-origin",
  });
  const body = await readResponse(response);
  if (!response.ok || body.accepted !== true) {
    throw new Error(body.error ?? "Bekræftelsen kunne ikke gemmes.");
  }
  return true;
}
