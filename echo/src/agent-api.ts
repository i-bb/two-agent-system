import express from "express";
import { sendToGroup } from "./router.js";
import { enqueueTask } from "./index.js";

const ECHO_AGENT_API_TOKEN = process.env.ECHO_AGENT_API_TOKEN;
const PORT = parseInt(process.env.AGENT_API_PORT || "3001", 10);

export interface AgentApiRequest {
  task: string;
  payload?: string;
  returnTo: "group" | "private";
  sessionTag: string;
}

export function startAgentApiServer() {
  if (!ECHO_AGENT_API_TOKEN) {
    console.warn("[agent-api] ECHO_AGENT_API_TOKEN not set — agent API server not started");
    return;
  }

  const app = express();
  app.use(express.json({ limit: "4mb" }));

  app.post("/agent", (req, res) => {
    const auth = req.headers["authorization"];
    if (!auth || auth !== `Bearer ${ECHO_AGENT_API_TOKEN}`) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    const body = req.body as AgentApiRequest;
    if (!body.task || !body.sessionTag) {
      res.status(400).json({ error: "task and sessionTag are required" });
      return;
    }

    // Acknowledge immediately — processing is async
    res.status(200).json({ accepted: true, sessionTag: body.sessionTag });

    // Notify the group that a peer handoff arrived
    sendToGroup(
      `[ARIA → ECHO handoff received]\nSession: ${body.sessionTag}\nTask: ${body.task}`
    ).catch(console.error);

    // Enqueue the task for processing in a container
    enqueueTask({
      message: body.payload ? `${body.task}\n\n${body.payload}` : body.task,
      source: "agent-api",
      sessionTag: body.sessionTag,
      returnTo: body.returnTo,
    }).catch(console.error);
  });

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", agent: "echo" });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[agent-api] ECHO agent API listening on port ${PORT}`);
  });
}
