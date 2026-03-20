---
name: add-agent-api
description: Adds the inbound HTTP agent API server to ECHO so ARIA can call ECHO programmatically.
---

# /add-agent-api Skill

This skill wires the pre-written `src/agent-api.ts` into NanoClaw's startup sequence
so ECHO listens for programmatic task assignments from ARIA on port 3001.

## Steps

1. Ensure `express` is in package.json dependencies. If not, run: `npm install express`
   and `npm install -D @types/express`

2. Open `src/index.ts`. Find the section where the main process initializes (typically
   near the bottom, after database setup and channel registration).

3. Add the following import at the top of `src/index.ts`:
   ```typescript
   import { startAgentApiServer } from "./agent-api.js";
   ```

4. Add the following call in the initialization block, after the database is ready:
   ```typescript
   startAgentApiServer();
   ```

5. Ensure `src/agent-api.ts` exists (it is pre-written in the repo). If it does not,
   report the issue — do not create it from scratch.

6. Also ensure `src/router.ts` exports a `sendToGroup` function that sends a message
   to the configured Telegram group chat. If it does not exist, add it:
   ```typescript
   export async function sendToGroup(text: string): Promise<void> {
     const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID;
     const token = process.env.ECHO_TELEGRAM_TOKEN;
     if (!groupChatId || !token) return;
     await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ chat_id: groupChatId, text }),
     });
   }
   ```

7. Also ensure `src/index.ts` exports an `enqueueTask` function that accepts an object
   with `{ message, source, sessionTag, returnTo }` and routes it through the normal
   group queue as if it arrived from Telegram. The agent processes it in a container
   and sends the result to `returnTo` ("group" = Telegram group chat).

8. Rebuild: `npm run build`

9. Restart the service: `systemctl --user restart nanoclaw` (Linux) or
   `launchctl kickstart -k gui/$(id -u)/com.nanoclaw` (macOS)

10. Verify: `curl http://localhost:3001/health` should return `{"status":"ok","agent":"echo"}`
