# COWPilotv2 Workflow Explanation - Generated using Cursor

## Complete Workflow with Example: "Search for tennis racquets under 50$"

This document explains the end-to-end workflow of how COWPilotv2 processes a task, using the example input: **"Search for tennis racquets under 50$"**.

---

## High-Level Architecture

The system uses a **two-model approach**:
1. **Decision Model** - Determines whether to ask the user for confirmation or auto-execute
2. **Action Model (GPT-4)** - Generates the actual action to perform

---

## Step-by-Step Workflow

### Phase 1: Initialization (User Input)

**Location:** `TaskUI.tsx` → `currentTask.ts:runTask()`

1. User enters: `"Search for tennis racquets under 50$"` in the textarea
2. User clicks "Run Task" or presses Enter
3. `runTask()` is called with the instructions

**Code Flow:**
```typescript
// TaskUI.tsx:70
state.runTask(toastError);  // Calls currentTask.ts:runTask()
```

**State Updates:**
- `status: 'idle'` → `'running'`
- `actionStatus: 'idle'` → `'attaching-debugger'`
- `instructions: "Search for tennis racquets under 50$"`
- `timeLog: []` (starts logging)

---

### Phase 2: Browser Setup

**Location:** `currentTask.ts:266-294`

1. **Find Active Tab**
   - Gets the currently active Chrome tab
   - Stores `tabId` in state

2. **Attach Chrome Debugger**
   - Calls `attachDebugger(tabId)` to enable DOM manipulation
   - Enables: DOM, Accessibility, Runtime, Page APIs
   - **Purpose:** Allows the extension to interact with the webpage

3. **Disable Incompatible Extensions**
   - Temporarily disables other extensions that might interfere

**Timeline:**
- `[TimeLog] Task started at 0.10 ms`
- `[TimeLog] Debugger attached at 19.30 ms`

---

### Phase 3: Main Loop - `fetchmodelResponse()`

**Location:** `currentTask.ts:358` - This is the core loop that runs until task completion

#### Step 3.1: Fetch Accessibility Tree (AX Tree)

**Location:** `currentTask.ts:380-405`

1. **Get DOM Mapping**
   - Calls `getMapping()` to simplify the DOM
   - Creates a simplified representation for the AI

2. **Fetch AX Tree**
   - Calls `fetch_page_accessibility_tree(true)`
   - Gets the accessibility tree representation of the page
   - **This is what the AI "sees" - structured info about all interactive elements**

**Example AX Tree (simplified):**
```
Amazon.com Homepage
├── Search box [ID: 185] - "Search Amazon"
├── Go button [ID: 190] - "Go"
└── Navigation menu...
```

**Timeline:**
- `[TimeLog] Agent: Starting fetchmodelResponse at 29.50 ms`
- `[TimeLog] Agent: AX tree fetched at 211.10 ms`

---

#### Step 3.2: Decision Model Query - Should We Ask User?

**Location:** `currentTask.ts:431-459` → `determineUserInteraction.ts`

**Purpose:** Determine if this action is safe/straightforward enough to auto-execute, or if we should ask the user first.

**Input to Decision Model:**
```typescript
{
  taskInstructions: "Search for tennis racquets under 50$",
  previousActions: [],  // Empty on first iteration
  pageContents: "<AX tree representation>"
}
```

**Decision Model Prompt:**
```
You are a copilot helping an user in web navigation...
INTENT: Search for tennis racquets under 50$

Past Actions:
(No previous actions)

ACCESSIBILITY TREE OF CURRENT STEP:
[Full AX tree of Amazon homepage]
```

**Decision Model Response:**
```
<Thought>
The user wants to search for tennis racquets under $50. 
Currently, we are on the Amazon homepage, and the search bar is available. 
The next logical step is to enter the search query into the search bar. 
This action aligns with the user's intent, and there is no need to ask 
the user for further input at this point.
</Thought>

Decision: <agent_continue>
```

**Parsing Logic:**
- Looks for `<agent_continue>` → `autoProceed = true` (auto-execute)
- Looks for `<ask_user>` → `autoProceed = false` (wait for user)

**State Update:**
```typescript
state.currentTask.autoProceed = true;  // Will auto-execute
```

**Timeline:**
- `[TimeLog] Agent: Starting decision model query at 211.30 ms`
- `[TimeLog] Agent: Decision made - Auto Continue (execute immediately) at 3671.50 ms`

