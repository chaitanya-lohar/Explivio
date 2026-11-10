# Next milestone: pilot open to testers

Revised 2026-11-10. **Explivio is a pilot, not a public launch.** It proves the idea works as a real product and runs at **$0** on free tiers. Paid services are considered only if we later decide to scale and go public.

The goal of this milestone is that **people other than the owner can sign up and try it** at https://explivio.vercel.app. Today that fails at one point: the verification email reaches only the owner's address.

Owner: **You** = the user (dashboards), **Claude** = configuration and testing.

## Step 1: email to every tester (the only blocker)
1. **You:** register a free domain at DigitalPlat (e.g. `explivio.dpdns.org`; one per account; check the spelling and that there's no charge).
2. **You:** add it to Cloudflare (Free plan) and set Cloudflare's two nameservers at DigitalPlat. Wait for **Active**.
3. **You:** add the domain in Resend, then copy its 3 records into Cloudflare DNS:
   - MX on `send`;
   - SPF TXT on `send`;
   - DKIM TXT on `resend._domainkey`.

   Then click **Verify**.
4. **You:** set `EMAIL_FROM=Explivio <no-reply@<your domain>>` in Vercel (Production + Preview) and `web/.env.local`.
5. **Claude:** redeploy production and check that the next email job is `accepted`.
6. **You:** sign up with a second Gmail address. The verification email arrives (check spam), the link works, sign-in works.

**Done when:** a brand-new tester on a different address can verify, sign in and create a video.

## Step 2: tester check (Claude, short)
- Two accounts on production: each can create, watch and download only its own videos.
- A short note for testers: check spam for the email; videos take a few minutes; one video renders at a time; each account has a daily limit.

## Step 3: merge
**You:** merge `dev` into `main`: https://github.com/chaitanya-lohar/Explivio/compare/main...dev

## Limits that stay (free tier, by design)
- About 46 ninety-second videos per month in total (Vercel Hobby's 5 h of Sandbox CPU). After that, rendering pauses until next month; nothing is billed.
- One video renders at a time; each account has a daily limit.
- Emails from a new free domain may land in spam at first.

## Optional later (only if wanted, still $0)
- A friendly "paused for this month" message instead of a failure when the allowance is used.
- A simple Privacy note (the sign-up checkbox mentions Terms and Privacy).
- A database backup command; a test database user for the live tests.
- A full validation pass (F15) before any decision to scale.
