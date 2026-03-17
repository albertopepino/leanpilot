# LeanPilot Product Improvement Plan
## From 5.96 to 8.0+ in 12 Months

**Date:** 2026-03-14
**Baseline:** Focus group avg 5.96/10 (n=100 SME manufacturers)
**Team:** 2-3 developers, 12-month horizon
**Total estimated dev days:** ~480 (2 devs × 240 working days)

---

## Executive Summary

The focus group reveals a product that is **directionally right but operationally incomplete**. The 6-7 bracket (40% of respondents) represents a massive conversion opportunity — these people *want* to buy but hit specific blockers. The plan below systematically removes those blockers in priority order, then builds defensible differentiation.

The critical insight: **60 respondents scored 6+**, meaning the product-market fit exists for medium Italian manufacturers and continuous improvement professionals. The path to 8.0+ is not reinvention — it is completing the product, removing integration friction, and expanding language/compliance coverage.

---

## PHASE 1: Quick Wins (Month 1-2)
**Goal:** Move the 6-7 bracket to 7-8. Convert easy skeptics. Fix credibility gaps.
**Expected score impact:** 5.96 → 6.6

### 1.1 Add German, Spanish, French, Polish Language Packs
- **What:** Extend the existing i18n system (already supports en/it via JSON domain files in `src/i18n/{locale}/`) to add `de`, `es`, `fr`, `pl` locales. The architecture is already built — it is pure translation work.
- **Addresses:** Concern #1 (48 mentions — the single largest concern), Killer Objection #1
- **How:** Use AI-assisted translation (Claude/GPT) for initial pass across all 10 domains (common, login, assessment, dashboard, problem-solving, improvement, maintenance, copilot, resources, admin), then pay native-speaking lean practitioners €500-800 per language for review.
- **Effort:** 8 dev days (extend Locale type, add language switcher options, QA layout for longer strings like German) + €2,000-3,200 translation budget
- **Priority:** MUST-HAVE. This alone addresses the concern of 48 out of 100 respondents.
- **Impact:** Opens Germany (largest EU manufacturing market), Spain, France, Poland. Eliminates the #1 objection entirely.

### 1.2 Progressive Web App (PWA) for Mobile/Tablet
- **What:** Add PWA manifest, service worker, and responsive layouts for shop-floor tablet use. Not a native app — a PWA that installs from browser.
- **Addresses:** Concern #6 (24 mentions — "No mobile app")
- **How:** Next.js supports PWA via `next-pwa`. Add manifest.json, service worker for offline caching of static assets, and ensure all data-entry screens (Production Input, QC Checks, Gemba Walk, 6S Audit) have touch-optimized layouts.
- **Effort:** 10 dev days
- **Priority:** MUST-HAVE. Shop floor operators will never sit at a desktop. Tablets are the deployment surface for 80% of the use cases.
- **Deliverable:** "Install LeanPilot" prompt on Chrome/Safari, offline-capable read of dashboards, touch-friendly data entry.

### 1.3 ROI Calculator & Savings Dashboard
- **What:** Built-in ROI calculator on the landing page AND inside the app. Takes inputs: current OEE%, scrap rate, downtime hours/month, avg hourly cost. Outputs: projected annual savings from 1-point OEE improvement, scrap reduction, downtime elimination. Inside the app: real-time "LeanPilot has saved you €X this year" dashboard pulling from Kaizen savings tracking + OEE improvements.
- **Addresses:** Killer Objection #4 ("I need to see ROI in 3 months"), Cold segment CEO/Owners (avg 3.6 — they think in money, not methodology)
- **Effort:** 6 dev days (3 for landing page calculator, 3 for in-app savings dashboard)
- **Priority:** MUST-HAVE. The ROI narrative is the single most important sales tool for budget holders.

### 1.4 Guided Onboarding Wizard + "Essentials Only" Mode
- **What:** First-login wizard that asks: "What is your #1 priority?" (Reduce downtime / Improve quality / Track improvements / All of the above). Based on answer, show only the relevant 4-5 modules. Hide everything else behind an "Explore more tools" section. Include a 5-step setup guide: Create factory → Add line → Add workcenter → Enter first production data → See your first OEE.
- **Addresses:** Concern #9 (17 mentions — "Too many features"), Cold segment micro companies (avg 3.7 — overwhelmed)
- **Effort:** 8 dev days
- **Priority:** MUST-HAVE. Reduces time-to-value from "hours of confusion" to "15 minutes to first insight."

