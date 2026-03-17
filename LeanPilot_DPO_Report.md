# LeanPilot -- Data Protection Officer (DPO) Compliance Report

**Report Date:** 2026-03-13
**Prepared by:** DPO Compliance Review (Automated Audit)
**Platform:** LeanPilot v1.0.0 -- Lean Manufacturing SaaS Platform
**Target Markets:** EU (Italy primary), Serbia/Balkans, International Expansion
**Classification:** CONFIDENTIAL -- INTERNAL USE ONLY

---

## EXECUTIVE SUMMARY

### Overall Compliance Status: RED (Critical Non-Compliance)

LeanPilot is in an **early development stage** with significant data protection gaps that must be resolved before any production deployment, especially in EU/EEA markets. The platform collects and processes personal data (employee accounts, production performance data attributable to individuals, AI chat conversations) but lacks fundamental GDPR infrastructure.

| Area | Status | Priority |
|------|--------|----------|
| GDPR Legal Basis & Consent | RED | Critical |
| Data Subject Rights (Access/Erasure/Portability) | RED | Critical |
| Privacy Policy & Legal Documents | RED | Critical |
| Cookie/ePrivacy Compliance | RED | Critical |
| AI Act Transparency | RED | Critical |
| Password & Authentication Security | AMBER | High |
| Data Encryption (at rest) | RED | Critical |
| Data Retention Policy | RED | Critical |
| Breach Notification Process | RED | Critical |
| DPIA for AI Features | RED | Critical |
| ZZLP (Serbian) Compliance | RED | Critical |
| Employee Monitoring Safeguards | RED | Critical |
| Cross-Border Data Transfers | RED | Critical |
| Data Processing Agreements | RED | Critical |
| Technical Security (JWT, CORS) | AMBER | High |
| Privacy by Design Architecture | AMBER | High |
| Records of Processing Activities | RED | Critical |

**Summary:** 15 of 17 areas are RED (critical). The platform cannot be deployed in EU markets in its current state without substantial legal and technical remediation.

---

## 1. GDPR COMPLIANCE AUDIT

### 1.1 Legal Basis for Processing (Art. 6 GDPR)

**Status: RED -- No legal basis identified or implemented**

**Findings:**
- No consent mechanism exists anywhere in the codebase. The registration endpoint (`backend/app/api/routes/auth.py`) creates user accounts without any consent checkbox, privacy policy acceptance, or terms of service acknowledgment.
- No `consent_given` or `privacy_policy_accepted` field exists in the User model (`backend/app/models/user.py`).
- No record of when consent was given, what version of the privacy policy was accepted, or what specific processing purposes were consented to.
- The legal basis for processing employee production data (OEE, downtime, scrap records linked to `recorded_by_id`) is unclear -- this likely requires either legitimate interest assessment or explicit consent under worker privacy regulations.

**Required Actions:**
1. Add `privacy_policy_accepted_at`, `terms_accepted_at`, `consent_version` fields to the User model
2. Implement consent collection at registration with granular consent for: (a) account management, (b) production data processing, (c) AI copilot data processing, (d) analytics
3. Store consent records as immutable audit log entries
4. Determine legal basis per processing activity (likely a combination of contract performance Art. 6(1)(b), legitimate interest Art. 6(1)(f), and consent Art. 6(1)(a))
5. For employee monitoring aspects, specific legal basis and works council consultation may be needed

### 1.2 Consent Management

**Status: RED -- Not implemented**

**Findings:**
- No cookie consent banner or mechanism in the frontend (`frontend/src/app/layout.tsx`, `frontend/src/app/providers.tsx`)
- `localStorage` is used to store `leanpilot_token` and `leanpilot_locale` without user consent (see `frontend/src/hooks/useAuth.ts` line 33 and `frontend/src/stores/useI18n.ts` line 59)
- No consent management platform (CMP) integration
- No granular consent options for different processing purposes

**Required Actions:**
1. Implement a GDPR-compliant cookie/storage consent banner before any localStorage access
2. Integrate a CMP (e.g., Cookiebot, OneTrust, or custom) for managing consent preferences
3. Block localStorage writes until consent is obtained (essential cookies exception may apply to auth token under strict necessity)
4. Provide consent withdrawal mechanism

### 1.3 Data Minimization (Art. 5(1)(c) GDPR)

**Status: AMBER -- Partial concerns**

**Findings:**
- The core data model appears reasonable for its stated purpose (lean manufacturing management)
- However, the AI module stores extensive data snapshots in `data_context` (JSON) on every AI message (`backend/app/models/ai.py` line 28) -- this includes 30 days of factory OEE data, downtime events, and scrap records per message, creating data duplication
- `AIKaizenSuggestion.data_snapshot` (line 59) also stores factory data snapshots
- `GembaObservation.photo_url` and `SixSAudit.photo_urls` could contain images of employees, raising biometric/facial recognition concerns
- The `recorded_by_id` foreign key on production records, downtime events, and scrap records directly links operational data to individual employees, potentially creating a performance monitoring profile

**Required Actions:**
1. Minimize `data_context` storage in AI messages -- store only a reference/hash, not full data
2. Implement data snapshot retention limits (auto-delete after X days)
3. Add clear policies about photo content (no facial recognition, no employee identification without consent)
4. Evaluate whether `recorded_by_id` is truly necessary on all records or can be anonymized after a period

### 1.4 Right to Access (Art. 15 GDPR)

**Status: RED -- Not implemented**

**Findings:**
- No API endpoint exists for users to download their personal data
- The `/auth/me` endpoint only returns basic profile information, not the full dataset associated with the user
- No mechanism to export: production records created by the user, AI conversation history, kaizen items created/assigned, gemba observations, CILT executions, or any other data linked to `user.id`

