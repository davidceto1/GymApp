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
