To satisfy the hackathon’s strict "Functional Demo" and "Working Prototype" rules—and to ensure your 3-minute YouTube video shows verifiable, real execution rather than mocked UI—you need an automated **End-to-End (E2E) Test & Audit Suite** that simultaneously validates your code and generates structured **Audit Logs** (both in the terminal and in your **AG Studio 3** live log drawer).

Below are the **7 mandatory E2E tests** you must run before submitting, along with the exact structured JSON log payloads your system should output for each test so judges can verify your architecture in seconds.

---

### Test 1: SafeGate Proxy Sandbox Lock & Token Lifecycle E2E

**What it proves:** Your app overrides `@paypal/agent-toolkit`’s default live production behavior (`sandbox: false`), fetches a real OAuth 2.0 Sandbox token, and dynamically scopes context tools instead of loading the 12,600-token catalog.

* **How to run it:** Execute a startup test that initializes SafeGate without `PAYPAL_ENVIRONMENT` set in the constructor, verifies that outbound requests still route to `[https://api-m.sandbox.paypal.com](https://api-m.sandbox.paypal.com)`, and tests dynamic tool routing for a specific phase (`ESCROW_SETUP`).
* **Exact Log to Generate (`logs/e2e-safegate-init.log`):**

```json
{
  "timestamp": "2026-11-10T10:00:01.120Z",
  "test_id": "E2E_01_SAFEGATE_INIT",
  "component": "SafeGate_MCP_Firewall",
  "environment_lock": {
    "toolkit_default_overridden": true,
    "sandbox_forced": true,
    "target_host": "https://api-m.sandbox.paypal.com"
  },
  "oauth_status": {
    "token_acquired": true,
    "expires_in_seconds": 28800,
    "auto_refresh_scheduled_at_seconds": 27900
  },
  "context_router": {
    "active_phase": "ESCROW_SETUP",
    "full_catalog_tools_blocked": 43,
    "scoped_tools_loaded": ["create_order_authorize", "create_invoice", "get_order"],
    "estimated_token_savings": "86%"
  },
  "status": "PASS"
}

```

---

### Test 2: SOW AI Extraction $\rightarrow$ Two-Step Order Authorization (`intent: "AUTHORIZE"`)

