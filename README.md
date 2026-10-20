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

npm install
npm run dev
```

## Environment variables

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Backend base URL (no trailing slash) |

The browser build accepts only the public API base URL. Never put staff tokens,
Sync keys, PINs, or other credentials in build-time variables. Remove any legacy
credential variables from the static site's Render environment.

Staff enter their approved device name and existing staff PIN at runtime. The
app calls `POST /api/sccrm/auth/staff-device` on the configured API and keeps the
returned opaque staff-device credential only in this tab's memory. Refreshing or
closing the page requires signing in again. Each tab has its own non-secret
device identifier held in memory so signing into one tab does not invalidate
another tab or reuse a physical POS device identity. Neither credentials nor
device identifiers are written to browser storage. The API's existing
device-name allowlist continues to apply.

The existing CRM API validates staff-device credentials server-side; no proxy or
Full Sync key is required. Retire the old publicly bundled staff token after the
replacement UI is live. Signing out clears the local session; it does not revoke
the server-side device record. Device revocation remains an administrator action.

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
- No shared Sync key or staff credential is bundled in browser assets
- No PIN, credential, registration payload, or health payload is logged

## Build

```bash
npm run build   # outputs to dist/
npm run preview # serves dist/ locally
```

Run `npm test` for synthetic session and member-flow tests. Production builds
require an HTTPS `VITE_API_BASE_URL` without credentials or query parameters.
