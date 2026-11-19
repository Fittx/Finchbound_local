# Scale and account implementation

The supplied React/Vite scaffold already uses TypeScript. This work extends that scaffold;
MERN (MongoDB, Express, React and Node) remains the backend target. No backend framework or
database dependency was changed. These are frontend screens and in-memory service adapters.

## Screens and states

| Area            | Added behavior and states                                                                                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dashboard       | Keyboard-accessible account badge menu; cursor Load more; first-load skeleton/error/empty, loading more, recoverable append error with Retry, appended results, end message                                              |
| Live flock      | Existing moderation retained; full-list search/status/photo queries before pagination; cursor append errors and end message; book-wide counts and an independent report inbox; live arrivals do not shift cursor offsets |
| Editor          | Page-title search, position/recently edited sort, With photo, no results and clear controls; drag, keyboard and move buttons disabled with an explanation when search/filter/sort is active; full list loading states    |
| Profile         | Name, email, Unlimited books, password change, sign out, delete; default, saving, saved, general error, email already used, field validation                                                                             |
| Change password | Current/new/confirmation fields, strength helper, validation, saving, wrong current password and recoverable failure; shares credentials with existing sign-in                                                           |
| Delete account  | Exact saved-email confirmation, disabled destructive action until match, deleting, mismatch and failure; clears session and current mock books/submissions, then sign-in                                                 |
| Page crop       | Reposition with pointer or keyboard, native position/zoom sliders, square and 4:3 previews, reset, Apply, Cancel, preparing/uploading, decode/crop/upload error; Save preserves submission association                   |
| Reader          | 320px toolbar; landscape layout below 560px high; DM Sans outside book content; unknown-book background uses default theme                                                                                               |
| Prototype panel | 320px width and height limits, scrollable content, 44px controls; account and legal destinations                                                                                                                         |
| Legal           | Terms of service and privacy draft pages; sign-up checkbox and footer links; return to the in-memory sign-up draft                                                                                                       |
| Errors          | Default and known-book 404/500 themes, book title context, home/books/book exits                                                                                                                                         |
| Catalog/system  | Scale and account section with 162 frames, Mobile 390 / Tablet 834 / Desktop 1440 plus 320px and landscape frames; state links, component examples and flows                                                             |

Frame names use `Section / Screen / Breakpoint / State`. The update page retains its
IntersectionObserver mount/unmount behavior so distant frames do not run app instances.
The all-breakpoint preview also uses native lazy iframe loading.

## Verification

- `node node_modules/typescript/bin/tsc --noEmit`: passed during implementation.
- `node node_modules/vite/bin/vite.js build`: passed during implementation. Vite reports the
  existing combined app bundle is just over the 500kB warning threshold; there is no build error.
- `node scripts/check-scale.mjs`: passed. Exercises all 48 books, 24 pages, and 50 non-rejected
  b1 submissions without duplicate IDs; queries across unloaded results; edited sorting; live
  arrival cursor stability; full-book status counts; 162 crop geometry combinations; frame names
  and tablet/compact entries; email conflicts; password verification; changed credentials at
  sign-in; exact-email deletion and submission cascade; API error response.

| Viewport          | Checked                                                                                                                                | Not checked                                                                 |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 390px             | Source review of stacked controls, one-column list layouts, account form, modal scroll/footer, frame definitions                       | Rendered layout, clipping, screenshots, real touch input                    |
| 834px             | Source review of the exact tablet breakpoint, two-column grids, three-column editor controls and tablet frames                         | Rendered layout, focus placement, modal visual spacing                      |
| 1440px            | Source review of desktop container/grid limits, four-column page grid and desktop frames                                               | Rendered layout and visual regression comparison                            |
| 320px / landscape | Source review of bounded toolbar/panel widths, 44px targets, panel scrolling and short-height reader layout; catalog dimensions tested | Real browser overflow measurements, orientation changes and device behavior |

Browser navigation to the supplied preview failed (connection refused, then timed out).
A local Vite process could build and report ready, but the environment rejected local socket
access. Therefore **no browser-rendered viewport or end-to-end interaction check is claimed**.
Canvas geometry was checked mathematically; actual image decoding, EXIF orientation, canvas
JPEG output, pointer dragging and uploaded-image persistence were not browser-tested.
Keyboard menu and crop alternatives were reviewed in source, not tested with a screen reader.
No production Express/MongoDB integration, network, deletion job or legal review was performed.

## Assumptions

- Keep the existing TypeScript frontend because the supplied files and requested organization
  already use `.tsx`/`.ts`. MERN itself does not require TypeScript.
- Services remain mock adapters until the existing MERN backend is connected. Reload resets
  in-memory fixtures; this prototype is not persistent account or photo storage.
- Use 12 books, 12 submissions and 8 pages per cursor window so pagination is visible in fixtures.
- One shared crop focal point and zoom drives both renditions: 800×800 and 1200×900 JPEGs.
  Browsers unable to decode HEIC show a conversion hint rather than uploading an uncropped image.
- Reordering is also disabled for recently edited sorting because that order differs from book
  position. Clearing search, filters and sort restores position editing.
- Legal copy is explicitly a prototype draft, not a final service policy.
- A known slug/ID, an explicit `?book=` link or the immediately preceding book route supplies
  error-page theme context. Unknown books use the default theme.
- Account deletion demonstrates the cascade for this mock host's whole dataset. A production
  service must apply ownership checks and durable MongoDB deletion semantics.

## New files

- `src/screens/account/Profile.tsx`
- `src/screens/account/ChangePasswordModal.tsx`
- `src/screens/account/DeleteAccountModal.tsx`
- `src/components/ProfileMenu.tsx`
- `src/components/LoadMore.tsx`
- `src/components/CropModal.tsx`
- `src/components/SortSelect.tsx`
- `src/components/LegalFooter.tsx`
- `src/api/account.ts`
- `src/api/pages.ts`
- `src/api/pagination.ts`
- `src/mocks/account.ts`
- `src/mocks/books.ts`
- `src/mocks/pages.ts`
- `src/lib/useCursorList.ts`
- `src/screens/Legal.tsx`
- `src/screens/errors/useErrorTheme.ts`
- `src/screens/update/scaleCatalog.ts`
- `scripts/check-scale.mjs`
- `docs/scale-and-account.md`

## Changed files

- `src/App.tsx`
- `src/constants.ts`
- `src/store.tsx`
- `src/types/books.ts`
- `src/api/books.ts`
- `src/api/session.ts`
- `src/api/submissions.ts`
- `src/mocks/submissions.ts`
- `src/screens/Dashboard.tsx`
- `src/screens/Editor.tsx`
- `src/screens/Reader.tsx`
- `src/screens/Landing.tsx`
- `src/screens/auth/SignUp.tsx`
- `src/screens/errors/NotFound.tsx`
- `src/screens/errors/ServerError.tsx`
- `src/screens/hub/useModeration.ts`
- `src/screens/hub/ModerationFeed.tsx`
- `src/screens/hub/ModerationToolbar.tsx`
- `src/screens/Frames.tsx`
- `src/screens/System.tsx`
- `src/screens/update/ImplementationUpdate.tsx`
- `src/screens/update/frameCatalog.ts`
- `src/shell.tsx`
- `src/index.css`
- `docs/api-contract.md`
