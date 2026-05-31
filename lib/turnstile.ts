const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type TurnstileVerificationResult = {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
  "error-codes"?: string[];
};

export function getTurnstileSiteKey() {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null;
}

export function getTurnstileSecretKey() {
  return process.env.TURNSTILE_SECRET_KEY?.trim() || process.env.TURNSTILE_SECRET?.trim() || null;
}

export function isTurnstileEnabled() {
  return Boolean(getTurnstileSiteKey() && getTurnstileSecretKey());
}

export async function verifyTurnstileToken(options: {
  token: string;
  remoteIp?: string;
  action?: string;
}) {
  const secret = getTurnstileSecretKey();
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Turnstile is not configured");
    }

    return { success: true as const, skipped: true as const };
  }

  const payload = new URLSearchParams();
  payload.set("secret", secret);
  payload.set("response", options.token);
  if (options.remoteIp) {
    payload.set("remoteip", options.remoteIp);
  }

  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: payload,
  });

  if (!response.ok) {
    throw new Error(`Turnstile verification failed with status ${response.status}`);
  }

  const result = (await response.json()) as TurnstileVerificationResult;
  if (!result.success) {
    return { success: false as const, errors: result["error-codes"] ?? [] };
  }

  if (options.action && result.action && result.action !== options.action) {
    return { success: false as const, errors: ["bad-action"] };
  }

  return { success: true as const };
}
