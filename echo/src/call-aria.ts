/**
 * Utility for ECHO to call ARIA's webhook API programmatically.
 * Uses Railway's internal private network.
 */

const ARIA_INTERNAL_URL = process.env.ARIA_INTERNAL_URL || "http://aria.railway.internal:18789";
const ARIA_HOOKS_TOKEN = process.env.ARIA_HOOKS_TOKEN;

export interface AriaHandoffRequest {
  message: string;
  sessionTag: string;
  deliver?: boolean;
  channel?: string;
}

export async function callAria(req: AriaHandoffRequest): Promise<boolean> {
  if (!ARIA_HOOKS_TOKEN) {
    console.error("[call-aria] ARIA_HOOKS_TOKEN not set");
    return false;
  }

  try {
    const res = await fetch(`${ARIA_INTERNAL_URL}/hooks/agent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ARIA_HOOKS_TOKEN}`,
      },
      body: JSON.stringify({
        message: req.message,
        name: "ECHO-handoff",
        deliver: req.deliver ?? true,
        channel: req.channel ?? "telegram",
        sessionKey: `hook:echo:${req.sessionTag}`,
      }),
    });

    if (!res.ok) {
      console.error(`[call-aria] Unexpected status ${res.status}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[call-aria] fetch error:", err);
    return false;
  }
}