### 1.5 Excel/CSV Data Migration Tool
- **What:** Bulk import wizard for historical OEE data, production records, quality records, and kaizen items from CSV/Excel. Provide downloadable templates. Map columns visually. Preview before import.
- **Addresses:** Concern #7 (21 mentions — "Data migration")
- **Effort:** 7 dev days
- **Priority:** MUST-HAVE. Eliminates the "starting from zero" fear.

### 1.6 "Powered by LeanPilot" Trust Package
- **What:** Add to landing page and app: data residency info (EU/AWS Frankfurt), GDPR compliance badge (already have DPO report), uptime SLA commitment (99.5%), data export guarantee ("your data is always yours — one-click full export"), escrow clause in T&C for source code if company folds.
- **Addresses:** Concern #8 (19 mentions — "Vendor lock-in / small company risk")
- **Effort:** 3 dev days (one-click full export feature) + legal/copy work
- **Priority:** MUST-HAVE. Trust is table stakes for enterprise procurement.

**Phase 1 Total: ~42 dev days + ~€3,000 translation budget**

---

## PHASE 2: Core Gaps (Month 3-5)
**Goal:** Remove the blockers that prevent the 4-5 bracket from buying. Close the integration gap.
**Expected score impact:** 6.6 → 7.3

### 2.1 Machine/IoT Gateway — OPC-UA & MQTT Connector
- **What:** Lightweight data ingestion service (Python microservice) that connects to OPC-UA servers and MQTT brokers to auto-collect: machine state (running/stopped/fault), cycle count, reject count. Calculates OEE automatically. Deploy as a Docker container on customer's network edge with secure tunnel to cloud.
- **Addresses:** Concern #2 (35 mentions), Killer Objection #2 ("Without PLC/machine connection, OEE is just another manual spreadsheet")
- **How:** Phase it:
  - Month 3: OPC-UA read client + MQTT subscriber → push to LeanPilot API
  - Month 4: Configuration UI (browse OPC-UA nodes, map tags to Availability/Performance/Quality signals)
  - Month 5: Edge buffering for intermittent connectivity + auto-reconnect
- **Effort:** 30 dev days (this is the single largest and most important investment)
- **Priority:** MUST-HAVE. This is the #2 concern and the feature that separates "nice digital tool" from "real manufacturing platform." It is the bridge from manual data entry to automatic truth.
- **Competitive note:** Factbird and Evocon charge €300+/mo for OEE-only with machine connectivity. LeanPilot offering connectivity + full Lean toolset at €249 is a category killer.

### 2.2 ERP Integration Layer — SAP, Navision, Generic REST/CSV
- **What:** Bi-directional sync for: Production Orders (pull from ERP), Bill of Materials (pull), Finished Goods declarations (push to ERP), Quality holds (push). Start with SAP Business One (dominant in Italian SMEs) via SAP Service Layer REST API, and Microsoft Dynamics NAV/Business Central via OData.
- **Addresses:** Concern #4 (31 mentions), Killer Objection #5 ("Can it talk to SAP?")
- **How:**
  - Month 3: Generic webhook/REST integration framework (send/receive JSON payloads)
  - Month 4: SAP Business One connector (production orders + goods receipt)
  - Month 5: Dynamics NAV/BC connector
- **Effort:** 25 dev days
- **Priority:** MUST-HAVE. Without ERP integration, LeanPilot is a silo. With it, LeanPilot becomes the manufacturing execution bridge between ERP and shop floor.

### 2.3 Compliance Template Packs — GMP, IATF 16949, IFS/BRC
- **What:** Pre-built templates for industry-specific compliance:
  - **GMP Pack:** Batch record templates, environmental monitoring checklists, deviation/CAPA workflows matching Annex 15 structure, electronic signature for critical steps
  - **IATF 16949 Pack:** Control Plans linked to PFMEA, PPAP checklist, MSA templates, SPC charts with Cp/Cpk, customer-specific requirements tracker
  - **IFS/BRC Pack:** HACCP integration points, glass/foreign body audit checklists, supplier approval workflow, recall simulation tracker
- **Addresses:** Concern #3 (33 mentions), Killer Objection #3 ("We need GMP/IATF compliance modules, not generic checklists")
- **How:** Build a "Compliance Pack" system — a JSON-defined template engine that loads industry-specific checklists, workflows, and report formats. Content developed with industry consultants.
- **Effort:** 20 dev days (10 for template engine, 10 for three packs) + €3,000-5,000 for consultant content review
- **Priority:** MUST-HAVE for automotive (avg 6.83 — close to conversion) and pharma/cosmetics (avg 6.7). These are the highest-value segments willing to pay €249-399/mo.

