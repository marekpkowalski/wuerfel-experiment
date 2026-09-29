# Würfel-Experiment

A classroom web app for exploring probability with real dice. Teams of two roll a die 100 times and tap each result into a phone, tablet or laptop. Every roll appears immediately in shared charts, for each team and for the whole class, next to what a fair die would give.

The interface is in German by default. Add `?lang=en` to any address for English; the choice is remembered on that device.

## Requirements

- Node.js 18 or newer ([nodejs.org](https://nodejs.org), the LTS version is fine). Check with `node -v`.
- A computer that acts as the server (usually the teacher's laptop), and a network the students' devices can reach it on. See [In the classroom](#in-the-classroom). This is the part most likely to cause trouble.

No database, no build step, no internet connection needed while running. Plotly is bundled locally.

## Quick start

```
npm install
npm start
```

The server prints the addresses it can be reached at, for example:

```
Würfel-Experiment läuft / is running.
  Auf diesem Rechner / on this computer:  http://localhost:3000
  Im Netzwerk / on the network:           http://192.168.1.23:3000
```

Open the network address (or `http://localhost:3000`) in a browser on the teacher's computer.

To use another port: `PORT=8080 npm start` (macOS/Linux) or `set PORT=8080 && npm start` (Windows cmd).

## Running a lesson

**Teacher**

1. Open the start page, choose the number of teams (1–30) and click **Experiment starten**.
2. The teacher view opens. Project it: it shows the QR code and join address, the list of teams with their progress, and the class charts.
3. Use the **Ansicht** menu to look at a single team. The teacher can delete a team's rolls (for example after a mix-up) and save all data as a CSV file at the end.

The teacher view is unlocked by a key that is stored in the browser when the experiment is started. Keep using the same browser on the same computer; other devices opening `/teacher/…` can watch but not delete.

**Students**

1. Scan the QR code (or type the address).
2. Pick the team. Both members of a team pick the same team, so they share one table. One rolls, the other enters, or both enter from their own devices.
3. Roll, then tap the die face that came up. Keys 1–6 also work on a keyboard.
4. To correct a roll, tap its cell in the table, then tap the right number (or **Feld leeren**). **Letzten Wurf löschen** removes the most recent roll.
5. The **Ansicht** menu shows other teams (read-only) and **Alle Teams**, the class view.

If a phone reloads or loses connection, it reconnects on its own, keeps its team, and sends any rolls that were entered while offline.

## In the classroom

Phones must be able to reach the server computer. Three things commonly get in the way:

1. **Same network.** Students' devices must be on the same Wi-Fi as the server computer. Mobile data won't work.
2. **Firewall.** On first start, Windows asks whether Node.js may accept connections: allow it for private networks. On macOS, allow incoming connections for `node` if asked.
3. **Client isolation.** Many school and guest Wi-Fi networks block devices from talking to each other. Symptom: the correct address works on the laptop but times out on phones. Workarounds:
   - Open a mobile hotspot (phone or laptop) and have everyone join it. A typical phone hotspot is limited to about 10 devices, so this suits smaller classes.
   - Ask the school IT for a network without client isolation, or
   - Run the app on a central server (next section).

The QR code always points to an address other devices can use: if you opened the app via `localhost`, the server substitutes its network address. If it finds none, the teacher view shows a warning.

### Running on a central server

The app is a single Node.js process and runs on any service that supports Node and WebSockets (a virtual server, a machine at your institute, or a platform such as Render, Railway or Fly.io). Start command: `npm start`.

**Required settings on a public server**

```
PUBLIC_URL=https://wuerfel.example.org   # the address students and teachers use
TRUST_PROXY=1                            # one reverse proxy / platform load balancer in front of the app
```

- `PUBLIC_URL` is used for the QR code and all links. Without it, the address is taken from the request, which an attacker could manipulate.
- `TRUST_PROXY` tells the app how many proxies sit in front of it. Only then does it believe the `X-Forwarded-For` and `X-Forwarded-Proto` headers they add; without a proxy, leave it unset, otherwise anyone could fake their IP address and get around the rate limits. Hosting platforms (Render, Railway, Fly.io) use one proxy, so `1` is right there. It can also be `loopback` or a comma-separated list of proxy IP addresses.
- With both set and `PUBLIC_URL` starting with `https://`, the app redirects plain HTTP to HTTPS, refuses unencrypted WebSocket connections and sends an HSTS header. If `PUBLIC_URL` is `https://` but `TRUST_PROXY` is missing, the server prints a warning and does not enforce HTTPS.

**On your own server,** put a reverse proxy with automatic TLS certificates in front of the app. With [Caddy](https://caddyserver.com), the complete configuration is:

```
wuerfel.example.org {
    reverse_proxy localhost:3000
}
```

Run the app as an unprivileged user (not root), for example as a systemd service, and let only ports 80 and 443 through the firewall.

**Operation**

- Run exactly **one** instance. Sessions live in memory; with several instances, students would land on different servers.
- Restarting or redeploying **ends all running experiments**. Free hosting tiers put apps to sleep when idle, which also restarts them. Avoid updates during school hours.
- Keep dependencies current: `npm audit` shows known vulnerabilities, `npm update` installs fixes.
- Server and proxy logs contain IP addresses. Keep them only briefly and mention them in the privacy notice. A public website in Germany also needs an Impressum and a privacy notice (Datenschutzerklärung). The Impressum is in `public/impressum.html`, the privacy notice in `public/datenschutz.html`; both are linked at the bottom of every page. The privacy notice promises that proxy access logs are deleted after at most 7 days, so configure the reverse proxy accordingly (Caddy writes no access logs unless a `log` directive is added).

The app itself stores no personal data: teams are numbered, no names or accounts are involved, and all data disappears when the experiment ends.

### Security measures

- **Rate and resource limits** (see Configuration): new experiments per IP address and minute, experiments running at the same time, WebSocket connections in total, per experiment and per IP address, and messages per connection and second. Messages are limited to 1 kB and strictly validated.
- **Security headers** via [helmet](https://helmetjs.github.io): a Content-Security-Policy that only allows scripts from the app itself (no inline scripts, no `eval`, which is why the "strict" Plotly bundle is used), forbids embedding the app in other sites, and sends no referrer, so session links don't leak to other websites.
- **WebSocket origin check:** browsers may only connect from the app's own pages, so other websites cannot use their visitors' browsers to connect.
- **Teacher key:** 128 random bits, passed in the URL fragment (never sent to the server in the page request), compared in constant time, and removed from the address bar before the page is projected.
- **No HTML from user input:** everything shown in the page comes from fixed texts or numbers.

What remains by design: anyone who has an experiment's link can enter and delete rolls in any team of that experiment. Experiments are deleted after 24 hours; don't post the QR code publicly.

Note on shared IP addresses: a whole school often reaches the internet through one IP address, so all its students count against the same per-IP limits. The defaults are generous for that reason.

## Configuration

| Setting | Where | Default |
|---|---|---|
| Port | environment variable `PORT` | `3000` |
| Public address for QR code and links | `PUBLIC_URL` | detected automatically |
| Number of trusted proxies in front of the app | `TRUST_PROXY` | none |
| Experiments running at the same time | `MAX_SESSIONS` | 200 |
| WebSocket connections in total | `MAX_CONNECTIONS` | 3000 |
| Connections per experiment | `MAX_CONNECTIONS_PER_SESSION` | 150 |
| Connections per IP address | `MAX_CONNECTIONS_PER_IP` | 300 |
| New experiments per IP address and minute | `CREATE_LIMIT_PER_MIN` | 10 |
| Number of teams | start page | 20 (1–30) |
| Lifetime of an experiment | fixed (`SESSION_TTL_HOURS` in `src/sessions.js`) | 24 hours, then all its data is deleted |
| Rolls per team | fixed | 100 |

## What the charts show

Every chart compares the data with the expectation for a fair die.

- **Wie oft kam welche Zahl?** One circle per face showing its count. The dashed line is the expected count n/6. Each circle has an error bar of ±1 standard deviation, σ = √(n · 1/6 · 5/6): the spread a fair die produces by chance alone. For a fair die about two thirds of the error bars reach the dashed line, and a circle more than 2σ away is unusual. A percentage toggle is available.
- **Serien gleicher Zahlen.** Number of runs of each length (a run is a maximal sequence of equal consecutive rolls, e.g. 3, 3, 3 is a run of length 3). Diamonds show the expectation. For n consecutive rolls the expected number of runs of length exactly k < n is (1/6)^(k−1) · [2 · 5/6 + (n − k − 1) · (5/6)²]. For 100 rolls that is about 69.7 runs of length 1, 11.5 of length 2, 1.9 of length 3 and 0.3 of length 4.

Runs never extend across an empty cell or from one team into another; the class run chart adds up the teams' runs.

## Changes from the original specification

- **Explicit team choice** instead of automatic assignment, so both members of a team end up in the same team, and a latecomer can never take over another team's data.
- **Die-face buttons instead of 100 text fields.** Input validation is built in (only 1–6 can be entered), entry is fast on phones, and the server decides where each roll goes, so two devices can enter for the same team at the same time.
- **Run-length fix:** runs are broken at gaps and counted per team.
- **Theoretical expectations in every chart:** the frequency chart shows circles with ±1σ error bars around the fair-die expectation, the run chart shows the expected number of runs. These replace the "average run length per face" and overlaid team bar charts.
- **One port** for HTTP and WebSockets (`/ws`), `wss://` under HTTPS, JSON body parsing, and QR codes that never point to `localhost`.
- **Teacher view** at `/teacher/<id>`, protected by a random key in the URL fragment, with QR code, team overview, per-team delete and CSV export.
- **Batched broadcasts** every 150 ms (updates are never dropped), queued sends while offline, automatic reconnect.
- **Plotly served locally**, so the app works without internet access.
- Colours from the Okabe–Ito palette, readable with common forms of colour blindness.

## Limitations

- Everything is in memory. Restarting the server ends all experiments; export the CSV before stopping.
- If two devices correct the same cell at the same moment, the last one wins.
- Designed for one classroom-sized session at a time per class (about 50 devices); several parallel sessions on one server are fine.
- Tested with automated server and interface tests, not yet on a wide range of real phones and tablets. Please try a full run on the school network before the first lesson.

## Development

```
npm test          # statistics tests, including a simulation check of the run-length formula
```

```
public/
  index.html, start.js   start page (create an experiment)
  session.html, app.js   student and teacher view (same page, role from the URL)
  plots.js               Plotly charts
  stats.js               statistics, shared by browser and server
  dice.js                die faces and colours
  i18n.js                all texts (German, English)
  net.js                 WebSocket client with reconnect and offline queue
  style.css
src/
  server.js              Express routes and WebSocket server
  sessions.js            in-memory sessions and roll operations
test/
  stats.test.js
```

### HTTP routes

| Route | Purpose |
|---|---|
| `GET /` | start page |
| `POST /api/sessions` | create an experiment; body `{ "teams": 20 }` |
| `GET /api/sessions/:id` | join address and expiry |
| `GET /api/sessions/:id/qr.svg` | QR code |
| `GET /session/:id` | student view |
| `GET /teacher/:id` | teacher view |
| `GET /health` | status |

### WebSocket messages (`/ws?session=<id>`)

| Direction | Message |
|---|---|
| client → server | `{type:"hello", role:"student"\|"teacher", key?}` |
| client → server | `{type:"join_team", teamId}` |
| client → server | `{type:"add_roll", value}` appends after the last entered roll |
| client → server | `{type:"set_roll", index, value}` correction; `value: null` clears the cell |
| client → server | `{type:"undo"}` removes the last entered roll |
| client → server | `{type:"clear_team", teamId?}` own team; any team for the teacher |
| server → client | `{type:"state", session}` full state, batched |
| server → client | `{type:"welcome", role}`, `{type:"joined", teamId}`, `{type:"error", code}` |

Close codes: `4404` unknown session, `4410` session expired, `4429` too many devices in this experiment (the client retries after 15 seconds).

## License

MIT, see [LICENSE](LICENSE).
