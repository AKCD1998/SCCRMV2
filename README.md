# SCCRMV2 — SC CRM Member Registration

Vite + React SPA for registering new CRM members at SC pharmacy branches. Staff fills the form at the counter while the customer waits.

## Stack

- Vite 6 + React 19 (plain JSX, no routing library)
- Plain CSS with CSS custom properties — no UI framework
- Single API file: `src/api/crmMembers.js`

## Setup

```bash
cp .env.example .env
# edit .env:
#   VITE_API_BASE_URL=https://your-backend-url
#   VITE_STAFF_TOKEN=<jwt from POST /api/sccrm/auth/staff-device>
#   VITE_POS_API_KEY=<x-pos-api-key>

npm install
npm run dev
```

## Environment variables

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Backend base URL (no trailing slash) |
| `VITE_STAFF_TOKEN` | JWT for `Authorization: Bearer` header |
| `VITE_POS_API_KEY` | Value for `x-pos-api-key` header |

## API calls

| Call | Method | Endpoint |
|---|---|---|
| Register member | `POST` | `/api/crm/members` |
| Save health record (non-fatal) | `PUT` | `/api/crm/members/:id/health` |

The health-record call only fires when `consentPdpaHealth` is checked and health fields have data. If the endpoint doesn't exist yet, the registration still succeeds.

## Security rules

- Citizen ID (pidNumber) is never stored in localStorage
- Health data is never stored in localStorage
- No mock success — the UI does not show success unless the API returns 2xx
- Full citizen ID is never shown after submit

## Build

```bash
npm run build   # outputs to dist/
npm run preview # serves dist/ locally
```
