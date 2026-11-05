# F13 — Email setup guide

No credentials appear in this guide. Put every value in `web/.env.local` yourself, and never paste them into chat.

## 1. Resend account (free)
1. Sign up at https://resend.com. The free plan is $0 with 100 emails a day and 3,000 a month; there is no overage billing on Free.
2. Note the email address of your Resend account. Without your own domain, it's the **only** address Resend will deliver to.

## 2. API key (sending only)
1. Go to **API Keys → Create API key**.
2. Give it a name such as `explivio-local`, set the permission to **Sending access** (not Full access), and, once you have a domain, limit it to that domain.
3. Copy the key, which starts with `re_`, straight into `web/.env.local`.

## 3. Sender
- **No domain (today):** `EMAIL_FROM=Explivio <onboarding@resend.dev>`. Resend's testing domain delivers only to your own account address.
- **With your own domain (later):** `EMAIL_FROM=Explivio <no-reply@mail.yourdomain.com>`, using a subdomain as Resend recommends.

## 4. Domain verification (only when you own a domain; never buy one for this)
1. In Resend, go to **Domains → Add domain** and enter a subdomain, for example `mail.yourdomain.com`.
2. At your DNS provider, add **exactly** the records Resend shows. Never share registrar passwords; you add them yourself.
   - **SPF:** a TXT record (and an MX record) on the return-path subdomain (`send.…` by default).
   - **DKIM:** a TXT record (`resend._domainkey.…`).
   - **DMARC (recommended):** a TXT record at `_dmarc.yourdomain.com`, for example `v=DMARC1; p=none; rua=mailto:you@yourdomain.com`. Tighten it later.
3. Click **Verify**. It's usually done within 15 minutes, at most 72 hours.
4. Keep open and click tracking **off**; it's off by default, and Resend recommends that for transactional email.

## 5. `web/.env.local`
```env
EMAIL_TRANSPORT=resend
RESEND_API_KEY=<your re_ key>
EMAIL_FROM=Explivio <onboarding@resend.dev>
EXPLIVIO_APP_URL=http://localhost:3000
# optional: EXPLIVIO_EMAIL_DAILY_LIMIT=90   EXPLIVIO_EMAIL_WORKER=off (then run npm run email:worker)
```
Remove `EMAIL_TRANSPORT` (or set it to `outbox`) to go back to the local outbox. Restart the server after any change; it reports a broken setup at startup, naming the variable but never its value.

## 6. First real test (at most 3 emails)
1. In `web/`, run `npm run dev` and open http://localhost:3000/signup.
2. Sign up with **your Resend account address**. The verification email should arrive within seconds. Check spam too.
3. Click the link; the account is verified. Then go to **Forgot password** and enter the same address; the reset email arrives.
4. Set a new password; the "password was changed" email arrives.
5. In the Resend dashboard, **Emails** shows each message as Delivered, Bounced and so on. That, plus your inbox, is the real proof; "accepted" in our logs only means Resend took it.

## 7. Quotas and failures
- **Daily cap:** the app stops at 90 a day (UTC). Waiting emails go out automatically after midnight UTC, with fresh links.
- **Resend daily quota (100):** the day closes. **Monthly quota (3,000):** emails fail; the user can ask again next month.
- **Nothing upgrades or bills:** the Free plan simply refuses.
- **Job states** are in MongoDB `emailJobs`. `failed` and `unknown` jobs never resend themselves; the user can use **Resend** or **Forgot password** again, subject to a 60 s cooldown and 3 emails an hour.
