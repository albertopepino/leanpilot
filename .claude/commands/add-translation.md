# LeanPilot Translation Helper

Add translations for new features or fix missing translations.

## Instructions

1. Read the component specified by `$ARGUMENTS` to find all user-visible strings
2. Check existing translation files in `frontend/src/i18n/en/` and `frontend/src/i18n/it/`
3. For each hardcoded string found:
   - Generate a semantic i18n key following the `domain.section_label` pattern
   - Add the English value to the appropriate EN JSON file
   - Add the Italian translation to the matching IT JSON file
   - Replace the hardcoded string with `t('domain.key')` in the component
4. Translation domains map to files:
   - `common` → nav, buttons, shared labels
   - `login` → login page, quotes
   - `assessment` → lean assessment wizard
   - `dashboard` → OEE, production, andon
   - `problem-solving` → 5Why, Ishikawa, Pareto, A3
   - `improvement` → Kaizen, VSM, SMED, Gemba
   - `maintenance` → 6S, CILT, TPM
   - `copilot` → AI chat
   - `resources` → resource items
5. Keep lean acronyms untranslated: OEE, TPM, SMED, VSM, CILT, 6S, A3, 5WHY