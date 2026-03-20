/**
 * Mem0 integration for ECHO (NanoClaw).
 * Adds before/after turn hooks:
 *   - beforeTurn: fetches relevant memories and prepends them to the system context
 *   - afterTurn: sends the completed turn to Mem0 for extraction and storage
 *
 * All memories are tagged agent_id: "echo", user_id: "operator".
 */

const MEM0_API_URL = process.env.MEM0_API_URL;
const MEM0_API_KEY = process.env.MEM0_API_KEY;
const AGENT_ID = "echo";
const USER_ID = "operator";
const TOP_K = 8;

interface Mem0Memory {
  id: string;
  memory: string;
  metadata?: Record<string, unknown>;
}

interface Mem0SearchResult {
  results: Mem0Memory[];
}

async function mem0Fetch(path: string, options: RequestInit): Promise<Response> {
  if (!MEM0_API_URL || !MEM0_API_KEY) {
    throw new Error("[mem0] MEM0_API_URL and MEM0_API_KEY must be set");
  }
  return fetch(`${MEM0_API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": MEM0_API_KEY,
      ...(options.headers || {}),
    },
  });
}

export async function recallMemories(query: string): Promise<string> {
  try {
    const res = await mem0Fetch("/memories/search", {
      method: "POST",
      body: JSON.stringify({
        query,
        user_id: USER_ID,
        agent_id: AGENT_ID,
        limit: TOP_K,
      }),
    });
    if (!res.ok) return "";
    const data = (await res.json()) as Mem0SearchResult;
    if (!data.results?.length) return "";
    const lines = data.results.map((m) => `- ${m.memory}`).join("\n");
    return `[Recalled memories — agent: echo]\n${lines}`;
  } catch (err) {
    console.error("[mem0] recall error:", err);
    return "";
  }
}

export async function captureMemory(
  userMessage: string,
  assistantMessage: string,
  sessionTag?: string
): Promise<void> {
  try {
    await mem0Fetch("/memories", {
      method: "POST",
      body: JSON.stringify({
        messages: [
          { role: "user", content: userMessage },
          { role: "assistant", content: assistantMessage },
        ],
        user_id: USER_ID,
        agent_id: AGENT_ID,
        metadata: {
          source: sessionTag ? "handoff" : "echo",
          sessionTag: sessionTag ?? null,
        },
      }),
    });
  } catch (err) {
    console.error("[mem0] capture error:", err);
  }
}

export async function captureRoutingDecision(
  decision: string,
  reasoning: string
): Promise<void> {
  try {
    await mem0Fetch("/memories", {
      method: "POST",
      body: JSON.stringify({
        messages: [
          { role: "assistant", content: `Routing decision: ${decision}. Reasoning: ${reasoning}` },
        ],
        user_id: USER_ID,
        agent_id: AGENT_ID,
        metadata: { source: "routing" },
      }),
    });
  } catch (err) {
    console.error("[mem0] routing capture error:", err);
  }
}