**Required Actions:**
1. Create a `/api/v1/privacy/my-data` endpoint that compiles all personal data across all tables
2. Include: user profile, all records where user is `recorded_by_id`, `created_by_id`, `auditor_id`, `walker_id`, `operator_id`, `performed_by_id`, `assigned_to_id`, `triggered_by_id`, `reviewed_by_id`, `verified_by_id`, `sponsor_id`
3. Export in machine-readable format (JSON and CSV)
4. Provide a UI page for users to trigger data export

### 1.5 Right to Erasure (Art. 17 GDPR)

**Status: RED -- Not implemented**

**Findings:**
- No deletion endpoint exists for user accounts
- No soft-delete mechanism (no `is_deleted` or `deleted_at` fields)
- No cascade deletion or anonymization logic for related records
- The `recorded_by_id` foreign keys across dozens of tables mean user deletion would require careful handling of referential integrity

**Required Actions:**
1. Implement account deletion with two options: (a) full anonymization (replace personal data with pseudonyms, keep statistical records), (b) full deletion where legally permissible
2. Add a `/api/v1/privacy/delete-account` endpoint with confirmation flow
3. Implement a grace period (e.g., 30 days) before permanent deletion
4. Handle `recorded_by_id` references by setting them to NULL or a "deleted user" placeholder
5. Delete all AI conversation messages associated with the user
6. Document which data must be retained for legal/tax obligations and for how long

### 1.6 Right to Portability (Art. 20 GDPR)

**Status: RED -- Not implemented**

**Findings:**
- No data export functionality in any format
- No API endpoint for structured data download

**Required Actions:**
1. Implement data export in JSON and CSV formats
2. Include all data provided by the user and data generated from their activity
3. Ensure format is machine-readable and commonly used

### 1.7 Data Processing Records (Art. 30 GDPR)

**Status: RED -- No ROPA exists**

**Required Actions:**
1. Create and maintain a Record of Processing Activities (ROPA) covering all data processing operations
2. Document: purpose, legal basis, data categories, recipients, retention periods, security measures for each processing activity

### 1.8 Data Processing Agreements (Art. 28 GDPR)

**Status: RED -- No DPAs in place**

**Findings:**
- OpenAI is a sub-processor (AI engine sends factory data to OpenAI API) -- see `backend/app/services/ai_engine.py`
- PostgreSQL hosting provider (when deployed) will be a sub-processor
- Redis provider (when deployed) will be a sub-processor
- No sub-processor list exists

**Required Actions:**
1. Execute DPA with OpenAI (OpenAI provides a standard DPA)
2. Execute DPA with cloud hosting provider (AWS/GCP/Azure)
3. Execute DPA with any CDN or email service provider
4. Create and maintain a public sub-processor list
5. Implement sub-processor change notification mechanism for customers

### 1.9 Breach Notification (Art. 33-34 GDPR)

**Status: RED -- No mechanism exists**

**Findings:**
- No logging of security events (failed logins, unauthorized access attempts)
- No breach detection system
- No breach notification template or procedure
- No incident response plan

**Required Actions:**
1. Implement security event logging (failed logins, permission violations, unusual data access patterns)
2. Create a Breach Response Plan with roles, responsibilities, and timelines
3. Implement 72-hour notification workflow to supervisory authority
4. Prepare data subject notification templates
5. Designate breach response team

### 1.10 Privacy by Design (Art. 25 GDPR)

**Status: AMBER -- Some elements present, major gaps**