### 2.4 Operator Training & Change Management Module
- **What:** Built-in training system: short video/GIF tutorials for each module, skill matrix per operator, training completion tracking, "daily tip" notifications. Include a "Champion's Toolkit" — slide decks, workshop templates, and ROI calculators that internal lean champions can use to sell LeanPilot internally.
- **Addresses:** Concern #5 (28 mentions — "my operators won't use it")
- **Effort:** 12 dev days
- **Priority:** SHOULD-HAVE. The platform is only as good as its adoption rate. This reduces the change management burden on the buyer.

### 2.5 Andon Alerts — Email, SMS, Webhook Notifications
- **What:** Configurable alert rules: "If OEE drops below X% for Y minutes, notify Z." "If NCR opened with severity Critical, escalate to quality manager." Channels: email (SES), SMS (SNS/Twilio), webhook (Slack/Teams/custom).
- **Addresses:** Enhances Positive #2 (OEE Dashboard) and Positive #6 (QC/NCR/CAPA) — makes them proactive, not just reporting.
- **Effort:** 8 dev days
- **Priority:** SHOULD-HAVE. Transforms LeanPilot from passive reporting to active manufacturing intelligence.

**Phase 2 Total: ~95 dev days + €3,000-5,000 consultant budget**

---

## PHASE 3: Market Expansion (Month 6-8)
**Goal:** Open new geographic markets and convert cold segments where economically viable.
**Expected score impact:** 7.3 → 7.7

### 3.1 Micro/Starter Tier — "LeanPilot Lite"
- **What:** Free tier limited to: 1 factory, 1 line, 3 workcenters, OEE Dashboard, Kaizen Board, 5 Why. No AI, no compliance packs, no integrations. Designed as a permanent free tool that demonstrates value and creates upgrade pressure.
- **Addresses:** Cold segment micro companies (avg 3.7), Price concern #10 (15 mentions), Romania/Eastern Europe price sensitivity
- **Effort:** 5 dev days (entitlement gating logic — most features already exist, just need feature flags)
- **Priority:** MUST-HAVE. The free tier is a marketing channel, not a revenue line. It generates word-of-mouth and creates a pipeline of companies that grow into paid tiers.

### 3.2 Romanian, Czech, Hungarian, Turkish Language Packs
- **What:** Same approach as Phase 1 languages. Extend to key Eastern European and Mediterranean manufacturing markets.
- **Addresses:** Cold segment Romania (avg 2.75), broader Eastern European expansion
- **Effort:** 4 dev days + €1,600-2,400 translation budget
- **Priority:** SHOULD-HAVE. Romania alone is a huge automotive supplier market — but only viable with local language AND the free/cheap tier.

### 3.3 White-Label / Consultant Partner Portal
- **What:** Allow lean consultants and integrators to resell LeanPilot under their brand or as a co-branded tool. Consultant gets: multi-client dashboard, benchmarking across clients (anonymized), branded reports, commission tracking.
- **Addresses:** Channel expansion — lean consultants are the #1 influence on tool adoption in SMEs. Also addresses adoption concern (consultants drive change management).
- **Effort:** 15 dev days
- **Priority:** SHOULD-HAVE. Every lean consultant who adopts LeanPilot becomes a sales rep. Target: 20 consultant partners by month 12 = 60-100 factory accounts.

### 3.4 Benchmarking & Industry KPIs
- **What:** Anonymous, opt-in benchmarking: "Your OEE is 67% — the median for Italian automotive parts suppliers on LeanPilot is 72%." Show industry quartiles. Requires minimum 10 factories per segment to be meaningful.
- **Addresses:** Enhances Positive #1 (all-in-one platform) and creates network effect / switching cost.
- **Effort:** 8 dev days
- **Priority:** NICE-TO-HAVE initially, becomes MUST-HAVE once customer base is large enough.

### 3.5 Advanced Reporting & Custom Dashboards
- **What:** Drag-and-drop dashboard builder. Custom KPI cards. Scheduled PDF/email reports (daily/weekly/monthly). Management summary view vs. operator view.
- **Addresses:** Enhances Positive #2 (OEE Dashboard), makes Enterprise tier more compelling.
- **Effort:** 15 dev days
- **Priority:** SHOULD-HAVE. This is what Enterprise buyers (€399 tier) expect.

