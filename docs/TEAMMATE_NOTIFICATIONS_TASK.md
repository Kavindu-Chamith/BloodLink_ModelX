# Teammate task: notification search and unread filtering

Status: ready to develop; the new features are not implemented in this baseline.

## Goal and scope

Help a donor find a notification quickly and focus on unread messages. Add
search, an `Unread only` toggle, and a clear-filters action to the existing
mobile Notifications screen. This is a small, independent React Native and
TypeScript feature using the existing notification data and theme.

The current screen already supports category chips, opening notification
actions, individual read state, mark-all-read, refresh, and loading/error states.
Keep these behaviors. The notification service currently uses in-memory mock
data, so this task does not require a database, new API endpoints, new packages,
push notification integration, or persistent preferences.

## Files to change or create

| Path relative to project root | Intended work |
| --- | --- |
| `mobile-app/src/notifications/screens/NotificationsScreen.tsx` | Search field, unread toggle, clear action, derived list/counts, empty-state message |
| `mobile-app/src/notifications/utils/filterNotifications.ts` (new) | Pure, typed filtering helper |
| `mobile-app/tests/notifications.test.cjs` (new) | Focused filtering tests |
| `mobile-app/package.json` | Add `test:notifications` running `node --test tests/notifications.test.cjs` |

Read the supplied types, hook, mock service, category configuration, and
FilterChips component for context. Existing `tests/requests.test.cjs` demonstrates
the project's Node test runner and TypeScript transpilation approach. Keep most
changes in the four paths above to minimize overlap with other teammates.

## Required behavior

1. Search title, optional subtitle, and optional body using a trimmed,
   case-insensitive substring. An empty or whitespace-only query matches all.
2. Combine the search, selected category, and unread-only flag with AND logic.
   Default to all categories, empty search, and unread-only off.
3. Provide an accessible search field and an accessible unread toggle with
   its current state. Follow the existing light/dark theme and screen spacing.
4. Keep category chips. Their counts reflect search and unread filters before
   applying the selected category, so each count shows that category's matches.
   The All count is the size of that candidate list.
5. Keep the header unread badge as the total unread count across all items.
   Keep Mark all read operating on ALL notifications, as it currently does.
6. Preserve service order and never mutate input items. Filtering must not
   mark notifications read. When an item becomes read while unread-only is
   enabled, it disappears. When mark-all-read succeeds, no unread items remain.
7. Keep search/filter state through refresh. For a filtered empty result, show
   `No matching notifications` and an action to clear search, unread, and
   category filters. Preserve the original empty message when there are no
   notifications and no active filters. Show a clear-filters action whenever
   any filter is active, including when there are matches.
8. Keep current loading, error, retry, notification actions, and pull-to-refresh
   behavior. Do not change the mock service to call nonexistent endpoints.

Suggested helper contract:

```typescript
filterNotifications(
  items: AppNotification[],
  options: {
    query: string;
    category: 'all' | NotificationCategory;
    unreadOnly: boolean;
  },
): AppNotification[]
```

For chip counts, derive candidates with category `all` and the active query
and unread flag. Derive the visible list using all three active filters.

## Checks to complete

Test matching in each searchable field, absent optional fields, case and
whitespace handling, category and unread filtering, all filters together,
no results, empty input, original order, and input immutability. Use fixed
fixtures so tests do not depend on the current clock or live services.

From `mobile-app`, after adding the new test script:

```powershell
npm.cmd run type-check
npm.cmd run test:notifications
npm.cmd run test:phone
npm.cmd run test:birth-date
npm.cmd run test:registration
npm.cmd run test:requests
npm.cmd start
```

The existing generic `npm test` is a placeholder; use the commands above.
In development, use the floating Screens navigator and select Notifications.
Manually check category + search + unread combinations, mark-read updates,
mark-all-read, refresh retaining filters, clear filters, empty results, keyboard
use, small screens, and both themes where the existing theme switch is available.
In the initial mock data, three notifications are unread: n-001, n-002, n-004.
Searching `screening` with category Doctor Reports and unread-only on should
show only n-002. Searching `unmatched-example` should show the filtered empty
state. No backend changes or credentials are needed for these mock checks.

## Handoff and commits

The ZIP's `reference-files/` folder contains UNCHANGED baseline files, with
their project-relative paths preserved. They are context, not a finished feature.
Work in the complete project/new repository rather than running that folder
alone. Once the repository owner has created the baseline commit and granted
access, update your checkout and create a branch:

```powershell
git switch -c feature/notification-search-unread
```

Implement the feature, complete the checks, review `git diff`, and stage only
the files you changed. For the suggested four-file implementation, from the
repository root:

```powershell
git add mobile-app/src/notifications/screens/NotificationsScreen.tsx mobile-app/src/notifications/utils/filterNotifications.ts mobile-app/tests/notifications.test.cjs mobile-app/package.json
git commit -m "feat(mobile): add notification search and unread filtering"
```

Commit using your own configured Git identity. Push your branch to the NEW
repository and open a pull request with a short description, test results,
and screenshots of the feature. Existing baseline files retain their original
attribution; the feature commit records your implementation and tests.
