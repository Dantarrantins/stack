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