### 3.6 API & Webhook Developer Platform
- **What:** Public REST API with API keys, rate limiting, and documentation. Webhooks for all events. Enables customers to build custom integrations without waiting for LeanPilot to build connectors.
- **Addresses:** Concern #4 (ERP integration — provides self-service path for ERPs we don't have native connectors for), Concern #8 (vendor lock-in — data always accessible via API)
- **Effort:** 10 dev days
- **Priority:** SHOULD-HAVE. This is the escape valve for "but we use ERP X and you don't support it."

**Phase 3 Total: ~57 dev days + €1,600-2,400 translation budget**

---

## PHASE 4: Competitive Moat (Month 9-12)
**Goal:** Make LeanPilot hard to leave. Build defensible advantages. Reach 8.0+ territory.
**Expected score impact:** 7.7 → 8.2

### 4.1 AI-Powered Predictive OEE & Anomaly Detection
- **What:** Using historical OEE data + machine signals (from Phase 2 IoT gateway): predict OEE for next shift, detect anomalies ("Line 3 performance dropped 8% in the last hour — similar pattern preceded a breakdown 3 times before"), suggest preventive actions.
- **Addresses:** Enhances Positive #7 (AI Copilot), creates differentiation vs. all competitors except Redzone.
- **Effort:** 20 dev days
- **Priority:** MUST-HAVE. This is the "wow" feature that justifies the AI premium and creates the "10x better" narrative.

### 4.2 Digital Gemba Walk with Photo/Video
- **What:** Tablet-native Gemba walk: walk the floor, take photos/videos at each station, annotate issues directly on photos (circle/arrow), auto-create action items linked to workcenters, AI analysis of photos for safety/5S issues (PPE detection, clutter detection).
- **Addresses:** Enhances existing Gemba Walk module, leverages Positive #7 (AI), differentiates massively from competitors.
- **Effort:** 18 dev days
- **Priority:** SHOULD-HAVE. High visual impact for demos and marketing.

### 4.3 SPC (Statistical Process Control) Module
- **What:** Real-time control charts (X-bar R, X-bar S, p-chart, c-chart), automatic out-of-control detection (Western Electric rules), Cp/Cpk calculation, gauge R&R. Essential for IATF 16949 compliance.
- **Addresses:** Concern #3 (industry compliance — IATF specifically requires SPC), strengthens automotive segment (avg 6.83).
- **Effort:** 15 dev days
- **Priority:** MUST-HAVE for automotive segment, NICE-TO-HAVE for others.

### 4.4 Shift Handover Digital Logbook
- **What:** Structured shift handover: outgoing shift fills in production summary, open issues, safety concerns, pending changeovers. Incoming shift acknowledges. Full audit trail. Replaces paper logbooks.
- **Addresses:** Daily operational pain point that creates habitual daily use — the #1 retention driver.
- **Effort:** 8 dev days
- **Priority:** SHOULD-HAVE. This is the "daily habit" feature that makes LeanPilot indispensable.

### 4.5 Supplier Quality Portal
- **What:** External portal for suppliers: receive NCRs, respond with 8D reports, track CAPA status, share quality certificates. Read-only access for customers to track supplier quality metrics.
- **Addresses:** Extends the platform beyond the four walls of the factory. Creates network effect.
- **Effort:** 15 dev days
- **Priority:** NICE-TO-HAVE. Important for Enterprise tier differentiation.

### 4.6 Energy & Sustainability Tracking
- **What:** Track energy consumption per unit produced (kWh/part), carbon footprint per product line, waste/recycling metrics. Aligns with EU sustainability reporting requirements (CSRD).
- **Addresses:** Emerging regulatory requirement, differentiation vs. all competitors, appeals to management/board level.
- **Effort:** 10 dev days
- **Priority:** NICE-TO-HAVE but increasingly important. First-mover advantage in lean + sustainability.

**Phase 4 Total: ~86 dev days**

---

## TOTAL DEVELOPMENT BUDGET

| Phase | Dev Days | Calendar | External Costs |
|-------|----------|----------|---------------|
| Phase 1: Quick Wins | 42 days | Month 1-2 | €3,000 translations |
| Phase 2: Core Gaps | 95 days | Month 3-5 | €5,000 consultants |
| Phase 3: Market Expansion | 57 days | Month 6-8 | €2,400 translations |
| Phase 4: Competitive Moat | 86 days | Month 9-12 | — |
| **TOTAL** | **280 days** | **12 months** | **~€10,400** |

280 dev days across 12 months = ~1.2 full-time developers. With 2-3 developers, this is achievable with buffer for bugs, support, and iteration.