**Findings:**
- Positive: Password hashing uses bcrypt (`backend/app/core/security.py` line 11)
- Positive: Authentication required for all API endpoints via `get_current_user` dependency
- Negative: No field-level encryption for sensitive data
- Negative: No data classification scheme
- Negative: No audit trail/logging of data access
- Negative: No role-based access control beyond basic authentication (any authenticated user can access any factory's data -- no tenant isolation visible in production routes)
- Negative: CORS is configured for localhost only (`backend/app/main.py` lines 18-23) but uses wildcard methods and headers

**Critical Finding -- Multi-Tenancy Gap:**
The production routes (`backend/app/api/routes/production.py`) do not filter records by the current user's `factory_id`. The `list_production_records` endpoint returns records across all factories. This is a serious data isolation violation.

**Required Actions:**
1. Implement proper multi-tenant data isolation -- all queries must filter by user's factory_id
2. Add role-based access control (RBAC) middleware
3. Implement audit logging for all data access and modifications
4. Add field-level encryption for sensitive personal data
5. Configure CORS properly for production domains
6. Add rate limiting to prevent abuse

### 1.11 DPIA for AI Features

**Status: RED -- DPIA required but not conducted**

**Findings:**
Under Art. 35 GDPR, a DPIA is mandatory when processing involves:
- Systematic and extensive profiling with significant effects (the AI Copilot analyzes employee-linked production data to generate improvement suggestions)
- Processing of employee performance data at scale
- Use of new technologies (AI/LLM) for processing personal data

The Factory Copilot (`backend/app/services/ai_engine.py`) sends 30 days of production data (including data attributable to individual workers via `recorded_by_id`) to OpenAI's API. This constitutes:
- International data transfer (to OpenAI servers, likely US-based)
- Processing by an AI system with potential to generate assessments about employee performance
- Automated decision-making that could affect employees (kaizen suggestions, root cause analyses naming workers/teams)

**Required Actions:**
1. Conduct a full DPIA before deploying AI features
2. Document: necessity, proportionality, risks to data subjects, mitigating measures
3. Consult with supervisory authority if high residual risk remains
4. Implement human oversight mechanism for AI-generated suggestions
5. Anonymize or pseudonymize worker-identifiable data before sending to OpenAI

---

## 2. ZZLP COMPLIANCE (Serbian Data Protection -- Zakon o zastiti podataka o licnosti)

### 2.1 ZZLP vs. GDPR Differences

Serbia's ZZLP (adopted 2018, effective 2019) is substantially aligned with GDPR but has key differences:

| Aspect | GDPR | ZZLP | Impact on LeanPilot |
|--------|------|------|---------------------|
| Supervisory Authority | National DPAs | Commissioner for Information (Poverenik) | Must register with Poverenik if processing Serbian residents' data |
| DPO Appointment | Mandatory in certain cases | Mandatory for systematic monitoring at scale | Likely required for factory worker monitoring |
| Data Transfer | Adequacy + SCCs + BCRs | Similar framework, Serbia has own adequacy list | Serbia is NOT an EU adequate country; transfers from EU to Serbia need SCCs |
| Fines | Up to 4% annual turnover / EUR 20M | Up to RSD 2,000,000 (~EUR 17,000) for legal entities | Lower fine ceiling but still significant |
| Employee Data | Varies by member state | Specific provisions in Labor Law (Zakon o radu) | Must comply with Serbian labor law for employee data |
| Consent Age | 16 (default, states can lower to 13) | 15 years | Not directly relevant for factory workers |

### 2.2 Serbia-Specific Requirements

**Status: RED -- Not addressed**

1. **Local Representative:** If processing data of Serbian residents without establishment in Serbia, a local representative must be appointed (Art. 42 ZZLP)
2. **Data Transfer from EU to Serbia:** Serbia does NOT have an EU adequacy decision. Transfers of EU personal data to Serbia require Standard Contractual Clauses (SCCs) or other Art. 46 GDPR mechanisms
3. **Data Transfer from Serbia to EU:** Serbia recognizes EU/EEA countries as adequate
4. **Registration with Poverenik:** Processing activities involving employee monitoring should be evaluated for registration requirements
5. **Serbian Language Requirements:** Privacy notices must be available in Serbian for Serbian data subjects

**Required Actions:**
1. Appoint a local representative in Serbia if no Serbian establishment exists
2. Implement SCCs for EU-to-Serbia data transfers
3. Add Serbian (sr) language support for all privacy notices
4. Register with the Serbian Commissioner as required
5. Review compliance with Serbian Labor Law provisions on employee data

### 2.3 Adequacy Decision Status

As of March 2026, Serbia does NOT hold an EU adequacy decision under Art. 45 GDPR. Serbia is a candidate country for EU accession, and the ZZLP is aligned with GDPR, but the formal adequacy process has not been completed. This means:
- EU-to-Serbia transfers: Require SCCs (Art. 46(2)(c) GDPR) or other appropriate safeguards
- Serbia-to-EU transfers: Permitted under ZZLP (EU is on Serbia's adequate countries list)

---

## 3. INTERNATIONAL COMPLIANCE

### 3.1 ePrivacy Directive (Cookie Law)

**Status: RED -- No compliance**

**Findings:**
- `localStorage` is used for authentication tokens and locale preference without consent
- No cookie consent banner
- No distinction between strictly necessary and non-essential storage

**Required Actions:**
1. Classify storage usage: `leanpilot_token` (potentially strictly necessary for service), `leanpilot_locale` (functional, requires consent)
2. Implement consent-before-storage for non-essential items
3. Add cookie policy page

### 3.2 CalOPPA (California Online Privacy Protection Act)

If US expansion is planned:
- Must have a conspicuous privacy policy link
- Must describe data collection and sharing practices
- Must honor Do Not Track signals (or disclose non-compliance)
- Must describe how users can review and change their data

### 3.3 Brazilian LGPD

If expanding to Brazil:
- Similar to GDPR; requires legal basis, DPO appointment (Encarregado), and data subject rights
- Must appoint a local DPO/representative in Brazil
- Data transfers to non-adequate countries require SCCs equivalent

### 3.4 UK GDPR (Post-Brexit)

If serving UK customers:
- Substantially similar to EU GDPR
- Must register with ICO (Information Commissioner's Office)
- UK has its own adequacy decision from the EU (valid, subject to review)
- International Data Transfer Agreement (IDTA) or UK Addendum to EU SCCs needed for transfers

### 3.5 Cross-Border Data Transfer Mechanisms

**Status: RED -- Not addressed**

**Current Data Flows:**
1. User data (EU) --> LeanPilot servers (location TBD) -- needs hosting decision
2. Factory data (EU) --> OpenAI API (US-based) -- requires: (a) DPA with OpenAI, (b) SCCs or reliance on EU-US Data Privacy Framework (DPF) if OpenAI is DPF-certified
3. User data (Serbia) --> LeanPilot servers (EU) -- permitted under ZZLP
4. User data (EU) --> Serbia (if any processing occurs there) -- requires SCCs

**Required Actions:**
1. Document all cross-border data flows in a data flow map
2. Execute appropriate transfer mechanisms for each flow
3. Conduct Transfer Impact Assessments (TIAs) where required
4. Select EU-based hosting to minimize transfer complexity

---

## 4. AI-SPECIFIC COMPLIANCE

### 4.1 EU AI Act Implications

**Status: RED -- Not assessed or addressed**

The EU AI Act (Regulation 2024/1689) entered into force on 1 August 2024, with requirements phasing in through 2027.

**Classification of LeanPilot AI Features:**

| Feature | Likely Risk Category | Reasoning |
|---------|---------------------|-----------|
| Factory Copilot (chat) | Limited Risk | General-purpose AI assistant for factory data analysis |
| Root Cause AI | Limited Risk | Automated analysis generating suggestions (human review required) |
| Auto Kaizen | Limited Risk / High Risk (borderline) | If suggestions influence workforce decisions (staffing, performance) could be HIGH RISK |
| Gemba Vision (planned) | High Risk (if using employee images) | Computer vision in workplace context involving workers |

**Transparency Requirements (Art. 50):**
- Users must be informed they are interacting with an AI system -- PARTIALLY MET (UI shows "Factory Copilot" with AI branding)
- AI-generated content must be clearly marked -- NOT MET (AI suggestions in kaizen board mix with human-created entries, distinguished only by `ai_generated` boolean flag)
- The AI system's capabilities and limitations must be disclosed -- NOT MET

**Required Actions:**
1. Add clear AI disclosure notices: "This response was generated by an AI system"
2. Add visible labeling on all AI-generated content (suggestions, analyses)
3. Document the AI system's intended purpose, capabilities, and limitations
4. Implement human oversight mechanisms (review before implementation)
5. Conduct AI risk assessment for all AI features
6. If any feature is classified as high-risk: implement conformity assessment, register in EU database, maintain technical documentation, implement risk management system
7. For Gemba Vision: if it processes employee images, this likely falls under HIGH RISK workplace AI and requires full conformity assessment

### 4.2 AI Decision Documentation

**Status: RED -- Insufficient**

**Findings:**
- `AIKaizenSuggestion` stores `confidence` and `data_snapshot` -- this is a good start
- However, no explanation of WHY the AI made specific recommendations is stored
- No versioning of the AI model used for each decision
- The `SYSTEM_PROMPT` is hardcoded with no version tracking

**Required Actions:**
1. Log the AI model version, prompt version, and input data hash for every AI interaction
2. Store AI reasoning/explanation alongside suggestions
3. Implement explainability features (why did the AI suggest this?)
4. Version control system prompts with change tracking

### 4.3 Human Oversight

**Status: AMBER -- Partial**

**Findings:**
- Kaizen suggestions have a status workflow (pending -> accepted/rejected -> implemented) suggesting human review
- But there is no mandatory human review step before AI recommendations are shown to end users
- Root cause analysis results are returned directly to the user without review
- No mechanism to flag potentially harmful AI recommendations

**Required Actions:**
1. Implement mandatory human review for AI suggestions that could affect employees
2. Add "AI-generated" badges on all AI content visible to users
3. Create an AI oversight dashboard for managers to review AI outputs
4. Implement feedback mechanism for AI accuracy reporting

---

## 5. MANUFACTURING-SPECIFIC DATA PROTECTION

### 5.1 Employee Monitoring Regulations

**Status: RED -- Critical gap**

**Findings:**
LeanPilot collects extensive data attributable to individual employees:
- `ProductionRecord.recorded_by_id` -- who logged production data
- `DowntimeEvent.recorded_by_id` -- who reported downtime
- `ScrapRecord.recorded_by_id` -- who reported scrap (could imply fault)
- `CILTExecution.operator_id` -- who performed maintenance checks
- `TPMMaintenanceRecord.performed_by_id` -- maintenance performer
- `GembaWalk.walker_id` -- who conducted the walk
- `AndonEvent.triggered_by_id` -- who triggered the alert
- `SixSAudit.auditor_id` -- who conducted the audit
- `HourlyProduction` (tracked per line/shift) -- attributable when combined with shift schedules
- `AIConversation.user_id` -- all AI chat interactions per user

This data, in aggregate, constitutes **systematic employee monitoring** and creates detailed **individual performance profiles**.

**Legal Implications:**
- **Italy (Art. 4 Statuto dei Lavoratori / L. 300/1970):** Remote worker monitoring tools require trade union agreement or labor inspectorate authorization. LeanPilot likely qualifies as a "remote monitoring tool" under Italian labor law.
- **Germany (BetrVG Section 87):** Works council co-determination rights for employee monitoring systems. Cannot deploy without works council agreement.
- **France (Code du Travail):** CNIL guidelines require employee information, proportionality assessment, and works council consultation.
- **Serbia (Zakon o radu):** Employee data processing must be proportionate and employees must be informed.

**Required Actions:**
1. Create an Employee Privacy Notice specifically for factory workers using the system
2. Implement role-based data visibility (operators should NOT see each other's performance data)
3. Add anonymization option for aggregate reports (show team/line performance without individual attribution)
4. Document the business necessity for each `recorded_by_id` / performer tracking field
5. Build a works council consultation package for German/French customers
6. For Italy: prepare documentation for labor inspectorate (Ispettorato del Lavoro) authorization application
7. Add configuration option to disable individual attribution (customer choice based on local law)

### 5.2 OEE/Productivity Data as Employee Performance Data

**Status: RED -- Not addressed**

**Critical Issue:** OEE data (availability, performance, quality percentages) when linked to specific shifts and operators constitutes employee performance data. Under GDPR, this is standard personal data, but under national labor laws it often has heightened protection.

When OEE data per line is combined with shift schedules and `recorded_by_id` fields, it creates de facto individual performance metrics. The AI module then analyzes this data and generates suggestions that could indirectly evaluate employee performance.

**Required Actions:**
1. Implement data separation between "machine performance data" and "individual worker data"
2. Allow customers to configure whether individual attribution is enabled
3. When AI analyzes data, strip individual identifiers before processing
4. Ensure OEE dashboards show machine/line data, not individual operator scores (unless explicitly enabled with appropriate safeguards)

### 5.3 Equipment Data vs. Personal Data Boundaries

The following data categories in the codebase are NOT personal data and can be processed with fewer restrictions:
- Machine OEE metrics (when not linked to individuals)
- Equipment maintenance schedules
- Production line configurations
- SMED step definitions (process data)
- VSM maps (process flow data)

The following BECOME personal data when linked to individuals:
- Production records with `recorded_by_id`
- Maintenance records with `performed_by_id`
- Downtime events with `recorded_by_id`
- Any data processed by the AI Copilot in context of a specific user's conversation

---

## 6. TECHNICAL IMPLEMENTATION REVIEW

### 6.1 Password Storage

**Status: GREEN -- Adequate**

**Finding:** Passwords are hashed using bcrypt via `passlib.context.CryptContext` (`backend/app/core/security.py` line 11). This is industry-standard and appropriate.

**Note:** No password strength requirements are enforced at registration (`backend/app/schemas/auth.py` -- `UserCreate.password` is just `str` with no validation).

**Required Actions:**
1. Add password minimum length (12+ characters recommended)
2. Add password complexity requirements
3. Implement password breach checking (HaveIBeenPwned API)
4. Add account lockout after failed attempts

### 6.2 JWT Implementation

**Status: AMBER -- Improvements needed**

**Findings:**
- Algorithm: HS256 (symmetric) -- adequate but HS256 with a weak secret is vulnerable
- Secret key default: `"change-me-in-production"` (`backend/app/core/config.py` line 14) -- CRITICAL if deployed with default
- Token expiry: 480 minutes (8 hours) (`config.py` line 16) -- reasonable for work shift but long
- No refresh token mechanism -- user must re-authenticate after 8 hours
- No token revocation/blacklist mechanism -- cannot invalidate tokens on logout
- JWT payload contains only `sub` (user ID) and `exp` -- no additional claims for RBAC

**Required Actions:**
1. Enforce secret key change from default (startup check)
2. Implement refresh token rotation
3. Add token blacklist (Redis-backed) for logout/revocation
4. Consider RS256 (asymmetric) for production
5. Reduce access token lifetime to 15-30 minutes with refresh tokens
6. Add RBAC claims to token payload

### 6.3 Data Encryption at Rest

**Status: RED -- Not implemented**

**Findings:**
- PostgreSQL stores all data in plaintext
- No field-level encryption for PII (email, full_name)
- No database-level encryption configured in docker-compose
- AI conversation content (potentially containing sensitive factory data) stored in plaintext

**Required Actions:**
1. Enable PostgreSQL Transparent Data Encryption (TDE) or use encrypted volumes
2. Implement field-level encryption for PII fields (email, full_name)
3. Encrypt AI conversation content at rest
4. Use encrypted connections to PostgreSQL (SSL/TLS)

### 6.4 Data Encryption in Transit

**Status: AMBER -- Partially configured**

**Findings:**
- No TLS/HTTPS configuration visible in the codebase
- `docker-compose.yml` exposes ports directly without TLS termination
- API calls from frontend to backend use HTTP proxy (Next.js rewrites)
- OpenAI API calls use HTTPS (inherent in the `openai` Python library)

**Required Actions:**
1. Configure TLS termination (nginx/traefik reverse proxy)
2. Enforce HTTPS-only with HSTS headers
3. Configure PostgreSQL SSL connections
4. Add TLS to Redis connection

### 6.5 Session Management

**Status: AMBER -- Basic but functional**

**Findings:**
- JWT stored in localStorage (vulnerable to XSS) -- see `frontend/src/hooks/useAuth.ts` line 33
- No HttpOnly cookie option for token storage
- Logout only removes client-side token, does not invalidate server-side (`useAuth.ts` line 39)
- No session timeout warning
- No concurrent session management

**Required Actions:**
1. Move JWT to HttpOnly, Secure, SameSite=Strict cookie
2. Implement server-side session invalidation on logout
3. Add concurrent session limits
4. Add session timeout warnings

### 6.6 Logging of Personal Data

**Status: RED -- No logging controls**

**Findings:**
- SQLAlchemy debug mode (`echo=settings.debug` in `backend/app/db/session.py` line 6) will log all SQL queries including personal data when debug=True
- No structured logging configuration
- No PII masking in logs
- No log retention policy
- No audit trail for data access

**Required Actions:**
1. Implement structured logging with PII masking
2. Never log passwords, tokens, or full personal data in plaintext
3. Set log retention periods (90 days recommended)
4. Implement audit logging for all CRUD operations on personal data
5. Disable SQL echo in production

### 6.7 Data Retention Policies

**Status: RED -- No retention policies**

**Findings:**
- No data retention configuration anywhere in the codebase
- No automatic data purging or archiving
- `TimestampMixin` tracks `created_at` and `updated_at` but no `expires_at` or retention logic
- AI conversation history is retained indefinitely
- Production records are retained indefinitely

**Required Actions:**
1. Define retention periods per data category:
   - User accounts: Duration of service + legal retention period
   - Production records: 2-5 years (depending on industry/tax requirements)
   - AI conversations: 90 days (or until user deletes)
   - AI suggestions: 1 year
   - Audit logs: 1 year minimum
   - Scrap/downtime records: 2-5 years
2. Implement automated data purging scheduled jobs
3. Document retention periods in privacy policy

### 6.8 Cookie and Local Storage Usage

**Status: RED -- Undeclared storage**

**Identified storage items:**

| Storage Item | Type | Purpose | Strictly Necessary? |
|---|---|---|---|
| `leanpilot_token` | localStorage | Authentication JWT | Arguable (functional) |
| `leanpilot_locale` | localStorage | Language preference | No (preference) |
| Theme preference | localStorage (via `useTheme` store) | Dark/light mode | No (preference) |

**Required Actions:**
1. Classify each storage item by necessity
2. Implement consent for non-essential storage
3. Document in cookie policy

### 6.9 CORS Configuration

**Status: AMBER -- Development only**

**Finding:** CORS allows only `localhost:3000` and `localhost:3001` with wildcard methods and headers (`backend/app/main.py` lines 18-23). This is acceptable for development but must be properly configured for production.

**Required Actions:**
1. Configure allowed origins for production domains only
2. Restrict allowed methods and headers to those actually needed
3. Set appropriate `Access-Control-Max-Age`

### 6.10 API Security

**Status: AMBER -- Basic authentication, lacks authorization**

**Findings:**
- All endpoints require authentication (good)
- No rate limiting on login endpoint (brute force vulnerability)
- No input validation beyond Pydantic schemas (good for type checking)
- No CSRF protection (mitigated by JWT in header, but move to cookies changes this)
- Open user registration (`/auth/register`) with no invitation or approval flow
- No API versioning strategy for deprecation

**Required Actions:**
1. Add rate limiting (especially on auth endpoints)
2. Implement invitation-based registration or admin approval
3. Add CSRF protection if moving to cookie-based auth
4. Implement proper authorization (users should only access their factory's data)

---

## 7. REQUIRED DOCUMENTS

All documents listed below must be created before production deployment. Priority: CRITICAL.

### 7.1 Privacy Policy (Multi-Language)

**Languages needed:** English, Italian, Serbian (minimum)
**Must include:** Identity of controller, DPO contact, purposes and legal bases, data categories, retention periods, data subject rights, international transfers, automated decision-making disclosure, complaint rights

**Outline:**
1. Who We Are (controller identity, DPO contact)
2. What Data We Collect (account data, production data, AI interaction data, device/usage data)
3. Why We Process Your Data (purposes and legal bases per processing activity)
4. How Long We Keep Your Data (retention periods per category)
5. Who We Share Your Data With (sub-processors, international transfers)
6. Your Rights (access, rectification, erasure, portability, restriction, objection)
7. Automated Decision-Making and AI (explanation of AI features, human oversight, right to contest)
8. International Data Transfers (SCCs, adequacy decisions, DPF)
9. Cookies and Similar Technologies (link to cookie policy)
10. Changes to This Policy (notification mechanism)
11. How to Contact Us / Complaints

### 7.2 Cookie Policy

1. What are cookies/local storage
2. Categories used (strictly necessary, functional, analytics, marketing)
3. Specific items used and their purpose
4. How to manage preferences
5. Third-party cookies (if any)

### 7.3 Terms of Service

1. Service description
2. Account responsibilities
3. Acceptable use
4. Intellectual property (customer data ownership)
5. Data processing (reference DPA)
6. Service availability and SLAs
7. Limitation of liability
8. Termination and data return
9. Governing law and jurisdiction
10. AI features disclaimer and limitations

### 7.4 Data Processing Agreement (DPA)

Required for B2B customers (the factory is the controller, LeanPilot is the processor).

1. Subject matter and duration of processing
2. Nature and purpose of processing
3. Types of personal data
4. Categories of data subjects (factory employees)
5. Obligations of the processor (security measures, sub-processor management, breach notification, DPO, audits)
6. Obligations of the controller
7. Sub-processor engagement rules
8. International transfers
9. Data return and deletion upon termination
10. Annex: Technical and Organizational Measures (TOMs)
11. Annex: Sub-processor list
12. Annex: Data processing details per service

### 7.5 Sub-Processor List

Current known sub-processors:
| Sub-processor | Purpose | Location | Safeguards |
|---|---|---|---|
| OpenAI | AI Copilot, Root Cause AI, Auto Kaizen | USA | DPA + EU-US DPF / SCCs |
| Cloud hosting provider (TBD) | Infrastructure | TBD (recommend EU) | DPA |
| Redis provider (if managed) | Caching | TBD | DPA |
| Email service (TBD) | Transactional emails | TBD | DPA |

### 7.6 Records of Processing Activities (ROPA)

Must document (Art. 30 GDPR):

| Processing Activity | Purpose | Legal Basis | Data Categories | Data Subjects | Recipients | Retention | Transfers |
|---|---|---|---|---|---|---|---|
| User account management | Service provision | Art. 6(1)(b) Contract | Email, name, role, language | Factory employees | Hosting provider | Duration of service + 90 days | Within EU (recommended) |
| Production data logging | Core service | Art. 6(1)(b) Contract + Art. 6(1)(f) Legitimate Interest | Production metrics, timestamps, operator ID | Factory workers | Hosting provider | Per customer retention policy | Within EU |
| OEE calculation & dashboards | Core service analytics | Art. 6(1)(b) Contract | Aggregated production metrics | Factory workers (indirectly) | Hosting provider | Same as production data | Within EU |
| AI Copilot conversations | AI-assisted analysis | Art. 6(1)(a) Consent | Chat messages, factory data context | Users interacting with AI | OpenAI (sub-processor) | 90 days recommended | EU to US (OpenAI) |
| AI root cause analysis | Automated analysis | Art. 6(1)(a) Consent | Production/downtime/scrap data | Factory workers (indirectly) | OpenAI (sub-processor) | 1 year | EU to US (OpenAI) |
| Auto Kaizen suggestions | Proactive improvement | Art. 6(1)(f) Legitimate Interest | Aggregated factory metrics | N/A (non-personal if anonymized) | OpenAI (sub-processor) | 1 year | EU to US (OpenAI) |
| Employee activity tracking | Audit trail | Art. 6(1)(f) Legitimate Interest | Who did what, when | Factory workers | Hosting provider | Per legal requirements | Within EU |
| Gemba walk observations | Quality management | Art. 6(1)(b) Contract | Observations, photos, locations | Factory workers | Hosting provider | 2 years | Within EU |
| CILT execution tracking | Maintenance compliance | Art. 6(1)(b) Contract | Check results, operator, timing | Maintenance operators | Hosting provider | 2 years | Within EU |

### 7.7 DPIA for AI Features

Must include:
1. Systematic description of processing operations
2. Assessment of necessity and proportionality
3. Assessment of risks to data subjects
4. Measures to address risks
5. Monitoring and review plan

Key risks to assess:
- AI analyzing employee-linked production data
- Factory data transferred to US-based OpenAI
- Potential for AI recommendations to discriminate against workers
- Accuracy and fairness of AI-generated suggestions
- Risk of data leakage through AI model

### 7.8 Data Retention Policy

Internal document defining retention periods for each data category, legal basis for retention, and deletion procedures.

### 7.9 Breach Response Plan

1. Detection and identification procedures
2. Containment measures
3. Assessment of severity and risk
4. 72-hour supervisory authority notification procedure
5. Data subject notification procedure (when high risk)
6. Documentation requirements
7. Post-incident review
8. Contact details for DPO and breach response team

### 7.10 Employee Privacy Notice

Separate from the general privacy policy. Specifically for factory workers whose data is processed through LeanPilot. Must be available in local languages and explain:
1. What data is collected about them through LeanPilot
2. How their production/performance data is used
3. Whether AI analyzes their data
4. Their rights regarding the data
5. Who to contact for data access/deletion requests
6. Whether data is used for performance evaluation

---

## 8. PRIORITY ACTION ITEMS

### CRITICAL (Must resolve before ANY production deployment)

| # | Action | Effort | Owner |
|---|--------|--------|-------|
| C1 | Create and publish Privacy Policy (EN, IT) | 2-3 weeks | Legal + DPO |
| C2 | Implement consent management at registration | 1 week | Backend dev |
| C3 | Fix multi-tenant data isolation (factory-scoped queries) | 1-2 weeks | Backend dev |
| C4 | Implement data subject rights endpoints (access, export, delete) | 2-3 weeks | Backend dev |
| C5 | Create Data Processing Agreement (DPA) template | 2 weeks | Legal |
| C6 | Execute DPA with OpenAI | 1 week | Legal |
| C7 | Conduct DPIA for AI features | 2-3 weeks | DPO |
| C8 | Enforce secret key change from default | 1 day | Backend dev |
| C9 | Configure HTTPS/TLS for production | 1 week | DevOps |
| C10 | Create Terms of Service | 2 weeks | Legal |
| C11 | Create ROPA | 1-2 weeks | DPO |
| C12 | Anonymize employee data before sending to OpenAI | 1 week | Backend dev |
| C13 | Add AI transparency labels to all AI-generated content | 3 days | Frontend dev |

### HIGH (Must resolve within 3 months of deployment)

| # | Action | Effort | Owner |
|---|--------|--------|-------|
| H1 | Implement cookie/storage consent banner | 1 week | Frontend dev |
| H2 | Move JWT to HttpOnly cookies | 1 week | Full stack |
| H3 | Add rate limiting to auth endpoints | 2 days | Backend dev |
| H4 | Implement token revocation on logout | 3 days | Backend dev |
| H5 | Add password strength requirements | 1 day | Backend dev |
| H6 | Enable database encryption (TDE or volume encryption) | 1 week | DevOps |
| H7 | Implement audit logging for data access | 2 weeks | Backend dev |
| H8 | Create Employee Privacy Notice template | 1 week | Legal + DPO |
| H9 | Implement data retention automation | 2 weeks | Backend dev |
| H10 | Create Breach Response Plan | 1 week | DPO + Legal |
| H11 | Add RBAC middleware | 2 weeks | Backend dev |
| H12 | Create sub-processor list and change notification mechanism | 3 days | DPO |
| H13 | Add Serbian language support for privacy documents | 1 week | Translation |

### MEDIUM (Must resolve within 6 months)

| # | Action | Effort | Owner |
|---|--------|--------|-------|
| M1 | Implement structured logging with PII masking | 1 week | Backend dev |
| M2 | Add AI decision documentation (model version, prompt version logging) | 1 week | Backend dev |
| M3 | Create works council consultation package (DE, FR markets) | 2 weeks | Legal |
| M4 | Implement data anonymization options for reporting | 2 weeks | Full stack |
| M5 | Add user-facing privacy settings page | 1 week | Frontend dev |
| M6 | Implement refresh token rotation | 1 week | Full stack |
| M7 | Add photo content policy for Gemba/6S features | 3 days | DPO |
| M8 | Create Cookie Policy | 3 days | Legal |
| M9 | Conduct AI risk assessment under EU AI Act | 2 weeks | DPO + Legal |
| M10 | Minimize AI data_context storage (store references not full data) | 1 week | Backend dev |

### LOW (Ongoing / Nice to have)

| # | Action | Effort | Owner |
|---|--------|--------|-------|
| L1 | Implement field-level encryption for PII | 2 weeks | Backend dev |
| L2 | Add CalOPPA compliance if US expansion | 1 week | Legal |
| L3 | Add LGPD compliance if Brazil expansion | 2 weeks | Legal |
| L4 | Implement UK GDPR compliance if UK expansion | 1 week | Legal |
| L5 | Add concurrent session management | 3 days | Backend dev |
| L6 | Implement password breach checking (HIBP) | 2 days | Backend dev |
| L7 | Regular penetration testing schedule | Ongoing | Security |

---

## 9. RECOMMENDED COMPLIANCE TIMELINE

### Phase 1: Pre-Launch (Weeks 1-6) -- CRITICAL items

**Week 1-2:**
- C8: Enforce secret key change
- C9: Configure HTTPS/TLS
- C3: Fix multi-tenant data isolation
- Begin drafting Privacy Policy (C1) and ToS (C10)

**Week 3-4:**
- C2: Implement consent management
- C4: Implement data subject rights endpoints
- C12: Anonymize employee data for AI
- C13: AI transparency labels

**Week 5-6:**
- C1: Finalize and publish Privacy Policy
- C5: Finalize DPA template
- C6: Execute OpenAI DPA
- C7: Begin DPIA for AI features
- C10: Finalize ToS
- C11: Create ROPA

### Phase 2: Post-Launch Hardening (Weeks 7-18) -- HIGH items

**Week 7-10:**
- H1: Cookie consent banner
- H2: Move JWT to HttpOnly cookies
- H3: Rate limiting
- H4: Token revocation
- H5: Password strength
- H11: RBAC middleware

**Week 11-14:**
- H6: Database encryption
- H7: Audit logging
- H9: Data retention automation
- H10: Breach Response Plan

**Week 15-18:**
- H8: Employee Privacy Notice
- H12: Sub-processor list
- H13: Serbian language privacy docs

### Phase 3: Maturity (Weeks 19-30) -- MEDIUM items
- All M-priority items

### Phase 4: Ongoing -- LOW items and continuous improvement
- All L-priority items
- Annual DPIA review
- Quarterly sub-processor review
- Annual privacy policy update
- Regular staff training

---

## 10. ADDITIONAL RECOMMENDATIONS

### 10.1 Appoint a DPO

Given the nature of processing (employee monitoring at scale, AI-based profiling), LeanPilot should appoint a Data Protection Officer (Art. 37 GDPR). This can be internal or external. The DPO should be involved in all product decisions that affect personal data processing.

### 10.2 Privacy Training

All development team members should receive GDPR awareness training. Product managers should understand Privacy by Design principles.

### 10.3 Select EU-Based Hosting

To minimize cross-border transfer complexity, host all infrastructure within the EU/EEA. Recommended: EU regions of AWS (Frankfurt, Ireland), GCP (Belgium, Netherlands), or Azure (Netherlands, France).

### 10.4 Implement Privacy by Default

For new features, the most privacy-protective settings should be the default. For example:
- Individual worker attribution should be OPT-IN, not default
- AI features should require explicit activation by the factory administrator
- Data retention should default to minimum periods

### 10.5 Vendor Due Diligence

Before engaging any new sub-processor, conduct a data protection due diligence review. Document the assessment and maintain records.

---

## APPENDIX A: DATA FLOW DIAGRAM (Textual)

```
Factory Workers (Data Subjects)
    |
    v
[LeanPilot Frontend] -- localStorage (token, locale, theme)
    |
    v (HTTPS - must be configured)
[LeanPilot Backend API] -- JWT Authentication
    |
    +--> [PostgreSQL Database] -- User data, production data, AI conversations
    |       (should be EU-hosted, encrypted)
    |
    +--> [Redis Cache] -- Session/cache data
    |       (should be EU-hosted)
    |
    +--> [OpenAI API] -- Factory data for AI analysis (US-based)
            (requires DPA + SCCs/DPF)
            (data should be anonymized before transfer)
```

---

## APPENDIX B: PERSONAL DATA INVENTORY

| Data Element | Model/Table | Personal Data? | Sensitive? | Retention |
|---|---|---|---|---|
| Email address | users.email | Yes | No | Service duration + 90 days |
| Full name | users.full_name | Yes | No | Service duration + 90 days |
| Password hash | users.hashed_password | Yes (derived) | Yes (credential) | Service duration |
| User role | users.role | Yes | No | Service duration |
| Language preference | users.language | Yes (behavioral) | No | Service duration |
| Production records (with recorded_by_id) | production_records | Yes (indirect) | Potentially (performance) | 2-5 years |
| Downtime events (with recorded_by_id) | downtime_events | Yes (indirect) | Potentially | 2-5 years |
| Scrap records (with recorded_by_id) | scrap_records | Yes (indirect) | Potentially (blame) | 2-5 years |
| AI chat messages | ai_messages.content | Yes | Potentially | 90 days |
| AI data context | ai_messages.data_context | Potentially | No | 90 days |
| Kaizen items (created_by, assigned_to) | kaizen_items | Yes (indirect) | No | 2 years |
| CILT execution (operator_id) | cilt_executions | Yes (indirect) | No | 2 years |
| Maintenance records (performed_by_id) | tpm_maintenance_records | Yes (indirect) | No | 2 years |
| Gemba observations (photos) | gemba_observations.photo_url | Potentially (if people visible) | Potentially | 2 years |
| 6S audit photos | six_s_audits.photo_urls | Potentially (if people visible) | Potentially | 2 years |
| Andon events (triggered_by_id) | andon_events | Yes (indirect) | No | 1 year |
| 5 Why analysis (created_by_id) | five_why_analyses | Yes (indirect) | No | 2 years |
| Ishikawa analysis (created_by_id) | ishikawa_analyses | Yes (indirect) | No | 2 years |
| A3 reports (created_by, sponsor) | a3_reports | Yes (indirect) | No | 2 years |
| Gemba walks (walker_id) | gemba_walks | Yes (indirect) | No | 2 years |

---

## APPENDIX C: REGULATORY REFERENCE TABLE

| Regulation | Jurisdiction | Effective | Key Requirements for LeanPilot |
|---|---|---|---|
| GDPR (EU 2016/679) | EU/EEA | 25 May 2018 | Full compliance required for EU market |
| ePrivacy Directive (2002/58/EC) | EU/EEA | Ongoing | Cookie/storage consent |
| EU AI Act (2024/1689) | EU/EEA | Phasing in 2024-2027 | AI transparency, risk classification |
| ZZLP (Serbia) | Serbia | 21 Aug 2019 | GDPR-aligned; local DPO, Poverenik registration |
| Statuto dei Lavoratori (Italy) | Italy | 1970 (amended) | Art. 4: worker monitoring restrictions |
| D.Lgs. 196/2003 + 101/2018 (Italy) | Italy | 2018 | Italian GDPR implementation, Garante authority |
| BetrVG (Germany) | Germany | Ongoing | Sec. 87: works council co-determination |
| UK GDPR + DPA 2018 | UK | 1 Jan 2021 | Post-Brexit UK data protection |
| LGPD (Brazil) | Brazil | 18 Sep 2020 | If expanding to Brazil |
| CalOPPA (USA - California) | California, USA | 2004 | If serving California users |
| EU-US DPF | EU-US | 10 Jul 2023 | Framework for US transfers (OpenAI) |

---

**END OF REPORT**

*This report should be reviewed by qualified legal counsel before implementing recommendations. Data protection law is complex and jurisdiction-specific. This technical audit identifies issues and provides guidance but does not constitute legal advice.*

*Next review scheduled: Before production deployment or within 6 months, whichever is sooner.*
