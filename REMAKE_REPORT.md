# StrongLifts Remake Report

Target: a web remake of the StrongLifts 5×5 app (https://stronglifts.com/app/).

**Source caveat:** stronglifts.com sits behind a Cloudflare challenge that blocks automated fetching,
so the official page could not be read directly. The spec below comes from public descriptions of
the app (search-result excerpts of the official page and app-store listings) and the published
StrongLifts 5×5 program rules. It was never compared side by side with the real app.

## Status: REMAKE COMPLETE

All 20 checklist items are implemented and verified (last updated 2026-11-05, workout editor added):

- `npm run lint` passes with 0 problems.
- `npm test`: 59 tests pass in 3 files (`src/logic/logic.test.ts`, `src/state/state.test.ts`, `src/App.test.tsx`).
- `npm run build` passes.
- An end-to-end run in real Microsoft Edge (headless, 375 px phone viewport) passed. It covered a full workout, persistence after reload, a 3-failure deload, CSV download and the plate sheet, with no page errors.
- Screenshots at 390 px width were checked in dark and light mode for every screen: no horizontal overflow, no layout collisions.

## Feature checklist

| # | Feature | Spec | Status | Verified by |
|---|---------|------|--------|-------------|
| 1 | Program A/B alternation | A: Squat 5×5, Bench 5×5, Row 5×5. B: Squat 5×5, OHP 5×5, Deadlift 1×5. Alternates after each finished workout. | DONE | logic: "builds workout A/B"; state: "alternates A and B"; App: "finishing a full workout…switches to B"; E2E |
| 2 | Starting weights | Empty bar (20 kg / 45 lb) for Squat/Bench/OHP, Row 30 kg, Deadlift 40 kg; editable. | DONE | logic: "uses StrongLifts starting weights"; App: "shows workout A with StrongLifts starting weights", "edit working weight" |
| 3 | Set logging by tap | Tap empty circle = target reps; each further tap −1 rep; tap at 0 clears. | DONE | logic: "cycles empty → 5 → 4 → … → 0 → empty"; App: "cycles reps on tap" |
| 4 | Linear progression | All sets hit target → +2.5 kg (Deadlift +5 kg) next time; per-exercise increment editable. | DONE | logic: "adds the increment"; state: "progresses weights on finish" |
| 5 | Failure + deload | Missed reps → repeat weight. 3 failed sessions in a row → deload 10% (configurable). | DONE | logic: "repeats the weight", "deloads 10% after the third consecutive failure", "never deloads below the empty bar"; state: "deloads after three failed sessions"; E2E |
| 6 | Break deload | Returning after ≥2 weeks offers a deload (10% per 2 weeks, max 30%); accept or skip. | DONE | logic: "suggests 10% per two weeks off"; state: "applies a break deload"; App: "offers a deload after a long break" |
| 7 | Rest timer | Starts on logging a set; counts up; guidance 1.5 min easy / 3 min hard / 5 min after failed set; configurable; beep + vibrate. | DONE | state: "starts the rest timer…"; App: "cycles reps on tap and starts a rest timer", "counts up and tells you when rest is over", "edit…rest time" |
| 8 | Warmup calculator | Warmup tab per exercise: 2×5 empty bar then ramp (5/3/2 reps at ~40/60/80%) to work weight, rounded to plates. | DONE | logic: "builds a warmup that ramps from the empty bar"; App: "shows warmup sets and plate calculator" |
| 9 | Plate calculator | Tap weight → plates per side, using the configured bar and plates; warns when a weight can't be loaded. | DONE | logic: "computes plates per side"; App: "…plate calculator…" |
| 10 | Edit weight in workout | Change an exercise's weight for today from the plate/weight sheet. | DONE | state: "edits today's weight without touching saved lifts until finish"; App: "…edits today's weight" |
| 11 | Workout timer & finish | Elapsed time; Finish saves to history and applies progression; confirms before finishing an incomplete workout; reset; switch A/B before starting. | DONE | App: "asks before finishing an incomplete workout", "can switch between A and B"; state: "does not finish an empty workout" |
| 12 | Notes & body weight | Per-workout note and body weight entry. | DONE | App: "lists finished workouts in history with details" |
| 13 | History | Past workouts grouped by month, missed/skipped tags, expandable details, delete. | DONE | App: "lists finished workouts in history with details and delete"; state: "deletes workouts" |
| 14 | Progress charts | Per-lift weight-over-time chart and body-weight chart; next weight, best 5-rep, est. 1RM, sessions; hover tooltip; table view. | DONE | App: "charts progress per lift and body weight"; screenshots |
| 15 | Settings | kg/lb with conversion, bar weight, plates, rest times, deload %, failures before deload, sound. | DONE | state: "converts weights when changing units"; App: settings tests |
| 16 | Backup | Export and import JSON (validated), export CSV. | DONE | state: "rejects malformed imports", "exports history as CSV"; App: "imports a backup and rejects bad files"; E2E CSV download |
| 17 | Persistence | All state saved in localStorage; survives reload; corrupt data falls back safely. | DONE | state: "round-trips through localStorage", "falls back to a fresh state on corrupt storage"; E2E reload |
| 18 | Mobile-first UI | Dark/light StrongLifts-style UI, bottom tab bar, works at phone width; installable (manifest + icon). | DONE | screenshots in dark and light mode, overflow check |
| 19 | Quality gates | Tests, lint and production build pass; CI runs lint + test + build. | DONE | commands above; `.github/workflows/ci.yml` |
| 20 | Workout editor | Add, remove and reorder exercises in A and B; custom exercises (barbell or dumbbell/bodyweight) with their own sets, reps, weight and increment; 5×5 / 3×5 presets; old saves migrate automatically; history keeps exercise names after renames. | DONE | logic: "builds custom workouts…", "progresses and deloads non-barbell exercises…"; state: "workout editor" suite, "migrates version 1 saves"; App: "Workout editor" suite; E2E in Edge with a migrated version 1 save |

## Out of scope

These features of the commercial app are not in this remake:

- Apple Watch / Wear OS apps and Health/Google Fit sync
- Cloud accounts and sync across devices (data is per browser; use Export/Import to move it)
- Paid "Pro" extras: other programs (e.g. Madcow) and more than two workout days (custom exercises in A/B are supported)
- A monthly calendar view (history is a month-grouped list instead)
- Push notifications while the app is closed (alerts only fire while the page is open)
