# Cases Feature — Testing Guide

Dev server: `http://39.105.175.14:5173/`
Login: `admin` / `Admin1234`

---

## Pre-requisites

After login, go to left sidebar and switch to **Cases** tab (expandable, has **Config** and **Run** sub-tabs).

You need at least one Agent configured. Go to **Evals** tab > **agents** sub-tab to verify agents exist.

---

## Test 1: Chat Mode — New Case (E135, E136, E138)

**Goal**: Create a new case, save it, and run a chat test.

1. Click **Cases** in the sidebar
2. Click **+ New Case** button (top right)
3. You land on **Config** sub-tab with an empty form

### 3a. Fill the form:
| Field | Value |
|-------|-------|
| Case Name | `Test Chat Case` |
| Description | `Testing chat mode` |
| Agent | Pick any agent from the dropdown |
| Test Mode | Should default to **Chat** (left button selected) |
| Message #1 | Type: `Hello, what can you do?` |

4. Click **Save** (top right green button)
   - **Expected**: Green toast "Case saved: xxx" appears
   - **If error toast**: Bug E136 not fixed (v4 schema rejected)

5. Click **Save & Run** (bottom green button)
   - **Expected**: Saves successfully, then auto-switches to **Run** sub-tab
   - **If it switches to Run even with error toast**: Bug E138 not fixed

6. On the **Run** sub-tab:
   - You should see the config summary bar (model badge, etc.)
   - The **Start Test** button should be GREEN and clickable
   - **If Start Test is grayed out / disabled**: `canRun` check is broken

7. Click **Start Test**
   - **Expected**: Conversation starts. You see:
     - Left panel: Your message appears, then agent response streams in
     - Right panel (Logs): Shows model name, round 1, payload sent, response received
   - **If TypeError in console about `finalizeThinking`**: Bug E135 not fixed
   - **If nothing happens**: Check browser console (F12) for errors

8. After response arrives, type a follow-up message in the input box at bottom of chat panel and press Enter
   - **Expected**: Round 2 starts, agent responds again

9. Click **End Test** (red button)
   - **Expected**: Judge evaluates the conversation, result shown in logs

### Console check (F12):
- No TypeError errors
- No 404/502 errors
- No `undefined is not a function` errors

---

## Test 2: Act Mode — Interactive Session (E142)

**Goal**: Create an act-mode case where the user types the first message.

1. Click **Cases** > **+ New Case**
2. Fill:
   | Field | Value |
   |-------|-------|
   | Case Name | `Test Act Case` |
   | Agent | Pick any agent |
   | Test Mode | Click **Act** (right button) |
   | Environment | Select **Tool Sandbox** tab |
   | Max Rounds | `10` |

3. Click **Save & Run**
   - **Expected**: Saves, switches to Run tab

4. On the Run tab:
   - **Start Test** button should be GREEN and clickable
   - **If grayed out**: `canRun` + `selectedAgentId` fix not working

5. Click **Start Test**
   - **Expected**:
     - Log panel shows: model name + "Interactive mode — type your first message below" (or Chinese equivalent)
     - Chat panel is empty
     - Input box appears at bottom of chat panel
     - **No API call is made yet** (no loading spinner)
   - **If you see an empty user message bubble**: Early return not working
   - **If you see `[interactive session]` as a message**: Old bug E142 still present

6. Type a message in the input box: `List the files in the current directory`
   - Press Enter
   - **Expected**: Message appears in chat, agent responds (may fail if sandbox not started, that's OK — the point is the API call is made with your message)

7. Click **End Test**

---

## Test 3: Cases List Display (E137)

1. Go back to **Cases** tab (main list)
2. You should see the two cases you created:
   - `Test Chat Case` — should have a **purple** `chat` badge
   - `Test Act Case` — should have an **amber** `act` badge
3. **If badges are gray or missing**: Bug E137 not fixed

---

## Test 4: Edit Existing Case

1. On the Cases list, click **Edit** on `Test Chat Case`
2. You land on Config with all fields pre-filled
3. Change the message to `Tell me a joke`
4. Click **Save**
   - **Expected**: Green toast "Case saved"
5. Go back to Cases list — case should still be there

---

## Test 5: Import from Eval (E140)

1. Create a new case or edit an existing one (go to Config tab)
2. Click **Import from Eval** button (in the header area)
3. Dialog opens with Agent dropdown
4. Select an agent that has completed eval jobs
5. **Expected**: Only jobs with green "completed" status appear
   - **If you see failed/pending jobs**: Bug E140 not fixed
6. Select a completed job > select a task > select a sample
7. Sample data should be imported into the first chat message

---

## Test 6: Save & Run Error Handling (E138)

1. This is hard to trigger manually. To verify:
   - Open browser DevTools > Network tab
   - Create a new case, do NOT select an agent
   - Click **Save & Run**
   - If save fails (missing required fields), you should stay on Config tab with error toast
   - You should NOT be switched to Run tab

---

## Test 7: Tool Call Logs i18n (E139)

1. Switch language to **English** (top right language toggle)
2. Run a test with tool calling enabled (need sandbox running)
3. In the log panel, tool call entries should show:
   - `Calling tool: xxx` (English)
   - `Parameters: {...}` (English)
4. Switch to Chinese — should show Chinese equivalents
   - **If you see `调用工具:` in English mode**: Bug E139 not fixed

---

## Test 8: maxToolCalls Limit (E141)

1. This is hard to trigger manually (needs a model that loops tool calls)
2. To verify the code exists:
   - Open browser DevTools > Sources
   - Search for `toolCallLimit` in `useConversationEngine.js`
   - You should see `const toolCallLimit = maxToolCalls || 100` in both `startConversation` and `sendUserMessage`

---

## Quick Smoke Test (Minimum)

If you're short on time, just do these:

1. **Cases > + New Case > Config**: Select agent, type message, click **Save & Run**
2. **Run tab**: Click **Start Test** — conversation should work
3. **Cases > + New Case > Config**: Select agent, switch to **Act** mode, click **Save & Run**
4. **Run tab**: Click **Start Test** — should show "waiting for input", type a message, it should send

If both work, the critical fixes (E135, E136, E138, E142) are confirmed.

---

## Port Reference

| Service | Port | Purpose |
|---------|------|---------|
| Vite dev | 5173 | Frontend (this version) |
| poc-demo backend | 8000 | API backend |
| eval-poc backend | 8001 | Eval engine |
| PostgreSQL | 5432 | Database |
| Production (Docker) | 5175 | Prod build (not this version) |
