# GymApp — StrongLifts 5×5 remake

A mobile-first web remake of the [StrongLifts 5×5](https://stronglifts.com/app/) workout app.
React 19 + TypeScript + Vite, no backend: everything is stored in your browser.

## Features

- **5×5 program**: Workout A (Squat, Bench, Row) and B (Squat, OHP, Deadlift 1×5), alternating automatically. 3×5 preset available.
- **Workout editor** (Settings → Workouts): add, remove and reorder exercises in A and B, create custom exercises (barbell or dumbbell/bodyweight), and set sets, reps, weight and increment per exercise.
- **Tap-to-log sets**: tap a circle for 5 reps, tap again to count down a rep, tap at 0 to clear.
- **Automatic progression**: +2.5 kg per successful session (+5 kg deadlift), weight repeats after a miss, 10% deload after 3 failed sessions in a row.
- **Break deload**: offered when you come back after 2+ weeks off.
- **Rest timer**: starts when you log a set; guides 1.5 min (easy), 3 min (hard) or 5 min (failed); beeps/vibrates.
- **Warmup calculator** and **plate calculator** for every lift; change today's weight from the plate sheet.
- **History** grouped by month, with notes, body weight and delete.
- **Progress charts** per lift and for body weight, with best 5-rep, estimated 1RM and a table view.
- **Settings**: kg/lb (with conversion), bar weight, plates, rest times, deload rules.
- **Backup**: export/import JSON, export history as CSV.
- Light and dark themes, installable as a PWA.

## Cloud sync (optional, Supabase)

Without configuration the app is local-only. With Supabase, you sign in with email + password
(Settings → Cloud sync) and settings, exercises, workouts and history sync across devices.
The app still runs from local storage, so it works offline and uploads changes when back online.

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run [`supabase/migrations/20261106000000_init.sql`](supabase/migrations/20261106000000_init.sql)
   (or `supabase db push` with the Supabase CLI). Row-level security restricts every row to its owner.
3. Copy `.env.example` to `.env.local` and fill in the project URL and anon key
   (Project Settings → API). For a deployed build, set the same variables in the host.
4. Start the app, open Settings → Cloud sync and choose **Create account**, then sign in.
5. Single user? After creating your account, turn off **Allow new users to sign up**
   (Authentication → Sign In / Providers) so nobody else can register. Turn it back on to open the app to others.

Sync details: the first sign-in uploads this device's data. On a new device, cloud settings win and
any local-only workouts are merged into the history. After that, each change is uploaded about
1.5 s later as a row-level diff, and the app pulls the cloud copy on startup, on reconnect and when reopened.
If two devices edit the same settings while offline, the last one to sync wins.

## Development

```sh
npm install
npm run dev     # start dev server
npm test        # unit + component tests (vitest)
npm run lint
npm run build
```

Code layout:

- `src/logic/` – pure program rules (progression, deloads, warmups, plates, units)
- `src/state/` – reducer for all state changes, localStorage persistence, import/export
- `src/ui/` – screens and components

See [REMAKE_REPORT.md](REMAKE_REPORT.md) for the feature-by-feature status.
