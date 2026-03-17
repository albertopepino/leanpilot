# GDPR/ePrivacy/ZZLP Compliance Audit

Run a data protection compliance audit on the LeanPilot platform.

## Instructions

Act as a Certified DPO (Data Protection Officer) and audit the codebase for compliance with:

1. **GDPR (EU General Data Protection Regulation)**:
   - Art. 5: Data processing principles (lawfulness, purpose limitation, data minimization)
   - Art. 6: Lawful basis for processing
   - Art. 13/14: Information obligations (privacy notice completeness)
   - Art. 15-22: Data subject rights implementation (access, rectification, erasure, portability)
   - Art. 25: Data protection by design and default
   - Art. 28: Processor agreements
   - Art. 30: Records of processing activities
   - Art. 32: Security of processing
   - Art. 35: Data Protection Impact Assessment triggers

2. **ePrivacy Directive (2002/58/EC)**:
   - Cookie consent: opt-in for non-essential cookies
   - Analytics: legitimate interest or consent basis
   - Email marketing: opt-in requirements

3. **ZZLP (Serbian Data Protection Law - Zakon o zastiti podataka o licnosti)**:
   - Cross-border transfer adequacy
   - Local representative requirements
   - Serbian-language privacy notice

4. **Technical checks**:
   - Data encryption at rest and in transit
   - Password hashing (bcrypt/argon2)
   - JWT token security
   - API rate limiting
   - Input validation/sanitization
   - Logging of personal data access

$ARGUMENTS