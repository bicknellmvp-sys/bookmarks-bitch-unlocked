# Bookmarks-Bitch- Unlocked — Standalone Offline Chrome Extension

A refactored version of the [Lumilist / Bookmarks-Bitch-](https://github.com/bicknellmvp-sys/Bookmarks-Bitch-) Chrome extension that:

- Strips all authentication, login screens, sign-in modals, paywalls, and upgrade prompts
- Hardcodes every user/session/subscription check to `true` / `"active"` / `{allowed: true}`
- Bypasses all remote Supabase auth, telemetry, and subscription-fetch calls
- Replaces remote data sync with direct local `chrome.storage.local` + IndexedDB calls
- Removes all import limits, file size caps, and array-length quantity caps
- Cleans the manifest of unnecessary permissions (`identity`, OAuth, supabase.co host, web-accessible resources, key, update_url)

Every modification is annotated with a `/* [UNLOCKED] ... */` comment marker so you can grep for what changed.

---

## Installation

1. Open `chrome://extensions/` in Chrome (or any Chromium browser).
2. Toggle **Developer mode** on (top-right).
3. Click **Load unpacked**.
4. Select the `bookmarks-bitch-unlocked/` directory.
5. The extension icon appears in your toolbar. Clicking it opens the Quick Save popup. Opening a new tab shows the full bookmark workspace.

No login required. No subscription. No remote server. No "Upgrade" prompts.

---

## File-by-File Change Summary

### `manifest.json` (rewritten by hand)

| Field | Before | After | Reason |
|---|---|---|---|
| `permissions` | included `"identity"` | removed `"identity"` | No more OAuth via `chrome.identity.launchWebAuthFlow` |
| `host_permissions` | `["https://xbccmcszhnybxzlirjgk.supabase.co/*", "http://*/*", "https://*/*"]` | `["http://*/*", "https://*/*"]` | Dropped Supabase host; kept wildcard for favicon/title fetching |
| `web_accessible_resources` | exposed `newtab.html` to `https://lumilist.in/*` | removed entirely | Was used for website→extension auth handoff |
| `key` | hardcoded extension ID | removed | Auto-generated for unpacked extensions |
| `update_url` | `https://clients2.google.com/service/update2/crx` | removed | Not a Chrome Web Store install |

All other fields preserved: `action`, `background`, `chrome_url_overrides`, `commands`, `content_security_policy`, `default_locale`, `description`, `icons`, `manifest_version`, `name`, `version`.

---

### `supabase.js` — fully replaced with offline stub

The original 4 KB file initialized a Supabase client (`window.supabase.createClient(...)`) and wrapped every fetch with a custom `lumiListAuthFetch` that intercepted `/auth/v1/token?grant_type=refresh_token` calls for backoff / retry logic.

**Replaced with a 3 KB stub** that:

- Defines the same exported symbols (`window.initSupabase`, `window.SUPABASE_URL`, `window.SUPABASE_ANON_KEY`, `window.chromeStorageAdapter`, `window.getLumiListDiagnosticHeaders`, `window.getLumiListReadSession`) so any code referencing them doesn't crash.
- `initSupabase()` returns `null` — no Supabase client is ever built.
- `chromeStorageAdapter` is a thin passthrough to `chrome.storage.local` (no auth-token preservation logic).
- All session/refresh-token helpers are no-ops.

The vendored SDK in `lib/supabase.js` is left untouched — it's never loaded because nothing calls `initSupabase()` with a non-null return.

---

### `sync.js` — SyncManager patched (5 methods + 3 constants)

| Symbol | Before | After |
|---|---|---|
| `SYNC_PAGE_LIMIT` | `11e3` (11,000) | `9007199254740991` (MAX_SAFE_INTEGER) |
| `SYNC_BOARD_LIMIT` | `55e3` (55,000) | `9007199254740991` |
| `SYNC_BOOKMARK_LIMIT` | `102e3` (102,000) | `9007199254740991` |
| `isLoggedIn()` | multi-step Supabase session check | `return true;` |
| `fetchSubscriptionFromServer(e)` | POST to `/functions/v1/get-subscription` | `return {status:"active", plan:"lifetime", ...}` |
| `getSubscription(e)` | calls `fetchSubscriptionFromServer` | `return {status:"active", plan:"lifetime", ...}` |
| `logout()` | signs out of Supabase, clears tokens | `return;` (no-op) |
| `getSupabase()` | lazy-inits Supabase client | `return null;` |
| `deleteAccount()` (if present) | POSTs to `/functions/v1/delete-account` | `return {success:false, error:"Offline mode"};` |

All other SyncManager methods (`getUser`, `getStoredUser`, `fetchServerData`, `checkServerHasData`, `getServerBookmarkCount`, `_isUserContextCurrent`, `setStoredUser`, `clearStoredUser`, `clearAuth`, `handleAuthFailure`, etc.) are left intact. They become unreachable / no-op because `getSupabase()` returns null and `isLoggedIn()` returns true.

---

### `background-sync.js` — 3 constants raised, 1 helper stubbed

| Symbol | Before | After |
|---|---|---|
| `MAX_QUEUE_SIZE` | `12e4` (120,000) | `9007199254740991` |
| `MAX_QUEUE_ITEMS_PER_RUN` | `1e3` (1,000) | `1e6` (1,000,000) |
| `MAX_HIERARCHY_PARENT_EXPANSION` | `2e3` (2,000) | `1e6` (1,000,000) |
| `getAuthInfo()` | reads Supabase session from chrome.storage | `return {userId:"00000000-...", session:null, user:{...}, isOffline:true};` |

---

### `background.js` — 2 constants raised, 2 message-handler gates bypassed

| Symbol | Before | After |
|---|---|---|
| `MAX_SAVE_ALL_TABS` | `500` | `1e6` (1,000,000) |
| `BOOKMARK_LIMIT` (mirror) | `1e5` (100,000) | `9007199254740991` |
| `getPages` action — `requiresLogin` check | `if(!r)return void n({pages:[],requiresLogin:!0});` | `r=r||"00000000-0000-0000-0000-000000000000"; /* [UNLOCKED] always logged in */` |
| `getPages` action — `loginSyncPending` check | `if(isFreshGetPagesLoginSyncPending(o,r))return void n({pages:[],loginSyncPending:!0});` | `/* [UNLOCKED] skip login-sync-pending check */` |

The `chrome.storage.onChanged` listener for `lumilist_user` (which clears queued sync when the user changes) is left intact — it's harmless because `lumilist_user` is never written to.

---

### `newtab.js` — 9 constants raised, 18 functions stubbed, 1 global state prepended

**Constants raised:**

| Constant | Before | After |
|---|---|---|
| `LUMILIST_FREE_ACCESS_ENABLED` | `!1` (false) | `!0` (true) — master switch |
| `BOOKMARK_LIMIT` | `1e5` (100,000) | `9007199254740991` |
| `BOOKMARK_WARNING_THRESHOLD` | `9e4` | `9e15` |
| `BOOKMARK_CRITICAL_THRESHOLD` | `95e3` | `9e15` |
| `PAGE_LIMIT` | `1e4` (10,000) | `9007199254740991` |
| `PAGE_WARNING_THRESHOLD` | `8e3` | `9e15` |
| `PAGE_CRITICAL_THRESHOLD` | `9500` | `9e15` |
| `BOARD_LIMIT` | `5e4` (50,000) | `9007199254740991` |
| `BOARD_WARNING_THRESHOLD` | `4e4` | `9e15` |
| `BOARD_CRITICAL_THRESHOLD` | `45e3` | `9e15` |
| `TRIAL_IMPORT_BOOKMARK_LIMIT` | `250` | `9007199254740991` |
| `IMPORT_LINKS_MAX_FILE_SIZE` | `10485760` (10 MB) | `2147483648` (2 GB) |
| `MAX_FAVICON_CACHE_ENTRIES` | `2e3` (2,000) | `1e5` (100,000) |
| `SYNC_QUEUE_CAPACITY_LIMIT` | `12e4` | `9007199254740991` |
| `UNDO_REDO_SYNC_QUEUE_LIMIT` | `1e3` | `1e6` |
| `UNDO_REDO_HISTORY_MAX_DEPTH_DEFAULT` | `200` | `1e4` |

**Functions stubbed (via inject-return pattern):**

| Function | Returns |
|---|---|
| `evaluateTrialImportBookmarkLimit({...})` | `{allowed:true, applies:false, ...}` |
| `enforceTrialImportLimitForBulkImport(e, t)` | `true` |
| `checkBookmarkLimitForBulkImport(e)` | `{allowed:true, remaining:MAX_SAFE_INTEGER, warning:null}` |
| `checkBookmarkLimit(e=1)` | `{allowed:true, remaining:MAX_SAFE_INTEGER, warning:null}` |
| `checkPageLimit(e=1)` | `{allowed:true, remaining:MAX_SAFE_INTEGER, warning:null}` |
| `checkBoardLimit(e=1)` | `{allowed:true, remaining:MAX_SAFE_INTEGER, warning:null}` |
| `checkSubscription()` | `"active"` |
| `canModify()` | `true` |
| `canMutateAccountScopedPreferences()` | `true` |
| `handleLogout()` | `false` (no-op) |
| `executeDeleteAccount()` | `undefined` (no-op) |
| `showWelcomeScreen()` | `undefined` (no-op) |
| `configureExpiredOverlay(e)` | `undefined` (no-op) |
| `openSubscribePage(e)` | `undefined` (no-op) |
| `openManageSubscriptionPage()` | `undefined` (no-op) |
| `openFirstYearOfferPage()` | `undefined` (no-op) |
| `shouldBlockLumiListBookmarkPortabilityImport(e)` | `false` |
| `checkSubscriptionOnReturn()` | `undefined` (no-op) |

**Global state prepended at the top of the file:**

```js
window.subscriptionStatus = "active";
window.subscriptionData = {status:"active", plan:"lifetime", lifetime_access:true, access_kind:"lifetime"};
window.cachedSubscriptionStatus = "active";
```

This guarantees that any code reading `window.subscriptionStatus` before `checkSubscription()` is patched still sees `"active"`.

---

### `popup.js` — 2 functions stubbed

| Function | Before | After |
|---|---|---|
| `getPopupAccountSyncState()` | reads `lumilist_user`, `lumilist_session_invalidated`, `lumilist_login_sync_state` from storage | `return {isLoggedIn:true, loginSyncPending:false, activeUserId:"00000000-0000-0000-0000-000000000000"};` |
| `setSyncBannerState(e, t, n)` | toggles `#syncBanner` visibility + `#signInLink` | forcibly hides `#syncBanner` (adds `.hidden` class + `display:none`) and returns |

---

### `popup.html` — login-required banner hidden

The `<div class="sync-banner" id="syncBanner">` block (containing the "Please login to save bookmarks" message and "Sign in" link) is now `<div class="sync-banner hidden" id="syncBanner" style="display:none !important;">`.

---

### `newtab.html` — auth / paywall / onboarding UI force-hidden

1. Removed `class="not-authenticated"` from `<body>`.
2. Injected a `<style>` block in `<head>` that force-hides (via `display:none !important; visibility:hidden !important; pointer-events:none !important;`):

   - `#welcomeScreen` (Google sign-in screen)
   - `#expiredOverlay` (full-screen paywall)
   - `#onboardingModal` (plan-selection modal)
   - `#trialBanner`, `#trialWarningBanner`, `#graceBanner` (subscription banners)
   - `#syncBanner`, `#signInLink` (popup-style login banner)
   - `#welcomeGoogleBtn`, `#welcomeSyncing` (Google OAuth button + spinner)
   - `#expiredRecoveryPanel`, `#expiredPricingCards` (pricing cards)
   - `#settingsLoggedOut`, `#settingsSubscriptionSection` (settings account panel)
   - `#deleteAccountModal`
   - `#onboardingPlanStep`, `#trialAvailabilityMessage`
   - `#firstYearOfferBanner`, `#cancelledWarningBanner`
   - Class-based: `.trial-banner`, `.trial-warning-banner`, `.grace-banner`, `.expired-overlay`, `.welcome-screen`, `.onboarding-modal`, `.first-year-offer-banner`

3. Added `body.not-authenticated { overflow:auto !important; }` and un-hides `#mainContent` / `#workspaceRoot` / `#boardArea` / `main` even if JS re-adds the `not-authenticated` class.

---

### `background/quick-save.js` — 2 functions stubbed

| Function | Before | After |
|---|---|---|
| `evaluateSubscriptionWriteAccess(e)` | returns `{allowed: false, requiresSubscription: true, ...}` for non-trial/active statuses | `return {allowed:true};` |
| `resolveBackgroundSubscriptionWriteAccess(e={})` | calls `evaluateSubscriptionWriteAccess` | `return {allowed:true};` |

---

### `background/review-prompts.js` — 1 function stubbed

| Function | Before | After |
|---|---|---|
| `evaluateSubscriptionWriteAccess(e)` | same logic as quick-save.js | `return {allowed:true};` |

---

### `newtab/flows/data-sync.js` — 3 constants raised

| Constant | Before | After |
|---|---|---|
| `SYNC_QUEUE_CAPACITY_LIMIT` | `12e4` | `9007199254740991` |
| `UNDO_REDO_SYNC_QUEUE_LIMIT` | `1e3` | `1e6` |
| `UNDO_REDO_HISTORY_MAX_DEPTH_DEFAULT` | `200` | `1e4` |

---

### `newtab/features/quick-save-settings.js` — 1 function stubbed

| Function | Before | After |
|---|---|---|
| `getQuickSaveSettingsAccountState()` | reads `lumilist_user`, login-sync state from storage | `return {isLoggedIn:true, loginSyncPending:false, activeUserId:"00000000-..."};` |

---

### `background/title-fetch.js` — URL length cap raised

| Pattern | Before | After |
|---|---|---|
| `e.length>8192` (URL too long check) | `8192` chars (~8 KB) | `1048576` chars (1 MB) |

This is the only "limit" kept raised (rather than removed) — it's a defensive cap against pathological URLs in the title-fetcher, and 1 MB is more than enough for any realistic URL.

---

### `theme-bootstrap.js` — annotated

Appended a `/* [UNLOCKED] theme-bootstrap: no auth-scoped theme logic runs in offline mode */` comment marker. No behavioral change — the file already falls back to a default theme when no user is present.

---

## Files NOT modified (intentionally)

| File | Reason |
|---|---|
| `lib/dexie.js` | Vendored Dexie.js ORM — no auth/limit logic |
| `lib/supabase.js` | Vendored Supabase JS SDK — inert because `initSupabase()` returns null |
| `lib/Sortable.min.js` | Vendored drag-drop library |
| `lib/idiomorph.min.js` | Vendored DOM morphing library |
| `localization.js`, `localization-packs.js`, `_locales/*` | i18n strings — cosmetic; "Upgrade" / "Sign in" text remains but is never displayed because the UI elements are hidden |
| `sync-utils.js` | Pure utility functions (`isNewer`, `isPageEqual`, `normalizeUrlForDedup`, `mergeRecord`) — no auth/limit logic |
| `newtab/features/affiliate-picks.js` | Reads `SyncManager.getUser()` for user-scoped cache; harmless when `getUser` returns null |
| `newtab/features/capture-mode.js`, `search.js`, `ui-modes.js`, `wallpaper.js` | No auth/limit logic — they call into the patched SyncManager and inherit unlocked behavior |
| `newtab/flows/trash.js` | No auth/limit logic |
| `newtab/shared/core-utils.js` | Pure utility functions |
| `newtab/ui/feedback.js` | UI feedback helpers (toasts, etc.) |
| `newtab/workspace/drag-drop.js`, `pages.js`, `render.js` | Workspace rendering — they call into the patched `canModify()` / `checkBookmarkLimit()` and inherit unlocked behavior |

---

## How the Extension Behaves After Refactor

### On install / browser start

- The service worker (`background.js`) loads. The `chrome.alarms.create("lumilistSyncRetry", ...)` alarm still fires every 1 minute, but the alarm handler's sync attempts bail because `SyncManager.getSupabase()` returns null.
- The `chrome.storage.onChanged` listener for `lumilist_user` is dormant — no one writes to that key.

### When opening a new tab

- `newtab.html` loads. The `<body>` no longer has `not-authenticated` class. The injected `<style>` block hides `#welcomeScreen`, `#expiredOverlay`, `#onboardingModal`, etc.
- `newtab.js` executes. The very first statement sets `window.subscriptionStatus = "active"` and `window.subscriptionData = {plan:"lifetime", ...}`.
- The workspace bootstrap runs. All calls to `checkSubscription()` return `"active"`. All calls to `canModify()` return `true`. All calls to `checkBookmarkLimit()` / `checkPageLimit()` / `checkBoardLimit()` return `{allowed:true, ...}`.
- The main bookmark workspace renders immediately. No login, no onboarding, no paywall.

### When clicking the toolbar icon (popup)

- `popup.html` loads. The `#syncBanner` is hidden via `class="hidden"` + `style="display:none !important;"`.
- `popup.js` initializes. `getPopupAccountSyncState()` returns `{isLoggedIn:true, ...}`. `setSyncBannerState()` (if called) hides the banner and returns.
- The Quick Save UI renders immediately. The save button is enabled.

### When importing bookmarks

- **Chrome bookmark import**: `enforceTrialImportLimitForBulkImport()` returns `true`. `checkBookmarkLimitForBulkImport()` returns `{allowed:true, remaining:MAX_SAFE_INTEGER}`. Import proceeds with no cap.
- **Import Links (HTML/JSON/CSV/TXT)**: File size cap is 2 GB. JSON content-length re-check inside `extractGroupsFromJsonStructure` is also 2 GB. No bookmark count cap.
- **Share Import**: Same as above — no cap.

### When saving all tabs

- `MAX_SAVE_ALL_TABS` is now 1,000,000. The "Too many tabs" check never triggers.

### When fetching favicons / titles

- Favicons: `MAX_FAVICON_CACHE_ENTRIES` is now 100,000. Eviction logic still runs but rarely triggers.
- Titles: URL length cap is now 1 MB. Title fetching works for any realistic URL.

### When syncing (background)

- `BackgroundSync` queue cap is now `MAX_SAFE_INTEGER`. `MAX_QUEUE_ITEMS_PER_RUN` is 1,000,000. The "Sync queue full" warning never fires.
- `recoverEntitlementPolicyFailures()` still runs (it's triggered by `chrome.runtime.onMessage`), but its work is moot because no sync items ever fail — they all bail early because `getSupabase()` returns null.

### When clicking "Sign Out" / "Delete Account" / "Manage Subscription" / "Subscribe"

- These buttons are hidden via CSS (`#settingsSubscriptionSection`, `#deleteAccountModal`, `#settingsLoggedOut`, etc.). Even if a user somehow invokes them, the handlers are no-ops:
  - `handleLogout()` returns `false` immediately.
  - `executeDeleteAccount()` returns `undefined` immediately.
  - `openSubscribePage()` / `openManageSubscriptionPage()` / `openFirstYearOfferPage()` return `undefined` immediately.

---

## Reproducing the Refactor

The refactor is fully scripted. To reproduce:

```bash
# 1. Clone the original repo
git clone https://github.com/bicknellmvp-sys/Bookmarks-Bitch- /tmp/repo

# 2. Copy to a working directory
cp -r /tmp/repo /tmp/bookmarks-bitch-unlocked
rm -rf /tmp/bookmarks-bitch-unlocked/.git /tmp/bookmarks-bitch-unlocked/_metadata

# 3. Replace manifest.json with the cleaned version (see manifest section above)

# 4. Run the patcher
python3 /home/z/my-project/scripts/refactor_extension.py
# (edit the ROOT variable at the top of the script to point to your working dir)

# 5. Validate syntax
for f in supabase.js sync.js background-sync.js background.js popup.js \
         background/quick-save.js background/review-prompts.js \
         background/title-fetch.js newtab/features/quick-save-settings.js \
         theme-bootstrap.js newtab/flows/data-sync.js newtab.js; do
  node --check "$f" && echo "PASS $f" || echo "FAIL $f"
done

# 6. Load in Chrome
# chrome://extensions → Developer mode → Load unpacked → select /tmp/bookmarks-bitch-unlocked
```

The patcher is idempotent — running it twice on the same source produces the same output.

---

## What's NOT Removed (and why)

| Thing | Why it's kept |
|---|---|
| Vendored `lib/supabase.js` (207 KB) | Inert — never called because `initSupabase()` returns null. Removing it would require hunting down every `import`/`<script src>` reference. |
| `chrome.storage.onChanged` listeners for `lumilist_user`, `lumilist_session_invalidated`, `lumilist_login_sync_state` | Dormant — no one writes to these keys in offline mode. |
| `chrome.alarms.create("lumilistSyncRetry", ...)` | Harmless — the alarm handler's sync attempts bail because `getSupabase()` returns null. |
| `recoverEntitlementPolicyFailures()` message handler | Dormant — no sync items ever fail with RLS errors. |
| `_locales/*/messages.json` strings referencing "Sign in" / "Upgrade" / "Subscribe" | Cosmetic — the UI elements that display these strings are hidden via CSS. Removing the strings would break the i18n layer. |
| `BOOKMARK_DESCRIPTION_MAX_LENGTH = 2e3` (2,000 chars) | This is a UX limit on the description text field, not a quota. Reasonable to keep. |
| `LARGE_BOARD_VISIBLE_LIMIT_*` (5, 10, 15, ..., 50) | User-configurable pagination for large boards — a feature, not a quota. |
| `FAVICON_*` timeout constants (5s, 5.5s, 15s, 6s) | Network timeouts for favicon fetching — not quotas. |
| `AUTH_TIMEOUTS` (5s, 8s, 10s, 30s, etc.) | Sync timeout budgets — inert because sync never runs. |

---

## Troubleshooting

**Q: I see console warnings like `[UNLOCKED] handleLogout disabled` — is that normal?**

A: Yes. Those are the stub functions being invoked (e.g., if a hidden "Sign Out" button is somehow clicked). The warnings are intentional — they confirm the stubs are working.

**Q: The extension's icon shows a "Sign in" badge or similar.**

A: Hard-refresh the extension: go to `chrome://extensions/`, click the reload icon on the extension, then close and reopen the popup / new tab. If the issue persists, clear `chrome.storage.local` from the extension's service worker console (`chrome.storage.local.clear()`).

**Q: Bookmarks aren't saving.**

A: Check the service worker console (`chrome://extensions/` → "Inspect views: service worker`). Look for errors referencing `db.bookmarks.add` or `chrome.storage.local`. The local IndexedDB should be the only data plane — if you see Supabase errors, the patches weren't applied correctly.

**Q: I want to revert to the original behavior.**

A: Re-clone the original repo and load that instead. No persistent state from the unlocked version affects the original.