---

#### Step 3.3: Action Model Query - What Action Should We Take?

**Location:** `currentTask.ts:461-488` → `determineNextAction.ts`

**Purpose:** Get the specific action to perform from GPT-4.

**Input to Action Model:**
```typescript
{
  taskInstructions: "Search for tennis racquets under 50$",
  previousActions: [],  // Empty on first iteration
  simplifiedDOM: "<AX tree>",
  maxAttempts: 3
}
```

**Action Model Prompt:**
```
You are a web automation assistant. Given the task and current page state, 
determine the next action.

Task: Search for tennis racquets under 50$

Previous Actions:
(No previous actions)

Current Page State:
<AX tree showing Amazon homepage with search box ID:185>
```

**Action Model Response:**
```xml
<Thought>
Let's think step-by-step. To search for Tennis racquets under $50, 
I need to use the search box available on the page. The search box has 
the ID [185]. I will set the value to "Tennis racquets under $50" and 
then click the "Go" button to perform the search.
</Thought>

<Action>setvalue(185, "Tennis racquets under $50")</Action>
```

**Timeline:**
- `[TimeLog] Agent: Starting GPT query at 3671.90 ms`
- `[TimeLog] Agent: GPT query completed at 6778.70 ms`

---

#### Step 3.4: Parse the Response

**Location:** `currentTask.ts:509-522` → `parseResponse.ts`

**Parsing Process:**

1. **Extract Tags:**
   ```typescript
   thoughtMatch = /<Thought>(.*?)<\/Thought>/s
   actionMatch = /<Action>(.*?)<\/Action>/s
   ```

2. **Parse Action:**
   - Extracts: `setvalue(185, "Tennis racquets under $50")`
   - Validates action name: `setvalue` ✓ (valid)
   - Parses arguments:
     - `185` → number (nodeID)
     - `"Tennis racquets under $50"` → string (value)

3. **Create Parsed Response:**
   ```typescript
   {
     thought: "Let's think step-by-step...",
     action: "setvalue(185, \"Tennis racquets under $50\")",
     parsedAction: {
       name: "setvalue",
       args: {
         nodeID: 185,
         value: "Tennis racquets under $50"
       }
     },
     feedback: "reject",  // Placeholder (not actual feedback)
     filteredusersteps: ""
   }
   ```

**Console Output:**
```
gpt response: <Thought>...</Thought><Action>setvalue(185, "Tennis racquets under $50")</Action>
gpt response parsed: {thought: "...", action: "setvalue(185, ...)", parsedAction: {...}, feedback: "reject"}
```

---

#### Step 3.5: Store Action in History

**Location:** `currentTask.ts:548-560`

Creates a history entry with:
- Original prompt sent to GPT
- GPT's response
- Parsed action
- Screenshot of current page
- DOM state
- AX tree
- URL
- **Decision type** (`wasAutoExecuted`) - tracks whether this was auto-executed or waited for user

```typescript
currententryfortaskhistory = {
  prompt: "<full prompt>",
  response: "<GPT response>",
  action: parsedAction,
  usage: { tokens: 1234 },
  accept_flag: 'accept',
  counter: 0,  // Tracks if action has been executed
  wasAutoExecuted: true,  // true = agent_continue (auto-executed), false = ask_user (waited for feedback)
  metadata: {
    DOM: "...",
    AXTree: "...",
    Screenshot: "base64_image",
    action_type: "setvalue",
    URL: "https://amazon.com"
  }
}
```

**Note:** The `wasAutoExecuted` field is set based on the decision model's recommendation (`autoProceed` state), which determines the UI behavior (pause button duration).

**State Update:**
```typescript
state.currentTask.history.push(currententryfortaskhistory);
```

---

#### Step 3.6: Decision Handling - Execute or Wait?

**Location:** `currentTask.ts:601-647`

**Check Decision Model's Recommendation:**
```typescript
const autoDecision = get().currentTask.autoProceed;  // true (from Step 3.2)
```

**If `autoProceed = true` (auto-execute):**

1. **Mark action as accepted:**
   ```typescript
   lastEntry.accept_flag = 'accept';
   lastAction.feedback = 'accept';
   ```

2. **Check if already executed:**
   ```typescript
   if (lastEntry.counter === 0) {
     performdomoperation(action);  // Execute now!
   }
   ```

