# Backend repair verification

Verified on 1 November 2026 using Node.js 24.14.0 and local PostgreSQL.

## Confirmed defects fixed

| Failure | Repair | Regression coverage |
| --- | --- | --- |
| Creating a request with blank optional reason or department returned HTTP 400. | Optional text accepts omitted, null and blank values while retaining type, length and content validation. | Blank forms succeed; malformed and oversized values are rejected. |
| A donor's accepted mission disappeared when its institution was suspended, but still blocked acceptance of another request. | Acceptance closes obsolete accepted notifications for closed/unapproved requests or inactive/unapproved institutions, under the existing donor transaction lock. | Accept a mission, suspend its institution, then accept a request at an active institution. Existing concurrent-acceptance tests still pass. |
| A pending push job could send a closed notification. | Push target selection requires an open notification. | A closed notification's job becomes cancelled without calling the delivery function. |
| Verification uploads with a trailing slash failed before reaching the upload handler. | Multipart validation matches the route's case-insensitive, optional-trailing-slash behavior. | A real multipart upload with a trailing slash succeeds; ownership, content, size and duplicate-upload checks still pass. |

All four failures were reproduced with regression tests before applying their fixes.

## Verification results

- `npm run type-check`: passed.
- `npm test`: passed, including 223 authentication/security checks, 20 operational tests and 15 client tests.
- `npm run build`: passed.
- Compiled `dist/index.js` started on a temporary port against the configured database.
- HTTP smoke checks: health 200, unauthenticated donor profile 401, malformed JSON 400, unknown endpoint 404.
- Existing local API at `http://localhost:4000/api/health`: 200.

Database integration tests created and removed disposable databases. Existing application records were not used as test fixtures. Existing uncommitted changes were preserved. These repairs require no additional migration; the configured local database already has migrations through 008.

## External delivery limits

The local configuration uses console email delivery and has no enabled FCM push transport. Actual email inbox delivery and physical-device push delivery were not verified. Tests capture email delivery and inject a push sender; they verify the API and queue behavior without contacting those providers. See `LOCAL_TESTING_STATUS.md` for the broader feature and provider limitations.
