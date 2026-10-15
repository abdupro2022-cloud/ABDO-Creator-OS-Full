# ABDO Creator OS — Android phone deploy (quick start)

Five steps. No computer, no Termux, no local Node.js.

## What you need

- An Android phone
- The `ABDO-Creator-OS-Full-Project.zip` file (downloaded to your phone)
- A GitHub account (free)
- A Render.com account (free tier works)

## Steps

1. **Unzip the project** on your phone using your Files app. You should see a folder with `package.json`, `server/`, `client/`, `render.yaml`, `Dockerfile`, and the docs.

2. **Create a GitHub repo from your phone:**
   - Open your mobile browser → <https://github.com/new>
   - Sign in
   - Repository name: `abdo-creator-os`
   - Leave "Initialize with README" unchecked
   - Tap **Create repository**
   - Tap **uploading an existing file**
   - Select **all files and folders inside the unzipped directory** (NOT the wrapper folder) — for example `package.json`, the `server/` folder, the `client/` folder, `render.yaml`, etc.
   - If GitHub complains about too many files, do it in two batches: first upload everything except the `node_modules/` folder, then commit the rest. (`node_modules/` is in `.gitignore` and doesn't need to be uploaded anyway — Render will run `npm install` itself.)
   - Tap **Commit changes**

3. **Deploy on Render:**
   - Open <https://dashboard.render.com> in your mobile browser
   - Sign up (GitHub sign-in is fastest)
   - Tap **New +** → **Blueprint**
   - Connect your GitHub account
   - Select the `abdo-creator-os` repo
   - Tap **Apply**
   - Wait 2–4 minutes for the first build. Render logs the progress live.
   - When done, Render shows a URL like `https://abdo-creator-os-xxxx.onrender.com`

4. **Open the URL in your phone's browser** and create an account. You're live.

5. **(Optional) Make yourself an admin** to moderate community Skills:
   - In Render, go to your service → **Shell**
   - Run: `sqlite3 /var/data/abdo.sqlite "UPDATE users SET role='admin' WHERE email='your-email';`
   - Sign out and back in
   - The Community page now shows a moderation panel

## Where your data lives

Everything is in `/var/data/abdo.sqlite` on Render's persistent disk. That includes:
- Your account
- All your provider API keys (encrypted with AES-256-GCM)
- All your projects, scripts, research, conversations
- All workflow runs and step traces

The disk survives redeploys but not service deletion. To back up: open Render's Shell, run `sqlite3 /var/data/abdo.sqlite .dump > /tmp/backup.sql`, then `cat /tmp/backup.sql` and copy the output to a secure cloud location.

## If something goes wrong

- **Build failed:** tap the failing log line in Render's deploy view. The most common cause is a transient npm registry error — tap **Manual Deploy** → **Deploy latest commit** to retry.
- **App shows 502 / 503:** wait 30 seconds and reload. Render's free tier spins down idle services; the first request after a quiet period takes a few extra seconds to wake up.
- **Forgot password:** open `/reset-password` on your deployed URL and use the recovery flow.
- **Want to add a real LLM key:** go to **Providers & Models** in the app, add a provider, paste your key, click Test connection.

That's it. You have a real, production-shaped ABDO Creator OS running on the public internet, deployed entirely from your phone.