---

## PRICING STRATEGY REVISION

### Current Problem
The current 3-tier structure (€149/€299/custom) does not match the market. Focus group data shows: 14% want nothing, 30% want Starter, 40% want Professional, 16% want Enterprise. But the cold segments (micro companies) cannot justify even €149/mo, while hot segments (CI Managers, medium manufacturers) would pay €249-399 for the right feature set.

### New Tier Structure

| Tier | Price | Target | What's Included |
|------|-------|--------|-----------------|
| **Free** | €0/forever | Micro companies (<25 emp), students, consultants evaluating | 1 factory, 1 line, 3 workcenters. OEE Dashboard, Kaizen Board, 5 Why, Ishikawa. No AI, no integrations, no compliance. Community support only. LeanPilot branding on exports. |
| **Starter** | €99/mo (was €149) | Small manufacturers 25-100 emp, single-site | Unlimited workcenters, all Lean tools (VSM, SMED, Gemba, 6S, TPM, A3), QC/NCR/CAPA, Excel import/export, PWA mobile, email alerts. 1 factory, 2 lines. Email support. |
| **Professional** | €249/mo (unchanged) | Medium manufacturers 100-500 emp | Everything in Starter + AI Copilot, IoT/OPC-UA gateway (up to 10 machines), 1 ERP connector (SAP or NAV), 1 compliance pack (GMP or IATF or IFS), custom dashboards, benchmarking. 3 factories, unlimited lines. Priority support + onboarding call. |
| **Enterprise** | €449/mo (was €399 custom) | Large SMEs 500+ emp, multi-site, regulated | Everything in Professional + unlimited factories/machines/connectors, all compliance packs, SPC module, supplier quality portal, white-label reports, API access, SSO/SAML, dedicated success manager. Phone support + quarterly business review. |

### Justification
- **Free:** Eliminates the micro company pain entirely. They stop being detractors (avg 3.7) and become a funnel. Some will grow into Starter. Zero marginal cost — cloud resources for free users are negligible.
- **Starter at €99:** Dropping from €149 to €99 crosses the psychological threshold. €99/mo = €1,188/yr. An OEE improvement of 1 percentage point on a single line typically saves €5,000-20,000/yr. The ROI argument writes itself. This captures the 30% who chose "Starter" in the survey.
- **Professional at €249:** The sweet spot. 40% of the focus group chose this tier. IoT + ERP + compliance pack justifies the price. This is where LeanPilot makes money.
- **Enterprise at €449:** Higher than the surveyed €399 because Enterprise buyers care about capability, not price. Adding SPC, supplier portal, unlimited everything, and dedicated support justifies the premium. The 16% who chose Enterprise in the survey are likely underpaying at €399.

### Annual Discount
- 20% discount for annual payment (Starter €79/mo, Professional €199/mo, Enterprise €359/mo billed annually)
- This improves cash flow, reduces churn, and makes the ROI argument even stronger

### Projected Conversion Rates (at Month 12)
- Free → Starter: 8-12% of free users convert within 6 months
- Trial → Starter: 25% of 14-day trial users (Professional trial)
- Starter → Professional: 15% upgrade within 12 months (triggered by IoT/ERP/compliance need)
- Professional → Enterprise: 10% upgrade within 12 months (triggered by multi-site expansion)
- Overall paid conversion from marketing-qualified leads: 12-18%

---

## GO-TO-MARKET PRIORITIES

### Segment Targeting — Ordered by Priority

**TIER 1 — Immediate Focus (Month 1-4)**

| Segment | Avg Score | Why First | Key Message |
|---------|-----------|-----------|-------------|
| Continuous Improvement Managers | 7.6 | Already warm. They understand the tools. They are internal champions. | "The all-in-one platform your team has been building in Excel — except it actually works." |
| Italian medium manufacturers (100-500 emp) | 7.2 | Home market advantage. Italian language. Proximity for onboarding. | "Piattaforma Lean completa, in italiano, a un prezzo che il tuo CFO approverà." |
| Automotive parts suppliers | 6.83 | High willingness to pay. IATF compliance is a forcing function. | "IATF 16949 compliance + real OEE in one platform. Half the cost of Tulip." |

**TIER 2 — Expansion Focus (Month 5-8)**

