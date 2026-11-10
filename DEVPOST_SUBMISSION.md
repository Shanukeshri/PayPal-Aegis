# 📝 Devpost Hackathon Submission Draft: PayPal Aegis

> **Project Name:** PayPal Aegis  
> **Tagline:** Autonomous Milestone Escrow, Delivery Verification & Dispute Compliance Operating System  
> **Live Web Application (Try It Out):** [https://paypal-aegis.onrender.com](https://paypal-aegis.onrender.com)  
> **Repository:** [https://github.com/Shanukeshri/PayPal-Aegis](https://github.com/Shanukeshri/PayPal-Aegis) (Open Source MIT License)  
> **Health Check:** [https://paypal-aegis.onrender.com/health](https://paypal-aegis.onrender.com/health)  
> **Audit Dossier:** [report.pdf](https://github.com/Shanukeshri/PayPal-Aegis/blob/main/report.pdf)

---

## 📋 Devpost Submission Form Fields (Quick Copy-Paste)

| Devpost Form Field | What to Enter |
| :--- | :--- |
| **Project Title** | `PayPal Aegis` |
| **Tagline** | `Autonomous Milestone Escrow, Delivery Verification & Dispute Compliance Operating System` |
| **Try it out (Live Link)** | `https://paypal-aegis.onrender.com` |
| **GitHub Repository** | `https://github.com/Shanukeshri/PayPal-Aegis` |
| **Video Demo URL** | *(Your YouTube link from DEMO_VIDEO_SCRIPT.md)* |
| **Additional Links** | Health Check: `https://paypal-aegis.onrender.com/health`<br>Audit Dossier: `https://github.com/Shanukeshri/PayPal-Aegis/blob/main/report.pdf`<br>Postman Collection: `https://github.com/Shanukeshri/PayPal-Aegis/blob/main/postman/PayPal_Aegis_Audit.json` |

---

## Pitch & Overview

### 💡 Inspiration
Merchants selling digital deliverables, software milestones, and custom B2B services face an asymmetric vulnerability in the PayPal ecosystem:
1. **The Intangible Goods Gap:** Digital deliverables receive 0% protection against "Significantly Not As Described" (SNAD) disputes under US Seller Protection.
2. **The 1.5% Fee Cliff:** Crossing a 1.5% dispute ratio moves accounts into the High Volume tier, assessing a non-refundable $30 fee per claim—even when the merchant wins.
3. **The AI Tooling Asymmetry:** PayPal's official Agent Toolkit can surrender disputes (`accept_dispute_claim`), but provides zero tools to fight them (`provide-evidence`) or manage multi-step holds.
4. **The 3-Day Hold Bug:** Standard authorizations (`intent: "AUTHORIZE"`) degrade after 3 days, and reauthorizing mutates the `authorization_id`, breaking downstream integrations.

We built **PayPal Aegis** to resolve this entire vertical lifecycle: **Lock Funds Safely → Verify Deliverables → Auto-Defend Revenue**.

---

## ⚙️ What It Does

* **Engine 1 (SafeGate MCP Proxy):** A deterministic firewall wrapping `@paypal/agent-toolkit` that enforces sandbox safety, in-memory OAuth renewal, 36-character UUID idempotency with snapshot caching, and a Human-in-the-Loop (HITL) approval gate for all money-moving operations.
* **Engine 2 (Hold & Schedule Manager):** Two-step milestone escrow using Orders v2 and Payments v2. Coordinates 72-hour durable timers in Render Workflows and rotates the mutated `authorization_id` pointer atomically on Day-3 reauthorization.
* **Engine 3 (Webhook Gateway & Verification Vault):** Raw-byte CRC32 + RSA-SHA256 webhook verifier (with dual-mode HMAC fallback for simulated events), HATEOAS state hydrator, and multimodal proof-of-delivery indexing via Channel3 (100M+ SKUs) and Elasticsearch (kNN image similarity).
* **Engine 4 (1.5% Dispute Ratio Shield & Evidence Compiler):** Rolling 90-day dispute ratio calculator. Directs inquiries approaching 1.5% to pre-escalation `$0` fee make-offer settlements. For formal claims, auto-compiles client IP telemetry, download timestamps, and deliverable SHA-256 hashes into a <10MB A4 PDF uploaded via `multipart/related`.
* **Engine 5 (Unified Command Center & 1-Click Judge Demo Toolbar):** Real-time command center combining AG Studio 3 (mutated ID ledger, dispute radar, HITL drawer), Bryntum Gantt & Calendar (payment-driven task shifting and 10-day response countdowns), and a top 1-Click Judge Demo toolbar for instant zero-friction auditing.

---

## 🛠️ How We Built It

* **Backend:** TypeScript, Node.js, Express, Socket.IO, `@paypal/agent-toolkit`, Axios, node-forge, PDFKit, CRC-32.
* **Frontend:** Next.js 14 (App Router), React, Tailwind CSS, AG Grid Enterprise / AG Studio 3, Bryntum Gantt & Calendar.
* **Grounding & APIs:** APIMatic Context Plugin for deterministic PayPal OpenAPI schemas, Channel3 Catalog API, Elasticsearch kNN vector search, Render Workflows SDK.
* **Testing:** Public Postman collection covering 4 test sequences with negative-testing error injection.

---

## 🏆 Targeted Hackathon Tracks

1. **Overall Hackathon Prizes (1st, 2nd, 3rd)**
2. **Best Use of Agentic Commerce ($5,000)**
3. **Best Use of PayPal + AI ($5,000)**
4. **Best Use of AG Grid / AG Studio ($10,000 pool)**
5. **Best Use of Bryntum ($3,000 pool)**
6. **Best Use of APIMatic ($3,000 pool + Business Subscriptions)**
7. **Best Use of Channel3 ($1,500)**
8. **Best Use of Render ($2,250 credits pool)**
9. **Best Demo Delivery ($5,000)**

---

## 🚀 Try It Live

1. Open the live deployment directly in any browser (Zero-Auth / No sign-in required):  
   👉 **[https://paypal-aegis.onrender.com](https://paypal-aegis.onrender.com)**
2. Check the real-time health telemetry endpoint:  
   👉 **[https://paypal-aegis.onrender.com/health](https://paypal-aegis.onrender.com/health)**
3. Use the persistent **Judge Demo Fixtures** toolbar at the top of the command center:
   * **Button 1 (Seed Contract & Hold):** Ingests SOW into Bryntum Gantt and creates PayPal Orders v2 escrow hold (`intent: "AUTHORIZE"`).
   * **Button 2 (Fast-Forward Day-3):** Fast-forwards 72h timer, mutates `authorization_id`, and rotates active pointer in AG Studio 3.
   * **Button 3 (Verify Deliverable):** Queries Channel3 catalog specs and Elastic kNN image authenticity, intercepting `capture` in SafeGate HITL.
   * **Button 4 (Simulate SNAD Dispute):** Calibrates 90-day volume to 1.42% Warning Zone and triggers pre-escalation `$0` fee make-offer settlement or compliant `<10MB` A4 PDF evidence upload.
4. Review or download the live audit dossier directly from the top navigation bar by clicking **"Download Live E2E Audit Logs (.json)"** or download [`report.pdf`](https://github.com/Shanukeshri/PayPal-Aegis/blob/main/report.pdf).
