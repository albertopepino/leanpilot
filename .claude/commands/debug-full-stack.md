# LeanPilot Full-Stack Debugger

Run a comprehensive debug sweep across the entire LeanPilot codebase.

## Instructions

1. **Frontend checks** (`frontend/src/`):
   - Verify all imports resolve correctly
   - Check for missing `useI18n()` translations (hardcoded English strings)
   - Ensure all components use `th-*` theme classes, not hardcoded `bg-white`/`text-gray-900`
   - Validate TypeScript types — no `any` types without justification
   - Check for missing error boundaries and loading states
   - Verify all API calls use `NEXT_PUBLIC_API_URL` env var

2. **Backend checks** (`backend/app/`):
   - Verify all SQLAlchemy models have proper relationships
   - Check all FastAPI routes have proper auth dependencies (`get_current_user`)
   - Validate Pydantic schemas match model fields
   - Check for SQL injection vulnerabilities (raw queries)
   - Verify async/await patterns are consistent
   - Check CORS and security middleware configuration

3. **Integration checks**:
   - Verify frontend API calls match backend route signatures
   - Check request/response schema alignment
   - Validate authentication flow end-to-end
   - Verify environment variable usage

4. **Report format**: Create a structured report with severity levels (CRITICAL / WARNING / INFO)

$ARGUMENTS