| Segment | Avg Score | Why Second | Key Message |
|---------|-----------|------------|-------------|
| Pharma/cosmetics packaging | 6.7 | GMP compliance pack unlocks this segment. High contract values. | "GMP-ready digital Lean. Batch records, deviations, CAPA — all in one system." |
| German manufacturers | New | Largest EU manufacturing economy. Now served with German language. | "Lean Manufacturing Software — endlich auf Deutsch, ohne US-Preise." |
| Spanish manufacturers | New | Growing automotive + food manufacturing. Price-sensitive but reachable at €99-249. | "Manufactura esbelta digital — sin hojas de Excel, sin consultores caros." |

**TIER 3 — Long-Tail (Month 9-12)**

| Segment | Strategy |
|---------|----------|
| Micro companies (<25 emp) | Free tier only. Do not spend sales effort. Let product-led growth work. |
| Wood/furniture, textile | Free or Starter tier. These industries have low margins and low lean maturity. Target only if they self-serve. |
| Romania/Eastern Europe | Free tier + local language. Convert to Starter at €99 as economies grow. |
| CEO/Owners of small companies | Reach them through ROI calculator + case studies. They buy outcomes, not tools. |

### Channel Strategy

1. **Content Marketing (Month 1+):** SEO-optimized blog posts in IT/EN/DE/ES on lean manufacturing topics. Target: "OEE calculation," "5 Why template," "SMED methodology," "kaizen board." Each post includes a CTA to the free tier or trial. Budget: €500/mo for content.

2. **LinkedIn Outbound (Month 1+):** Target Continuous Improvement Managers and Quality Managers in 100-500 employee manufacturers in Italy, Germany, Spain. Personalized DMs referencing their industry + specific LeanPilot module. Budget: 1 sales person part-time or founder time.

3. **Lean Consultant Partnerships (Month 6+):** Recruit 20 lean/operational excellence consultants as referral partners. Offer 20% revenue share for 12 months on referred accounts. Provide them free Professional accounts + co-branded training materials.

4. **Industry Events (Month 3+):** Present at 2-3 lean/manufacturing events per year. Priority: Lean Summit Europe, A&T (Torino automation fair), SPS Norimberga. Budget: €3,000-5,000 per event.

5. **Webinars (Month 2+, biweekly):** "OEE in 15 minutes with LeanPilot" live demo. "From paper Gemba walks to digital — a case study." Each webinar targets a specific segment. Capture leads for follow-up.

---

## METRICS & KPIs

### North Star Metric
**Monthly Recurring Revenue (MRR)**

### Dashboard KPIs

| Metric | Month 3 | Month 6 | Month 9 | Month 12 |
|--------|---------|---------|---------|----------|
| MRR | €5,000 | €15,000 | €35,000 | €70,000 |
| Paying customers | 25 | 70 | 160 | 300 |
| Free tier users | 100 | 400 | 800 | 1,500 |
| Free → Paid conversion rate | — | 8% | 10% | 12% |
| Trial → Paid conversion rate | 20% | 25% | 28% | 30% |
| Monthly churn rate | 8% | 5% | 3.5% | 2.5% |
| NPS score | 30 | 40 | 50 | 55+ |
| Avg subscribe likelihood (resurvey) | 6.6 | 7.3 | 7.7 | 8.2 |
| Languages live | 6 (en/it/de/es/fr/pl) | 10 | 10 | 10 |
| IoT-connected machines | 0 | 50 | 200 | 500 |
| ERP integrations live | 0 | 20 | 60 | 120 |
| Consultant partners | 0 | 5 | 12 | 20 |

### Leading Indicators to Watch Weekly
- **Activation rate:** % of new signups that complete onboarding wizard and enter first production data within 48 hours. Target: 60%+.
- **Weekly active factories:** Number of factories with at least 1 data entry per week. Target: 80% of paying customers.
- **Time to first OEE:** Minutes from signup to seeing first OEE number. Target: <15 min with onboarding wizard.
- **Feature adoption breadth:** Avg number of modules used per paying customer. Target: 5+ modules by month 3 of subscription.
- **Support ticket volume:** Downward trend indicates improving UX. Target: <2 tickets per customer per month.

### Lagging Indicators (Monthly Review)
- Customer Acquisition Cost (CAC) by channel
- Lifetime Value (LTV) by tier and segment
- LTV:CAC ratio (target: >3:1 by month 9)
- Expansion revenue (upgrades as % of MRR)
- Logo churn vs. revenue churn

---

## PRODUCT VISION — Month 12

### Where LeanPilot Stands at Month 12

LeanPilot is the **default lean manufacturing platform for European SMEs**. It is:

