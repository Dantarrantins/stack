# Stack

Small, expert-backed habits stacked onto the moments you already have: getting ready, breakfast, lunch, the evening meal and bedtime.

Practices are drawn from Diary of a CEO guests (paraphrased, with links to the original episodes) and from John Mark Comer's *Practicing the Way*.

## How it works

- **Today**: three routines, each split into everyday anchors with habits stacked on top. Tick as you go.
- **Day plan**: a timeline of your day built from your routine times.
- **Library**: every practice, with the reasoning, research notes and a Spotify timestamp where there is one.
- One new practice is offered each week, so routines grow slowly.

Your progress is stored on your device (localStorage). Nothing is sent to a server.

## Files

| File | What it is |
| --- | --- |
| `src/stack.html` | The page source, shared with the Claude artifact version |
| `build.py` | Wraps the source into `index.html` for the web |
| `local-db.js` | On-device data store |
| `seed.json` | The habit library and the default moments (things most people already do). Bump `version` to push content updates to existing users |
| `sw.js`, `manifest.webmanifest`, `icons/` | Installable web app (PWA) |

## Deploy

Hosted on GitHub Pages from the `main` branch root. After editing `src/stack.html`:

```
python3 build.py src/stack.html
git commit -am "Update" && git push
```

On a phone, open the site and choose **Add to Home Screen** to install it.

## Accounts and sync (Firebase)

The web app runs on-device only until `firebase-config.js` holds a Firebase web config. Once it does, `cloud.js` asks people to sign in (Google or an emailed sign-in link) and stores each person's data in Firestore under `users/{uid}/…`. The first time someone signs in on a device that already has Stack data, that data is copied into their account (once only; a backup stays on the device).

Live project: **stack-d5236** (Firebase console → Stack). Firestore in europe-west2 (London); Google and email-link sign-in on; `dantarrantins.github.io` authorised.

Setup (for a new project):
1. Create a project at https://console.firebase.google.com and add a **Web app**. Paste its config object into `firebase-config.js` as `window.STACK_FIREBASE = { … }`.
2. **Authentication → Sign-in method:** enable **Google** and **Email/Password** with **Email link (passwordless sign-in)** switched on.
3. **Authentication → Settings → Authorised domains:** add `dantarrantins.github.io` (and any custom domain).
4. **Firestore Database:** create it (production mode, a European location such as `europe-west2` London), then paste `firestore.rules` into the Rules tab and publish.

Setup in the app shows who's signed in, with Sign out and Delete account (deletes all of that person's data, then the login).


## How changes get released

- **`src/stack.html`** is the app. `src/static/` holds everything shipped alongside it. `python3 build.py` builds the site into `dist/`.
- **Branches:** `dev` is where work happens and deploys to the **preview** site (its own test Firebase project, marked with a "Preview" badge). `main` is the **live** site.
- **Checks:** every push runs `.github/workflows/checks.yml` (build + Playwright smoke tests in `tests/`). Run locally with `npm test`.
- **Releasing:** bump `VERSION`, add a line to `CHANGELOG.md`, open a pull request `dev → main`, merge when checks are green. Open copies of the app show "A new version of Stack is ready · Refresh".
- **Data changes** must stay readable by the previous version (people may have an older copy open), so add fields rather than renaming or removing them.
- The Claude artifact is a design sandbox only; it runs on Claude's own database, not Firebase.
