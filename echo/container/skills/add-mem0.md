---
name: add-mem0
description: Adds Mem0 shared memory integration to ECHO with before/after turn hooks.
---

# /add-mem0 Skill

This skill wires the pre-written `src/mem0.ts` into NanoClaw's message processing loop
so ECHO automatically recalls relevant memories before each turn and captures the
conversation after each turn. All memories are tagged agent_id: "echo".

## Steps

1. Open `src/index.ts`. Find where the agent is invoked for a message (where
   `runClaudeAgent` or equivalent is called).

2. Add the following import at the top of `src/index.ts`:
   ```typescript
   import { recallMemories, captureMemory } from "./mem0.js";
   ```

3. Before the agent is invoked, add a memory recall step:
   ```typescript
   const memories = await recallMemories(userMessage);
   let systemContext = constitutionText; // your existing system prompt
   if (memories) {
     systemContext = `${systemContext}\n\n${memories}`;
   }
   ```
   Replace `constitutionText` with whatever variable holds the agent's system prompt.

4. After the agent responds, add a memory capture step:
   ```typescript
   await captureMemory(userMessage, agentResponse, sessionTag);
   ```
   Replace `userMessage`, `agentResponse`, and `sessionTag` with the actual variable
   names used in `src/index.ts`.

5. Ensure `src/mem0.ts` exists (it is pre-written in the repo).

6. Ensure these environment variables are set in Railway:
   - `MEM0_API_URL` — internal URL of the Mem0 service, e.g. `http://mem0-api.railway.internal:8000`
   - `MEM0_API_KEY` — the Mem0 API key

7. Rebuild: `npm run build`

8. Restart the service.

9. Verify: send a message, then check Mem0 for a new memory tagged agent_id: "echo":
   ```
   curl -H "Authorization: Token $MEM0_API_KEY" \
     "$MEM0_API_URL/v1/memories/?agent_id=echo&user_id=operator"
   ```