1. **The only affordable platform that connects machines to methodology.** OPC-UA/MQTT gateway feeds real OEE data into a complete lean toolset (Kaizen, VSM, SMED, 5 Why, Ishikawa, A3, Gemba, 6S, TPM, SPC). Competitors either offer machine connectivity without lean tools (Evocon, Factbird) or lean tools without machine connectivity (spreadsheets, standalone apps). LeanPilot does both.

2. **Multilingual from day one.** Available in 10 European languages. No competitor under €500/mo offers this breadth. This is a structural advantage that compounds — every language opens a new market with near-zero marginal cost.

3. **Compliance-ready out of the box.** GMP, IATF 16949, IFS/BRC template packs mean regulated industries can adopt LeanPilot without building compliance workflows from scratch. Competitors charge consulting fees for this. LeanPilot includes it.

4. **AI-augmented, not AI-dependent.** The AI Copilot, predictive OEE, and anomaly detection are genuine differentiators, but the platform works perfectly without AI. This is critical for price-sensitive segments and for companies that are not ready for AI.

5. **ERP-integrated, not ERP-replacing.** The SAP/NAV connectors plus open API mean LeanPilot fits into existing IT landscapes rather than demanding replacement. This eliminates the #1 IT department objection.

### What Makes It Unbeatable

- **Price:** €99-449/mo vs. competitors at €300-40,000+/mo. At Professional tier (€249/mo), LeanPilot offers more lean methodology coverage than any competitor at any price.
- **Time to value:** 15 minutes from signup to first OEE reading (with IoT gateway: 2 hours). Competitors require weeks of implementation.
- **Breadth:** 25+ lean tools in one platform. No switching between apps, no integration headaches, no data silos.
- **Network effect:** Benchmarking across factories creates value that increases with every new customer. Once 500+ factories are on the platform, the data itself becomes a competitive moat.
- **Consultant ecosystem:** 20+ lean consultants actively recommending and implementing LeanPilot. This is a distribution channel that competitors cannot easily replicate.

### The "10x Better" Narrative

**For a Continuous Improvement Manager:**
"Before LeanPilot, I spent 60% of my time collecting data and building reports in Excel. Now I spend 90% of my time actually improving processes. OEE is calculated automatically from the machines. Kaizen items are tracked with real savings. My monthly report generates itself. And the AI flagged a pattern in Line 4 downtime that I had missed for months — we fixed it and saved €23,000 in the first quarter."

**For a CEO/Owner:**
"I can see the OEE of every line in every factory on my phone. I know exactly how much our continuous improvement program has saved this year — €187,000. When our biggest customer audited us for IATF, we pulled up every control plan, SPC chart, and CAPA record in 10 minutes. The platform costs us €249/month. It pays for itself every 3 days."

**For an IT Manager:**
"It took us 2 hours to set up. Docker container on our edge server, OPC-UA connection to 8 machines, SAP Business One sync for production orders. No VPN headaches, no custom development, no vendor lock-in — we can export everything via API at any time."

---

## IMPLEMENTATION SEQUENCE — WEEK BY WEEK

### Month 1 (Weeks 1-4)
- **Week 1-2:** Language packs (DE, ES, FR, PL) — Developer A. PWA setup + manifest — Developer B.
- **Week 3-4:** ROI calculator (landing + in-app) — Developer A. Onboarding wizard — Developer B.

### Month 2 (Weeks 5-8)
- **Week 5-6:** Excel/CSV migration tool — Developer A. PWA responsive layouts for shop floor screens — Developer B.
- **Week 7-8:** Trust package (data export, SLA page) — Developer A. Onboarding wizard polish + "Essentials Only" mode — Developer B.

### Month 3 (Weeks 9-12)
- **Week 9-12:** OPC-UA/MQTT gateway service (core) — Developer A. Generic REST integration framework — Developer B.

### Month 4 (Weeks 13-16)
- **Week 13-16:** IoT gateway configuration UI — Developer A. SAP Business One connector — Developer B.

### Month 5 (Weeks 17-20)
- **Week 17-18:** IoT edge buffering + reliability — Developer A. Dynamics NAV/BC connector — Developer B.
- **Week 19-20:** Compliance template engine — Developer A. GMP + IATF template packs — Developer B.

### Month 6 (Weeks 21-24)
- **Week 21-22:** IFS/BRC pack + operator training module — Developer A. Free tier entitlement system — Developer B.
- **Week 23-24:** Andon alerts (email/SMS/webhook) — Developer A. Eastern European language packs — Developer B.

### Month 7 (Weeks 25-28)
- **Week 25-28:** Consultant partner portal — Developer A. Custom dashboard builder — Developer B.

