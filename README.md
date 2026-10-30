# MIND · 脑海 (Brain)

> A habit-building companion system that records your daily practice and habit check-ins in real time, and lets you export and download your data anytime.

**MIND (脑海)** is a single-page web system for personal learning and self-discipline management. It brings **daily practice, skill building, habit check-ins, career planning, and course selection** together in a clean, tidy interface—accompanying you as you accumulate progress and grow step by step.

Data follows a **local-first** strategy: every entry is saved locally in real time (disk file + browser cache), and you can export and download your data to your own device at any time. The current version **does not yet support automatic synchronization or sharing across different devices**—all data stays safely on your local machine first.

---

## Feature Navigation

The navigation bar on the left side of the app contains the following modules:

| Nav Item            | Description                                                        |
| ------------------- | ------------------------------------------------------------------ |
| Basic Study Log     | Record the subjects you study each day and the time spent (decimals supported) |
| Skill Building Log  | Track your practice progress and proficiency for each skill        |
| Habit Building      | Habit check-ins and streak tracking to help you keep long-term habits |
| Network             | Manage your personal contacts and notes                            |
| Projects            | Record the projects you take part in and their progress            |
| Career + Courses    | Dropdown with two sub-modules—"Career" and "Courses"—for planning your direction and curriculum |
| Ideas               | Jot down inspirations and thoughts on the fly                      |
| Review              | Reflect on and summarize your learning / growth over a period      |
| Settings            | Theme, font, reminders, sound, data backup & recovery, and more    |

---

## Core Features

### Daily Study Tasks & Study Log

In **Basic Study Log**, you can record the time spent on each subject per day, supporting **decimal-duration check-ins** (e.g. `1.5` hours), and add in-day check-ins and detail notes. The system aggregates your effort by date into a visual learning trajectory, so you always know where your time went.

### Skill Building Log

**Skill Building Log** tracks your practice progress across skills, turning scattered practice into a reviewable capability map—so you can see your growth curve on any given skill.

### Habit Building

The **Habit Building** module helps you build and sustain long-term habits. Daily check-ins and streak-day tracking make good habits visible and stickable.

### Scheduled Reminders

The app has built-in reminder capability: you can set local reminders that pop up on your desktop / phone like a text message via **system notifications** when the time arrives (requires permission). Even without permission, opening the page triggers in-app reminders and sound cues, so you never miss a day of learning or check-ins.

### Career & Courses

The **Career + Courses** dropdown contains two sub-modules:

- **Career**: plan your career direction, record target positions and job-search progress.
- **Courses**: manage your course list and study schedule, linking course progress to your main study log.

---

## Tech Stack

- **Frontend**: vanilla HTML / CSS / JavaScript (single-page app, no build step, no frontend framework dependencies)
- **Persistence**: browser `localStorage` (instant cache) + zero-dependency Node.js local server (disk authoritative copy)
- **Cloud sync (optional)**: LeanCloud (only used after you manually enable it in *Settings → Data Sync*; off by default, and local features work fine without it)
- **Runtime**: any modern browser + Node.js (needed only for the local-server persistence mode, recommended)

## How to Run Locally

> It is recommended to open the app via the local server: data is then **permanently saved to your local disk** and can be backed up / rolled back at any time.

1. Install [Node.js](https://nodejs.org/) (v14 or above).
2. Run the startup script in the project root:
   - Windows: double-click `start.bat`
   - macOS / Linux: run `bash start.sh` in the terminal (or `chmod +x start.sh && ./start.sh`)
3. Open `http://127.0.0.1:8000` in your browser to start using it.

You can also start it manually:

```bash
node server.js
```

> Lightweight usage without Node: opening `index.html` directly (`file://` mode) also works, but data only lives in the current browser's `localStorage`—switching ports / clearing cache will lose it, and no disk backup is possible. The local-server approach above is recommended.

## Data Persistence & Backup

Data follows a **local-first** strategy to avoid the "lost on refresh, lost on port switch" problem:

- **Instant cache**: every save first writes to browser `localStorage`, guaranteeing a fast first paint.
- **Disk authoritative copy**: `server.js` persists data to `data/mind_data.json` (authoritative, durable).
- **Automatic rolling backups**: every write keeps a historical version in `data/backups/` (up to 20 copies), and you can roll back anytime.
- **Fallback alerts**: if the local server is not connected (e.g. opened via `file://` so only the browser can store data), the UI shows a gentle prompt; if even the browser write fails, a red emergency banner appears—data is never silently lost again.

In the *Settings → Data Backup & Recovery* panel you can:

- View the current save status and last-saved time;
- Download a data backup with one click (export JSON to local);
- Restore from a backup file;
- Migrate the data currently in your browser to a local disk file (to recover historical data across ports / modes).

> Note: your personal learning data is stored on your local machine and is **never automatically uploaded to any cloud or third party**; LeanCloud cloud sync only takes effect after you actively configure and enable it.

## Directory Structure

```
.
├── index.html            # App entry point
├── css/
│   └── styles.css        # All styles (theme variables + day / night modes)
├── js/
│   ├── store.js          # Data layer: localStorage + local-server dual-write persistence
│   ├── ui.js             # Common UI components (cards, modals, etc.)
│   ├── mindmap.js        # Mind-map related views
│   └── app.js            # Main app: navigation, module views, interaction logic
├── assets/
│   └── logo.png          # App icon
├── server.js             # Zero-dependency local persistence service (disk + backups)
├── start.bat / start.sh  # One-click startup scripts
├── smoke_test.js         # Startup smoke test (node smoke_test.js)
└── README.md             # This file
```

> `data/` and `.workbuddy/` are directories produced at runtime / by tooling; they are already in `.gitignore` and will not enter the version control repo.

## Testing

```bash
node --check js/*.js   # Syntax check
node smoke_test.js     # Startup + "Review" view render smoke test
```
