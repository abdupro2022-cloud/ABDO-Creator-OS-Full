# Deploying ABDO Creator OS from an Android phone

This guide assumes **no computer**. You will use your phone's mobile browser and (optionally) the GitHub mobile app. You do **not** need Termux, a local Node.js install, or any command-line tool.

The recommended path is **Render.com** because the entire stack (frontend + backend + SQLite) deploys as a single unit, the web UI works in a mobile browser, and a persistent disk is included on the free tier.

A Docker path is also provided if you prefer a container host (Railway, Fly.io, a private VPS reached over Tailscale SSH, etc.).

---

## Path A — Render.com (recommended for phone-only)

### 1. Get the project onto GitHub from your phone

**Option A1 — Mobile browser, web upload:**

1. Open your mobile browser and go to <https://github.com/new>
2. Sign in or create an account
3. Repository name: `abdo-creator-os` (or any name you like)
4. Visibility: Public or Private — your choice
5. Leave "Initialize with README" UNCHECKED
6. Tap **Create repository**
7. On the empty-repo page, tap **uploading an existing file**
8. Unzip `ABDO-Creator-OS-Full-Project.zip` on your phone (use your phone's Files app)
9. In the GitHub upload page, select **all files and folders inside the unzipped directory** (NOT the directory itself). On Android, tap "Add file" → "Upload files" and pick them from your Files app. Upload the contents in batches if needed (GitHub's web uploader accepts many files but not huge directory trees in one shot — uploading the root contents is enough; Render needs only the source).
10. Wait for upload to complete. Tap **Commit changes**.

**Option A2 — GitHub mobile app:**

1. Install the official GitHub app from Google Play
2. Sign in
3. Tap **+** → **New repository** → fill in name → Create
4. Open the new repo on github.com in your mobile browser
5. Continue with step 7 of Option A1 (web upload), or use the app's "Add file" → "Upload" flow

> **Important:** Upload the **contents** of the unzipped folder (so `package.json`, `server/`, `client/`, `render.yaml`, `Dockerfile`, etc. are at the repo root), not the folder itself.

### 2. Deploy on Render

1. In your mobile browser, go to <https://dashboard.render.com>
2. Sign up (GitHub sign-in is fastest)
3. Tap **New +** → **Blueprint**
4. Connect your GitHub account if prompted
5. Select the `abdo-creator-os` repository you just created
6. Render auto-detects `render.yaml` and shows the service plan
7. Review the service name and region if you want
8. Tap **Apply** (or "Create Service")
9. Render now clones the repo, runs `npm install && npm run build`, and starts the service. This takes 2–4 minutes.
10. When the deploy finishes, Render shows a URL like `https://abdo-creator-os-xxxx.onrender.com`
11. Open that URL in your phone's browser. You should see the ABDO Creator OS sign-in page.

### 3. Set the secrets

1. In Render, go to your service → **Environment**
2. Render auto-generated `APP_KEK` and `JWT_SECRET` on first deploy (look for values starting with auto-generated markers). These are correct and should not be changed unless you want to invalidate all sessions.
3. **Optional:** To enable live web search, add `RESEARCH_TAVILY_KEY` (get one at <https://tavily.com>) or `RESEARCH_SERPAPI_KEY` (get one at <https://serpapi.com>).
4. Tap **Save Changes**. Render redeploys automatically.

### 4. First run on your deployed instance

1. Open the Render URL in your phone's browser
2. Tap **Sign up** and create your account
3. The first user is automatically assigned the `user` role. To make yourself an admin, you need to update the DB:
   - In Render, go to your service → **Shell** (or **Connect → SSH**)
   - Or use the on-disk SQLite via the **Shell** tab
   - Run: `sqlite3 /var/data/abdo.sqlite "UPDATE users SET role='admin' WHERE email='you@example.com';"`
   - Then sign out and back in
4. Go to **Providers & Models** in the top nav
5. Tap **Add provider**, pick a provider (e.g. OpenAI), paste your API key, save
6. Tap **Test connection** to verify the key works
7. Go to **AI Assistant** and send a prompt

### 5. Persistent data

Render mounts a 1 GB persistent disk at `/var/data`. Your SQLite file, the encrypted provider keys, all your projects, skills, and research reports live there. **The disk survives redeploys.** It does NOT survive if you delete the service — back up `/var/data/abdo.sqlite` regularly.

To back up from your phone: Render's shell doesn't easily support file downloads, so the recommended approach is to:
- Set up automatic daily backups via Render's **Snapshots** feature (paid plans), OR
- Add a small scheduled job that copies the DB to a cloud bucket, OR
- Manually: use Render's shell to `cat` the file and copy to a paste-bin, then reconstruct it locally — only viable for tiny DBs.

---

## Path B — Docker on any container host

This works with any host that lets you paste a `docker run` command or a `docker compose up`. Examples: Fly.io with a Dockerfile, Railway with Dockerfile support, or your own VPS reached over Tailscale SSH (a mobile-friendly SSH client like Termius works from a phone — note: this is for connecting to a host you already have, not a substitute for a computer).

### B1. Push to a registry from your phone

1. After step 1 above (GitHub), go to <https://hub.docker.com> in your mobile browser
2. Sign in
3. Tap **Create Repository** → name it `abdo-creator-os` → Create
4. From your GitHub repo, Render / Railway / Fly.io can build the Dockerfile directly without a registry. Prefer that path.

### B2. Deploy via Render using the Dockerfile (alternative to Path A)

`render.yaml` already uses the npm build path. To use the Dockerfile instead, on the Render "New Blueprint" page, edit the service to use **Environment: Docker** and point it at the repo. Render will detect the `Dockerfile` automatically.

---

## Path C — Vercel (frontend) + separate backend (not recommended for phone-only)

This path splits the project into two services. Vercel handles the static client. A separate service (Render, Railway, Fly.io) handles the API. It works but requires more setup and two deployments. Not recommended for phone-only first-timers.

---

## Path D — One-click deploy buttons (zero typing, works on mobile)

Some platforms offer one-click deploy buttons. After you push the code to GitHub, you can also share these URLs (or the QR codes that some platforms generate) to deploy without typing any commands:

- **Render Blueprint:** once `render.yaml` is in your GitHub repo, Render offers an "I have a Blueprint" link on its dashboard. Click → connect repo → deploy.
- **Railway:** railway.app's "Deploy from GitHub" flow works in a mobile browser.

---

## Verifying the deploy

After step 4 above, open the deployed URL and:

1. **Health check:** `https://your-url.onrender.com/api/health` should return `{"ok":true,...}`
2. **Sign in flow:** create an account, sign in, see the home page
3. **Add a provider:** paste a real OpenAI / DeepSeek / Groq key, click Test connection — the network call to the provider's `/models` endpoint should succeed
4. **AI Assistant:** send a prompt; the configured provider returns a structured proposal
5. **Workflows:** run a 5-role task; watch the trace build up
6. **YouTube:** fetch a real video via oEmbed (no key needed); paste a transcript and analyze it

---

## Backup and recovery

- **Render disk snapshot:** Render's paid plans support automatic disk snapshots.
- **Manual SQLite dump:** from Render's shell: `sqlite3 /var/data/abdo.sqlite .dump > /tmp/backup.sql`. Then `cat` the dump and save it to a secure cloud location from your phone.
- **Restore:** `sqlite3 /var/data/abdo.sqlite < /tmp/backup.sql` from the shell.

**Critical:** the `APP_KEK` environment variable must be backed up separately. Without it, the encrypted provider keys in the DB cannot be decrypted. Render's Environment page keeps a history; copy the value to a secure location.