### Month 8 (Weeks 29-32)
- **Week 29-30:** Benchmarking system — Developer A. Advanced reporting / scheduled PDF — Developer B.
- **Week 31-32:** Public API + documentation — Developer A. API key management + rate limiting — Developer B.

### Month 9 (Weeks 33-36)
- **Week 33-36:** Predictive OEE + anomaly detection (ML pipeline) — Developer A. SPC module (control charts) — Developer B.

### Month 10 (Weeks 37-40)
- **Week 37-40:** Predictive OEE polish + training — Developer A. SPC Cp/Cpk + Western Electric rules — Developer B.

### Month 11 (Weeks 41-44)
- **Week 41-44:** Digital Gemba Walk with photo annotation — Developer A. Shift handover logbook — Developer B.

### Month 12 (Weeks 45-48)
- **Week 45-46:** Supplier quality portal — Developer A. Energy/sustainability tracking — Developer B.
- **Week 47-48:** Integration testing, bug fixes, documentation, marketing push for v2.0 launch.

---

## RISK MITIGATION

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| IoT gateway too complex for 2 devs | Medium | High | Start with MQTT only (simpler than OPC-UA). Partner with system integrator for OPC-UA expertise. Consider open-source OPC-UA libraries (python-opcua). |
| SAP integration takes longer than planned | High | Medium | Ship generic REST/webhook first. SAP connector can slip to Month 6 without blocking sales — many SMEs don't have SAP. |
| Low free-tier conversion | Medium | Low | Free tier costs almost nothing to run. Even 5% conversion is profitable. Instrument the funnel obsessively — identify where free users drop off. |
| Competitor copies the multi-language advantage | Low | Medium | Language is a moat only temporarily. The real moat is the combination of language + compliance + IoT + price. No single competitor can replicate all four quickly. |
| Team burnout from aggressive roadmap | Medium | High | The schedule has buffer — 280 dev days across 480 available days (2 devs × 240). Use the remaining 200 days for bugs, support, iteration, and breathing room. Ruthlessly cut NICE-TO-HAVE items if velocity drops. |

---

## WHAT TO CUT IF BEHIND SCHEDULE

In priority order of what to defer (cut last = most important):

1. Energy/sustainability tracking (defer to post-12 months)
2. Supplier quality portal (defer)
3. Digital Gemba Walk photo AI (keep photo annotation, cut AI analysis)
4. Benchmarking (defer until 500+ factories)
5. Consultant partner portal (simplify to referral link + dashboard)
6. Eastern European languages (defer — DE/ES/FR/PL cover 80% of the opportunity)

**Never cut these, even if behind:**
- Language packs (DE/ES/FR/PL) — #1 concern
- IoT gateway (at minimum MQTT) — #2 concern
- Compliance packs (at minimum IATF) — #3 concern
- ERP integration (at minimum generic REST) — #4 concern
- PWA mobile — #6 concern
- Free tier — unlocks cold segments
- ROI calculator — closes warm segments

---

## SUMMARY: THE PATH FROM 5.96 TO 8.0+

| Action | Score Impact | Why |
|--------|-------------|-----|
| Add 4 languages | +0.3 | Eliminates #1 concern for 48% of respondents |
| PWA mobile | +0.15 | Enables shop floor use case |
| ROI calculator + savings dashboard | +0.15 | Converts CEO/Owner skeptics |
| Onboarding wizard + Essentials mode | +0.1 | Removes overwhelm for small companies |
| IoT/OPC-UA gateway | +0.4 | Eliminates #2 concern, transforms product category |
| ERP integration | +0.3 | Eliminates #4 concern, removes IT blocker |
| Compliance packs (GMP/IATF/IFS) | +0.3 | Converts automotive + pharma segments |
| Free tier | +0.2 | Converts micro companies from 3.7 to 5-6 range |
| Operator training module | +0.1 | Addresses adoption concern |
| Predictive AI + SPC | +0.2 | Creates "wow" factor, justifies premium |
| Consultant ecosystem | +0.1 | Indirect — improves adoption and word-of-mouth |
| **CUMULATIVE** | **+2.3** | **5.96 + 2.3 = 8.26** |

The math works. Each improvement addresses a specific, quantified concern from the focus group. The plan is sequenced so that the highest-impact, lowest-effort items come first, and each phase builds on the previous one. By month 12, LeanPilot will have addressed every single concern raised by the 100 respondents, doubled down on every strength, and built structural advantages that competitors cannot easily replicate.
