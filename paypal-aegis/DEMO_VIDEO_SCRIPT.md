# 🎬 PayPal Aegis — 170-Second Demo Video Script
> **Targeted Prize:** $5,000 Best Demo Delivery Award + Best Overall  
> **Duration:** Strictly under 3:00 (Target: 2 minutes 45 seconds)  
> **Judges:** Jo Franchetti, Eddie Jaoude, Marco Podien, Karthik Ravi, Himraj Singh, Nathaniel Olson, Sylwia Vargas, Mats Bryntse, Ameer Hassan, Ignacio Valdez Bicard, Carly Richmond, Pooja Mistry, Shifra Williams.

---

### Segment 1: The Data Hook & Merchant Pain (0:00 – 0:25)
* **Visual:** Open directly in the live **PayPal Aegis** dashboard (`http://localhost:3000`). Show the top **1-Click Judge Demo Toolbar**, the **AG Studio 3** ledger, and the **Bryntum Gantt** timeline with realistic data.
* **Audio / Voiceover:**  
  *"For digital agencies, B2B contractors, and freelancers, PayPal is indispensable—yet deeply treacherous. Intangible deliverables receive zero protection under US Seller Protection for 'Significantly Not As Described' claims. Worse, if your rolling dispute ratio hits 1.5%, PayPal hits you with a non-refundable $30 fee per claim, even when you win.*  
  *At the same time, PayPal's new AI Agent Toolkit can surrender disputes, but gives agents zero tools to defend them. And two-step authorization holds lose reliability after Day 3, mutating the authorization ID upon renewal.*  
  *Meet **PayPal Aegis**: the Autonomous Milestone Escrow, Delivery Verification, and Dispute Compliance Operating System."*

---

### Segment 2: Live End-to-End Walkthrough (0:25 – 1:45)

#### Flow 1: Contract to Milestone Escrow Hold (0:25 – 0:45)
* **Visual:** Click **Button 1: "1. Seed Contract & Lock Sandbox Hold"** on the Judge Demo toolbar.
* **Audio / Voiceover:**  
  *"Let's start with a live Statement of Work. In one click, Aegis parses deliverables into Bryntum Gantt dependencies and calls PayPal Orders v2 with `intent: 'AUTHORIZE'`. Notice the initial hold is locked, and a durable 72-hour timer is scheduled."*

#### Flow 2: Day-3 Reauthorization & ID Pointer Mutation (0:45 – 1:05)
* **Visual:** Click **Button 2: "2. Fast-Forward Day-3 (Rotate ID)"**. Point to the AG Studio 3 ledger as the row updates with the mutated `authorization_id` badge.
* **Audio / Voiceover:**  
  *"On Day 3, PayPal requires reauthorization to maintain capture guarantees. But calling reauthorize returns a brand-new authorization ID! Watch AG Studio 3: Aegis atomically captures the newly minted ID, rotates the active pointer, archives the superseded ID in our audit ledger, and extends the honor window by another 72 hours—all backed by 36-character UUID idempotency."*

#### Flow 3: Multimodal Delivery Verification & HITL Capture (1:05 – 1:25)
* **Visual:** Click **Button 3: "3. Verify Deliverable (Channel3 + Elastic)"**. Point to the **HITL Approval Drawer** showing the staged capture. Click **"Approve & Execute"**.
* **Audio / Voiceover:**  
  *"When work is submitted, our AI agent queries Channel3 across 100 million SKUs to verify specifications and runs Elastic kNN vector similarity to ensure deliverable photos aren't internet stock photos. Notice SafeGate doesn't move funds autonomously: it stages the capture behind a Human-in-the-Loop decision gate. Click Approve, and the funds settle in the PayPal Sandbox."*

#### Flow 4: 1.5% Dispute Shield & Auto-Evidence Compiler (1:25 – 1:45)
* **Visual:** Click **Button 4: "4. Simulate SNAD Dispute (1.42% Ratio)"**. Point to the **1.5% Dispute Ratio Radar** turning to Alert mode, then show the HITL pre-escalation `$0` fee make-offer settlement and the auto-compiled A4 PDF preview.
* **Audio / Voiceover:**  
  *"Now, a buyer opens a SNAD dispute. Our Dispute Ratio Radar detects we are at 1.42%—dangerously close to the 1.5% fee cliff. Because this is an un-escalated inquiry, Aegis automatically stages a pre-escalation settlement offer at a $0 dispute fee, saving the merchant from the $30 High Volume penalty! If escalated to a claim, Aegis automatically compiles client IP logs, download timestamps, and deliverable hashes into a compliant A4 PDF under 10 megabytes, ready for multipart upload."*

---

### Segment 3: Under the Hood Architecture & Sponsor Stack (1:45 – 2:25)
* **Visual:** Switch briefly to the architecture diagram in the README or a split-screen showing typed TypeScript code in `src/engines/safegate/index.ts`.
* **Audio / Voiceover:**  
  *"Under the hood, PayPal Aegis is built with strict architectural discipline: AI for perception, deterministic code for money.*  
  *We used the **APIMatic Context Plugin** to ground versioned PayPal OpenAPI schemas in TypeScript.  
  Our **SafeGate Firewall** enforces sandbox isolation and 36-character request idempotency.  
  **AG Studio 3** powers our treasury ledger and dispute radar.  
  **Bryntum Gantt and Calendar** dynamically reschedule tasks when payment holds shift.  
  **Channel3** verifies catalog specs, **Elastic** secures the vector audit vault, and **Render Workflows** coordinates durable 72-hour timers and raw-byte CRC32 webhooks."*

---

### Segment 4: Judge Call to Action & Conclusion (2:25 – 2:45)
* **Visual:** Show the repository on GitHub with the root MIT license badge and the public Postman collection.
* **Audio / Voiceover:**  
  *"PayPal Aegis is 100% open-source under the MIT License, deployed on Render, and includes a persistent 1-Click Judge Demo toolbar so you can test every flow in under 60 seconds.*  
  *Thank you, judges—let's build what's next with PayPal and AI!"*  
  *(Fade to black at 2:45, leaving a 15-second safety margin under the 3:00 limit).*

