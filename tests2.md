Running browser-based End-to-End (E2E) tests (using **Playwright** or **Kernel** headful Chromium alongside manual DevTools verification) is essential because the hackathon requires demonstrating a functional, interactive prototype on the device it was built for, rather than a static mockup. Furthermore, sponsor judges specifically inspect how the frontend components react to backend payment events in real time.

Run these **7 browser-specific tests**—verifying both the visual DOM state and the browser DevTools (`Network`, `Console`, and `Accessibility` tabs)—and have your browser test runner capture screenshots and structured UI telemetry logs at each step:

---

### 1. The "Zero-Auth Cold Load" & Render Speed Test (Incognito Browser)

**Why it matters:** Judges review submissions weeks after the deadline and will immediately bounce if prompted for API keys, PayPal Sandbox logins, or broken CORS errors.

* **Browser Action:** Open your hosted Render URL in a fresh **Incognito/Private window** with DevTools `Console` and `Network` tabs open.


* **What to Verify in Browser:**
* The dashboard loads in under 2 seconds with zero red `CORS`, `Hydration Mismatch`, or `401 Unauthorized` errors in the Console.
* Pre-seeded Sandbox credentials work automatically on the backend without popping up a login barrier.


* The **1-Click Judge Demo Toolbar** is pinned at the top of the viewport and all 4 simulation buttons are interactive.




* **Browser Log to Capture (`logs/browser-01-cold-load.json`):**

```json
{
  "browser_test": "UI_01_INCOGNITO_COLD_LOAD",
  "viewport": "1920x1080",
  "console_errors": 0,
  "uncaught_page_exceptions": 0,
  "ag_studio_mounted": true,
  "bryntum_gantt_mounted": true,
  "demo_toolbar_buttons_ready": 4
}

```

---

### 2. Live Contract Upload $\rightarrow$ Bryntum Gantt & PayPal Checkout Popup/Redirect Test

**Why it matters:** Tests the full visual handoff from AI document parsing to the PayPal Sandbox buyer approval screen and **Bryntum Gantt** rendering. (If automated, running this in **Kernel** headful Chromium verifies that PayPal checkout popups/iframes render cleanly without being blocked).

* **Browser Action:** Click **Button 1 (Seed Contract & Lock Sandbox Hold)** or drag-and-drop a sample Statement of Work PDF into the browser upload zone.


* **What to Verify in Browser:**
* **Bryntum Gantt** dynamically renders the 3 extracted milestone task bars with dependency arrows and dates.


* Clicking "Authorize Escrow Hold" either completes the pre-authenticated Sandbox authorization or opens the PayPal Sandbox approval flow cleanly without popup-blocker errors.


* In DevTools `Network`, inspect the request to `/api/safegate/orders/authorize` and confirm the response returns HTTP `201` with `PayPal-Request-Id` (36-char UUID) visible in the response headers.




* **Browser Log to Capture (`logs/browser-02-gantt-and-checkout.json`):**

```json
{
  "browser_test": "UI_02_CONTRACT_TO_GANTT_SYNC",
  "dom_elements_verified": {
    "bryntum_task_bars_rendered": 3,
    "dependency_lines_drawn": 2,
    "active_order_badge": "AUTHORIZED (3-Day Honor Window Active)"
  },
  "network_assertion": {
    "route": "POST /api/safegate/orders/authorize",
    "status": 201,
    "paypal_request_id_header_present": true
  }
}

```

---

### 3. Live DOM Mutation: Day-3 Reauthorization & Bryntum Task-Shifting Cascade

**Why it matters:** Judges Sylwia Vargas and Mats Bryntse specifically look for **payment state driving schedule state** across **AG Studio** and **Bryntum** without requiring a page refresh.

* **Browser Action:** Click **Button 2 (Fast-Forward Day-3 Honor Period)** on the toolbar, then toggle the **"Simulate Reauth Failure (Negative Test)"** switch.


* **What to Verify in Browser:**
* **Success State:** Watch the **AG Studio 3** row for Milestone 1 flash and update its `Active Authorization ID` cell from the original ID to the newly mutated ID returned by `/reauthorize`, while keeping the `Original ID` visible in the history column.


* **Failure Cascade State:** When the negative test is triggered, watch the **Bryntum Gantt** task bars for Milestones 2 and 3 visually slide to the right on the timeline canvas and turn amber/locked, while **Bryntum Scheduler** flags the assigned contractor resource.




* **Browser Log to Capture (`logs/browser-03-schedule-cascade.json`):**

```json
{
  "browser_test": "UI_03_REALTIME_ID_ROTATION_AND_TASK_SHIFT",
  "ag_studio_cell_mutation": {
    "column": "active_authorization_id",
    "old_dom_value": "0VF52814937998046",
    "new_dom_value": "9LK88776655443321",
    "updated_without_page_reload": true
  },
  "bryntum_gantt_cascade": {
    "trigger": "REAUTHORIZATION_FAILED_NEGATIVE_TEST",
    "milestone_2_start_date_before": "2026-11-14",
    "milestone_2_start_date_after": "2026-11-17",
    "visual_lock_applied": true
  }
}

```

---

### 4. The Human-in-the-Loop (HITL) Approval Drawer & Double-Click Guard Test