**What it proves:** Meaningfully incorporates AI (parsing an unstructured contract into milestones) and meaningfully integrates PayPal Orders v2 + Payments v2 two-step holds with a deterministic 36-character UUID `PayPal-Request-Id` (within PayPal's 38-character limit).

* **How to run it:** Feed a sample Statement of Work into the Contract Agent, verify **Bryntum Gantt** populates the task bars, create an order with `intent: "AUTHORIZE"`, simulate/approve the buyer hold in Sandbox, and call `/v2/checkout/orders/{id}/authorize`.
* **Exact Log to Generate (`logs/e2e-escrow-authorize.log`):**

```json
{
  "timestamp": "2026-11-10T10:01:14.402Z",
  "test_id": "E2E_02_MILESTONE_AUTHORIZE",
  "ai_extraction": {
    "model": "gpt-4o / claude-3-5-sonnet",
    "apimatic_schema_validated": true,
    "extracted_milestones": 3,
    "total_contract_value": { "currency_code": "USD", "value": "1500.00" }
  },
  "paypal_api_call": {
    "endpoint": "POST /v2/checkout/orders/8XY12345AB678901C/authorize",
    "paypal_request_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "paypal_request_id_length": 36,
    "http_status": 201
  },
  "authorization_state": {
    "order_id": "8XY12345AB678901C",
    "initial_authorization_id": "0VF52814937998046",
    "status": "CREATED",
    "honor_period_expires_at": "2026-11-13T10:01:14Z",
    "validity_expires_at": "2026-12-09T10:01:14Z"
  },
  "ui_sync": {
    "ag_studio_ledger_updated": true,
    "bryntum_gantt_milestone_locked": "M1_PROTOTYPE"
  },
  "status": "PASS"
}

```

---

### Test 3: Day-3 Honor Period Reauthorization & Mutated `authorization_id` Rotation

**What it proves:** Your **Render Workflow** handles PayPal’s 3-day honor period cliff and properly catches the brand-new `authorization_id` returned by `POST /v2/payments/authorizations/{id}/reauthorize` (plus tests failure cascading on **Bryntum Gantt** using `PayPal-Mock-Response`).

* **How to run it:** Click **Button 2 (Fast-Forward Day-3 Honor Period)** on your Judge Demo Toolbar. Run two sub-assertions:
1. **Success Path:** Calls `/reauthorize`, asserts HTTP 201, verifies `new_authorization_id !== initial_authorization_id`, and updates the database pointer.
2. **Negative Test Path:** Sends `PayPal-Mock-Response: {"mock_application_codes": "REAUTHORIZATION_NOT_SUPPORTED"}` (or `AUTHORIZATION_ALREADY_CAPTURED`) and verifies **Bryntum Gantt** shifts dependent tasks forward by 3 days.


* **Exact Log to Generate (`logs/e2e-reauthorize-rotation.log`):**

```json
{
  "timestamp": "2026-11-10T10:02:30.811Z",
  "test_id": "E2E_03_HONOR_PERIOD_REAUTH",
  "orchestrator": "Render_Workflows_Durable_Timer",
  "paypal_api_call": {
    "endpoint": "POST /v2/payments/authorizations/0VF52814937998046/reauthorize",
    "paypal_request_id": "1c2e3f4a-5b6c-4d7e-8f9a-0b1c2d3e4f5a",
    "http_status": 201
  },
  "id_mutation_tracking": {
    "previous_authorization_id": "0VF52814937998046",
    "new_active_authorization_id": "9LK88776655443321",
    "pointer_atomically_updated": true
  },
  "negative_test_cascade": {
    "mock_header_injected": "PayPal-Mock-Response",
    "simulated_error": "AUTHORIZATION_EXPIRED",
    "bryntum_gantt_tasks_shifted": ["M2_BACKEND", "M3_DEPLOYMENT"],
    "shift_delta_hours": 72
  },
  "status": "PASS"
}

```

---

### Test 4: Idempotency Replay & Snapshot Cache Test

**What it proves:** Because PayPal’s native `PayPal-Request-Id` replay returns the *current* status of a resource rather than the initial historical snapshot (and omits a replay header), your SafeGate proxy intercepts duplicate tool calls and serves the cached original snapshot to prevent double refunds or corrupted audit logs.

* **How to run it:** Fire the exact same `capture` or `create_refund` request twice using the same `PayPal-Request-Id` UUID. Assert that the second request does not execute a second network write and returns `"idempotent_replay": true`.
* **Exact Log to Generate (`logs/e2e-idempotency-replay.log`):**

```json
{
  "timestamp": "2026-11-10T10:03:05.004Z",
  "test_id": "E2E_04_IDEMPOTENCY_GUARD",
  "paypal_request_id": "7a8b9c0d-1e2f-4a3b-8c9d-0e1f2a3b4c5d",
  "attempt_1": { "executed_network_call": true, "http_status": 201 },
  "attempt_2_duplicate": {
    "executed_network_call": false,
    "served_from_snapshot_cache": true,
    "idempotent_replay_header_injected": true,
    "prevented_duplicate_payout": true
  },
  "status": "PASS"
}

```

---

### Test 5: Multimodal Deliverable Audit (Channel3 + Elastic) & HITL Gated Capture

**What it proves:** Verifies **Channel3** catalog spec matching, **Elastic** kNN image check + transaction-linked telemetry indexing, and proves that SafeGate **blocks** `capture` until a human clicks **Approve & Execute** in **AG Studio 3**.

* **How to run it:** Upload a sample deliverable artifact. Assert that the AI verification agent calls Channel3 and Elastic, attempts to call `capture_authorization`, gets paused in `PENDING_HUMAN_APPROVAL`, and only calls `POST /v2/payments/authorizations/{new_active_id}/capture` after the HITL approval callback fires.
* **Exact Log to Generate (`logs/e2e-hitl-capture.log`):**

```json
{
  "timestamp": "2026-11-10T10:04:19.550Z",
  "test_id": "E2E_05_VERIFICATION_AND_HITL_CAPTURE",
  "multimodal_verification": {
    "channel3_sku_verified": true,
    "channel3_matched_product": "Industrial Edge Router SKU-9921",
    "elastic_knn_stock_photo_check": "AUTHENTIC_PASS (similarity_score: 0.12)",
    "elastic_audit_doc_indexed": {
      "paypal_transaction_id": "5TY99887766554432",
      "buyer_ip": "203.0.113.42",
      "deliverable_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    }
  },
  "hitl_firewall": {
    "tool_intercepted": "capture_authorization",
    "auto_execution_blocked": true,
    "paused_state": "PENDING_HUMAN_APPROVAL",
    "approved_by_operator": "merchant_admin_01",
    "approval_timestamp": "2026-11-10T10:04:18.900Z"
  },
  "paypal_api_call": {
    "endpoint": "POST /v2/payments/authorizations/9LK88776655443321/capture",
    "used_rotated_auth_id": true,
    "final_capture": false,
    "capture_id": "5TY99887766554432",
    "http_status": 201
  },
  "status": "PASS"
}

```

---

### Test 6: Raw-Byte Webhook Verification & HATEOAS Zero-Lag Hydration

**What it proves:** Your webhook gateway computes the exact CRC32 decimal checksum on raw unparsed bytes (`<transmission_id>|<time>|<webhook_id>|<crc32>`), deduplicates the event ID in Redis, and immediately follows HATEOAS `resource.links` to bypass the 3-hour `/v1/reporting/transactions` lag.

* **How to run it:** Send both a signed raw-byte webhook payload and a simulated Judge Demo webhook payload to `/api/webhooks/paypal`. Verify raw buffer parsing, signature verification, and HATEOAS `GET` lookup.
* **Exact Log to Generate (`logs/e2e-webhook-hydration.log`):**

```json
{
  "timestamp": "2026-11-10T10:05:02.310Z",
  "test_id": "E2E_06_RAW_WEBHOOK_AND_HATEOAS",
  "webhook_ingestion": {
    "event_id": "WH-2WR32451HC0233532-67976317FL4543714",
    "event_type": "CUSTOMER.DISPUTE.CREATED",
    "raw_body_bytes_preserved": true,
    "crc32_decimal_computed": 3849102931,
    "signature_verified": true,
    "redis_dedup_ttl_days": 7
  },
  "zero_lag_hydration": {
    "bypassed_3hr_reporting_search": true,
    "hateoas_link_followed": "https://api-m.sandbox.paypal.com/v1/customer/disputes/PP-D-40192",
    "hydration_latency_ms": 184,
    "bryntum_calendar_deadline_plotted": "2026-11-20T10:05:00Z"
  },
  "status": "PASS"
}

```

---

### Test 7: 1.5% Dispute Ratio Shield (`make-offer` vs. Multipart `provide-evidence`)

**What it proves:** Bridges the two critical endpoints missing from `@paypal/agent-toolkit` (`make-offer` and `provide-evidence`), protects the merchant from crossing the 1.5% High Volume dispute ratio cliff ($30 non-refundable fee), and constructs a valid `<10MB` `multipart/related` PDF evidence upload without triggering `INVALID_EVIDENCE_FILE`.

* **How to run it:** Click **Button 4 (Simulate SNAD Dispute)** on the Judge Demo Toolbar:
1. **Branch A (Inquiry at 1.42% Ratio):** Verify the agent calculates the 90-day ratio (`142 / 10000 = 1.42%`), flags proximity to the 1.5% cliff, queries **Channel3** for replacement value, and dispatches `POST /v1/customer/disputes/{id}/make-offer` ($0 dispute fee).
2. **Branch B (Escalated SNAD Claim):** Verify the agent pulls the **Elastic** audit trail from Test 5, generates an A4 PDF under 10 MB, and sends a valid `multipart/related` payload with `application/json` (`PROOF_OF_FULFILLMENT`) + `application/pdf` binary to `POST /v1/customer/disputes/{id}/provide-evidence`.


* **Exact Log to Generate (`logs/e2e-dispute-defense.log`):**

```json
{
  "timestamp": "2026-11-10T10:06:44.912Z",
  "test_id": "E2E_07_DISPUTE_SHIELD_AND_EVIDENCE",
  "dispute_id": "PP-D-40192",
  "reason": "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED",
  "ratio_radar": {
    "rolling_90d_sales": 1000,
    "rolling_90d_disputes": 14,
    "current_ratio_percent": 1.40,
    "high_volume_cliff_percent": 1.50,
    "fee_at_risk": "$30.00 (Non-Refundable High Volume Tier)"
  },
  "branch_a_inquiry_settlement": {
    "endpoint": "POST /v1/customer/disputes/PP-D-40192/make-offer",
    "offer_type": "REFUND_WITH_REPLACEMENT",
    "dispute_fee_incurred": "$0.00",
    "http_status": 200
  },
  "branch_b_claim_evidence_upload": {
    "endpoint": "POST /v1/customer/disputes/PP-D-40193/provide-evidence",
    "content_type": "multipart/related; boundary=---AegisBoundary",
    "evidence_type": "PROOF_OF_FULFILLMENT",
    "pdf_attachment": {
      "filename": "aegis_evidence_PP-D-40193.pdf",
      "page_format": "A4_SINGLE_ORIENTATION",
      "size_bytes": 412890,
      "max_allowed_bytes": 10485760,
      "linked_identifiers_verified": ["buyer_email", "transaction_id", "invoice_id", "ip_logs", "sha256_hash"]
    },
    "http_status": 200
  },
  "status": "PASS"
}

```

---

### Pre-Submission Devpost Compliance Check (Run Alongside E2E)

Add a final assertion in your test script (`npm run test:e2e`) that checks the non-code disqualifiers from the official rules:

1. `fs.existsSync('./LICENSE')` is `true` (and visible in the GitHub repo About section).


2. `.env` is ignored in `.gitignore` (zero leaked `PAYPAL_CLIENT_SECRET` strings in git history) while `.env.example` exists.
3. Public Postman collection (`./postman/PayPal_Aegis_Audit.json`) parses as valid JSON.
4. Adding a **"Download Live E2E Audit Logs (.json)"** button right inside your **AG Studio 3** top bar lets any judge download these exact 7 log entries directly from your hosted Render URL during their review!