3. **Stop waiting for user:**
   - Sets `stopFlag = true`
   - Stops timeout function

4. **UI Behavior:**
   - Pause button appears briefly (0.5 seconds) next to the action message
   - Progress circle animation completes in 0.5 seconds
   - Button automatically disappears after the brief display

**If `autoProceed = false` (ask user):**
- Starts `timeoutFunction(waitforfeedback)`
- Waits for user to accept/reject action
- User can see the proposed action and approve it
- **UI Behavior:**
  - Pause button appears next to the action message
  - Progress circle animation takes 3 seconds
  - Button stays visible for 6 seconds, giving user time to pause if needed
  - User can click the pause button to reject the action

**In Our Example:**
- Decision model said `<agent_continue>`
- `autoProceed = true`
- Action executes immediately
- Pause button shows briefly (0.5s) then disappears

**Console Output:**
```
GPT decision: proceed without waiting for human feedback (auto-execute)
```

---

#### Step 3.7: Execute DOM Action

**Location:** `currentTask.ts:852` - `performdomoperation()`

**Execution Process:**

1. **Increment Counter:**
   ```typescript
   lastEntry.counter += 1;  // Marks as "executed"
   ```

2. **Call DOM Action:**
   ```typescript
   metadata = await callDOMAction('setvalue', {
     nodeID: 185,
     value: "Tennis racquets under $50"
   });
   ```

3. **What Happens:**
   - Finds element with ID 185 (search box)
   - Sets its value to "Tennis racquets under $50"
   - Returns metadata about the action

4. **Update History with Metadata:**
   ```typescript
   lastEntry.metadata = metadata;  // Stores DOM state after action
   lastEntry.metadata.Screenshot = img_data;  // New screenshot
   ```

**Timeline:**
- `[TimeLog] Agent: Starting performdomoperation at 14984.50 ms`
- `Action took: 445 milliseconds`
- `[TimeLog] Agent: Finished performdomoperation at 15623.70 ms`

---

### Phase 4: Loop Continues - Next Action

After executing the first action, the loop starts again:

1. **Page Changed:** Search was submitted, Amazon navigated to results page
2. **Fetch New AX Tree:** Gets the new page state
3. **Decision Model:** "Should we ask user?"
   - Response: `<agent_continue>` (searching is straightforward)
4. **Action Model:** "What should we do next?"
   - Response: `<Action>click(190)</Action>` (click the "Go" button to search)
   - OR if already on results: `<Action>click(699)</Action>` (click first result)

**Second Iteration Example:**

**Decision Model:**
```
The search query has been entered but not executed. 
I should click the "Go" button. No need to ask user.
Decision: <agent_continue>
```

**Action Model:**
```
<Thought>
I have already set the search query. Now I need to click 
the "Go" button (ID: 190) to perform the search.
</Thought>
<Action>click(190)</Action>
```

**Execution:**
- Clicks the "Go" button
- Amazon navigates to search results page

---

### Phase 5: Final Action

**Third Iteration:**

**Page State:** Amazon search results page showing tennis racquets

**Decision Model:**
```
The search results are displayed. I should click the first 
option. However, the first option might not be a tennis 
racquet (could be a pickleball paddle). Should I ask user?

Decision: <ask_user>  // More cautious for product selection
```

**Action Model:**
```
<Thought>
The search results are displayed. I need to open the first 
option from the search results (ID: 699).
</Thought>
<Action>click(699)</Action>
```

**Decision Handling:**
- `autoProceed = false` (decision model said `<ask_user>`)
- **Waits for user approval**
- User sees: "I will click on the first search result (ID: 699)"
- **Pause button appears** next to the message (visible for 6 seconds)
- User can accept, reject, or click pause button to stop

**If User Accepts:**
- Executes `click(699)`
- Opens the product page

---

## Key Decision Points

### When Does It Ask the User?

The decision model asks the user (`<ask_user>`) when:
- ⚠️ Action might have unintended consequences
- ⚠️ Multiple valid options exist
- ⚠️ Action might navigate away from important information
- ⚠️ The action is ambiguous

**Example from logs:**
```
Decision model response: The first option is a pickleball paddle, 
not a tennis racquet. Should I ask the user if they want to 
proceed with this option or skip to the first actual tennis racquet?

Decision: <ask_user>
```

### When Does It Auto-Execute?