**Why it matters:** Proves your **SafeGate Firewall** stops the AI agent from moving money autonomously (`capture`, `create_refund`, `make-offer`) and prevents accidental double-submissions from the UI.

* **Browser Action:** Click **Button 3 (Verify Deliverable via Channel3 & Elastic)**. Wait for the AI agent to verify the uploaded proof image and stage the partial capture. When the **HITL Approval Drawer** slides open in AG Studio 3, rapidly double-click **Approve & Execute**.


* **What to Verify in Browser:**
* Before clicking Approve, verify in DevTools `Network` that **zero** calls have been made to `/capture`—the item sits in `PENDING_HUMAN_APPROVAL`.


* Verify the modal displays the **Channel3** verified product spec badge and the **Elastic** kNN image authenticity score (`AUTHENTIC_PASS`).


* Rapidly double-clicking **Approve & Execute** disables the button on click #1 and sends the exact same 36-char `PayPal-Request-Id` on any retry so the balance only changes once.




* **Browser Log to Capture (`logs/browser-04-hitl-drawer.json`):**

```json
{
  "browser_test": "UI_04_HITL_APPROVAL_GATE_AND_DEBOUNCE",
  "pre_approval_network_calls_to_paypal": 0,
  "verification_badges_rendered": ["CHANNEL3_SKU_MATCH", "ELASTIC_KNN_AUTHENTIC"],
  "double_click_test": {
    "clicks_triggered": 2,
    "outbound_paypal_captures_executed": 1,
    "idempotent_replay_blocked_duplicate": true
  }
}

```

---

### 5. AG Studio 3 WebMCP, Calculations UI & 1.5% Dispute Ratio Gauge Test

**Why it matters:** Directly targets the **$5,000 Best Use of AG Grid** prize by exercising AG Studio 3's **Calculations UI**, **Canvas Undo/Redo**, and **WebMCP** (where the AI agent builds custom anomaly widgets directly in the browser).

* **Browser Action:** Click **Button 4 (Simulate SNAD Dispute at 1.42% Ratio)**.


* **What to Verify in Browser:**
* The **1.5% Dispute Ratio Gauge** in AG Studio updates live (e.g., showing `1.42% — 1 dispute away from the $30 non-refundable High Volume fee tier`).


* Via **WebMCP**, the AI agent dynamically injects a custom **"Pre-Escalation Risk Alert"** widget onto the AG Studio canvas recommending a `$0 fee` `make-offer` settlement.


* Test AG Studio's **Undo/Redo** on the canvas layout and verify that filtering the grid triggers clean server-side pagination/queries.


* Check **Bryntum Calendar** right next to the grid: confirm a red **10-Day `seller_response_due_date` deadline block** is automatically plotted on the calendar.





---

### 6. Browser PDF Preview & Multipart Evidence Upload Test (`provide-evidence`)

**Why it matters:** Proves the automated PDF evidence compiler actually generates a valid, readable `<10MB` A4 document in the browser before submitting it to PayPal's multipart endpoint.

* **Browser Action:** Inside the escalated SNAD Claim row in AG Studio, click **"Preview Auto-Compiled Evidence PDF"**, then click **"Approve & Upload to PayPal"**.


* **What to Verify in Browser:**
* The browser opens/renders the generated PDF preview showing the buyer's PayPal email, Transaction ID, Invoice ID, buyer IP access logs, and deliverable SHA-256 hashes clearly formatted on single-orientation A4 pages.


* In DevTools `Network`, inspect the `POST /api/safegate/disputes/{id}/provide-evidence` payload and verify the size is `<10 MB` and returns HTTP `200 OK` (no `INVALID_EVIDENCE_FILE` error).





---

### 7. WCAG Keyboard Accessibility & Greyscale Visual Audit (DevTools Rendering)

**Why it matters:** PayPal judge **Jo Franchetti** and the judging panel notes explicitly highlight **WCAG accessibility**, keyboard navigation, and **greyscale-safe** status indicators (not relying solely on red/green color coding).

* **Browser Action:**
1. Open Chrome DevTools $\rightarrow$ `More Tools` $\rightarrow$ `Rendering` $\rightarrow$ set **Emulate vision deficiencies** to **Achromatopsia (No color / Greyscale)**.


2. Unplug your mouse and navigate the entire Judge Demo Toolbar and HITL Approval Drawer using only `Tab`, `Shift+Tab`, `Enter`, and `Escape`.




* **What to Verify in Browser:**
* Every status badge in **AG Studio** and **Bryntum** uses distinct icons + text labels (e.g., `[✓ CAPTURED]`, `[⏳ DAY-3 REAUTH]`, `[⚠️ 1.42% CLIFF WARNING]`) so the dashboard is 100% readable in full greyscale.


* Focus rings (`outline`) are clearly visible on every button, and the HITL modal traps focus properly and closes on `Escape`.




* **Browser Log to Capture (`logs/browser-07-wcag-audit.json`):**

```json
{
  "browser_test": "UI_07_WCAG_AND_GREYSCALE_COMPLIANCE",
  "lighthouse_accessibility_score": 100,
  "keyboard_tab_order_verified": true,
  "greyscale_icon_and_label_redundancy": true,
  "aria_live_regions_active": true
}

```