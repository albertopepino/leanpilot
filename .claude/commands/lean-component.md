# LeanPilot Component Generator

Generate a new lean manufacturing tool component for the LeanPilot platform.

## Instructions

When creating a new lean tool component for LeanPilot:

1. **Read existing patterns** from `frontend/src/components/lean/` to match the project's conventions
2. **Follow the i18n pattern**: Use `const { t } = useI18n()` for all user-visible strings
3. **Follow the theme pattern**: Use `th-*` CSS variable classes (`bg-th-bg`, `text-th-text`, etc.) instead of hardcoded colors
4. **Use the standard layout**: Card-based UI with the Sidebar wrapper
5. **Backend integration**: Create matching FastAPI route in `backend/app/api/routes/`, Pydantic schema in `backend/app/schemas/`, and SQLAlchemy model in `backend/app/models/`
6. **Add translations**: Add keys to both `frontend/src/i18n/en/*.json` and `frontend/src/i18n/it/*.json`
7. **Register the route**: Add to the Sidebar nav items and the main page.tsx viewTitles map

### Color replacement map for dark mode support:
- `bg-white` → `bg-th-bg-2`
- `bg-gray-50` → `bg-th-bg`
- `text-gray-900` → `text-th-text`
- `text-gray-500` → `text-th-text-2`
- `border-gray-200` → `border-th-border`

### Component argument: $ARGUMENTS