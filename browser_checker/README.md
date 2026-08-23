# browser_checker

Visits the public "top sites" that StatusNest shows on its `/status` pages from a **real Chromium browser**
and reports, per page, whether it was reachable, the HTTP status, how long it took, and whether the site
served a bot challenge instead of the page.

The browser runs **headed** inside the container on an Xvfb virtual display (`xvfb-run`), so sites see an
ordinary desktop Chrome — real user agent, real rendering — rather than a headless one. (`entrypoint.sh` starts
Xvfb itself rather than via `xvfb-run`, which hangs as PID 1 in a container.) A single Chromium
stays up for the life of the process; each site visit gets a fresh browser context and its pages are
visited one after another.

Scheduling is server-side: the process polls `GET /api/internal/public-tasks` every `POLL_INTERVAL_MS`,
visits whatever sites the server hands out (at most 3 per poll, each claimed for 10 minutes), and posts the
results to `POST /api/internal/public-check-result`. The server then schedules the next visit 5–20 minutes
later (mode 15). Public monitors never alert anyone — they only feed the status pages.

## Environment

| Variable | Default | Meaning |
|---|---|---|
| `STATUSNEST_API_URL` | `http://localhost:3000` | The Next.js app's internal API |
| `API_KEY` | *(required)* | Same as the app's `BACKGROUND_PROCESSOR_API_KEY` (HMAC-signed requests) |
| `POLL_INTERVAL_MS` | `30000` | How often to ask for due sites |
| `NAVIGATION_TIMEOUT_MS` | `30000` | Per-page navigation timeout |
| `BROWSER_HEADLESS` | unset | `1` runs Chromium headless (no display needed). Leave unset in the container. |

## Run locally (headless, no virtual display)

```bash
npm install
npx playwright install chromium      # once
cp .env.example .env                  # set API_KEY (and STATUSNEST_API_URL)
BROWSER_HEADLESS=1 npm run dev
```

`npm test` runs the bot-challenge detection assertions.

## Run the container (headed Chromium under Xvfb)

```bash
docker build -t browser-checker-statusnest .
docker run -d --name browser-checker-statusnest --restart unless-stopped \
  --init --shm-size=1g \
  -e STATUSNEST_API_URL=http://192.168.4.56:3009 \
  -e API_KEY=<BACKGROUND_PROCESSOR_API_KEY> \
  browser-checker-statusnest
```

`--shm-size=1g` matters: Chromium uses `/dev/shm` heavily and the Docker default (64 MB) makes tabs crash.
`--init` gives the container a real init so crashed Chromium subprocesses are reaped. No ports are exposed;
the process only makes outbound requests.

## How a page is judged

- `online`: an HTTP response with status 200–399 and no sign of a bot challenge.
- `offline`: anything else — a 4xx/5xx, a navigation error (`net::ERR_NAME_NOT_RESOLVED`, TLS failures, a
  timeout), or a page that is really a challenge (`blocked: true`): HTTP 403/429, or a title/body matching
  "Just a moment", "Attention Required", "Access Denied", "verify you are human", "unusual traffic",
  "captcha", "Pardon Our Interruption", "Request blocked", … (see `src/block-detection.ts`).

Response time is wall-clock from navigation start to `DOMContentLoaded`.