The decision model auto-executes (`<agent_continue>`) when:
- ✅ Action is straightforward and clear
- ✅ Single obvious next step
- ✅ Low risk of mistakes
- ✅ Part of a clear sequence

**Example:**
```
Decision: User wants to search. Search box is available. 
Clear next step. No need to ask.

Decision: <agent_continue>
```

---

## Error Handling

### If Action Fails:

1. **Action Model Returns `fail`:**
   ```typescript
   if (action.parsedAction.name === 'fail') {
     if (recursive_call < 3) {
       fetchmodelResponse(instructions, recursive_call + 1);  // Retry
     } else {
       status = 'error';  // Give up after 3 attempts
     }
   }
   ```

2. **Parsing Error:**
   - If response doesn't have `<Action>` tag → shows error to user
   - If action is invalid → shows error

3. **DOM Action Fails:**
   - If `callDOMAction()` throws → logs error, continues with undefined metadata

---

## State Management

**Key State Variables:**

```typescript
{
  status: 'running' | 'idle' | 'error' | 'success',
  actionStatus: 'attaching-debugger' | 'performing-query' | 'showing-response' | 'performing-action',
  autoProceed: true | false,  // Decision model's recommendation
  history: [
    {
      action: ParsedResponse,
      accept_flag: 'accept' | 'reject',
      counter: 0,  // Execution count
      wasAutoExecuted: true | false,  // true = agent_continue, false = ask_user
      metadata: DomElementmetadata
    }
  ],
  timeLog: [{ event: string, time: number }]
}
```

---

## Timeline Summary (Example Run)

```
0.10 ms    - Task started
19.30 ms   - Debugger attached
29.50 ms   - Starting fetchmodelResponse
211.10 ms  - AX tree fetched
211.30 ms  - Starting decision model query
3671.50 ms - Decision made: Auto Continue
3671.90 ms - Starting GPT query
6778.70 ms - GPT query completed
          - Response parsed: setvalue(185, "Tennis racquets under $50")
          - Decision: auto-execute
14984.50 ms - Starting performdomoperation
15623.70 ms - Finished performdomoperation (search executed)
          - Loop continues for next action...
```

---

## Complete Flow Diagram

```
User Input: "Search for tennis racquets under 50$"
    ↓
1. Initialize Task
    ↓
2. Attach Debugger
    ↓
3. Main Loop (fetchmodelResponse):
    ├── 3.1 Fetch AX Tree
    ├── 3.2 Decision Model: Should we ask user?
    │       ├── <agent_continue> → Auto-execute
    │       └── <ask_user> → Wait for approval
    ├── 3.3 Action Model: What action to take?
    ├── 3.4 Parse Response
    ├── 3.5 Store in History
    ├── 3.6 Decision Handling
    │       ├── Auto-execute → Go to 3.7
    │       └── Ask user → Wait → User accepts → Go to 3.7
    └── 3.7 Execute DOM Action
            ↓
        4. Page Changes → Loop Back to 3.1
            ↓
        5. Repeat until task complete or error
```

---

## Important Notes

1. **Two-Model System:**
   - Decision model runs FIRST (decides if safe to auto-execute)
   - Action model runs SECOND (determines specific action)

2. **Auto-execution vs Manual:**
   - `autoProceed = true` → Action executes immediately
   - `autoProceed = false` → Shows action to user, waits for approval

3. **History Tracking:**
   - Every action is stored in `history[]`
   - Includes prompt, response, parsed action, metadata, screenshots
   - Includes `wasAutoExecuted` flag to track decision type
   - Used as context for future actions

4. **UI Feedback (Pause Button):**
   - **For `agent_continue` decisions:** Pause button appears briefly (0.5 seconds) then disappears automatically
   - **For `ask_user` decisions:** Pause button appears for 6 seconds, giving user time to pause/reject if needed
   - The button shows a progress circle animation indicating remaining time
   - Clicking the pause button rejects the current action

5. **Error Recovery:**
   - Failed actions retry up to 3 times
   - If parsing fails → shows error to user
   - If DOM action fails → logs error but continues

6. **Page Navigation:**
   - When page navigates (e.g., clicking search results), the debugger connection might break
   - Code re-attaches debugger automatically
   - Fetches new AX tree for new page state

---

This workflow continues iteratively until:
- Task is complete (model returns `finish` or `finishwithanswer`)
- User manually stops the task
- An error occurs that can't be recovered
- Maximum action limit reached (50 actions)

