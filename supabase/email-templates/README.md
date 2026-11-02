# MIVO emails (sign-up, password reset, sign-in link)

Supabase sends these emails. Out of the box they come from Supabase's own
test sender (`noreply@mail.app.supabase.io`), are limited to a few per hour,
and look generic. To send them **from MIVO's own address** you connect your
own email sender (SMTP) and paste these templates in.

## 1. Get an email sender for your domain

Pick one (all have a free tier):

| Service | Free tier | Notes |
| --- | --- | --- |
| **Resend** (resend.com) | 3,000 emails / month | Easiest. Has a "Supabase" guide. |
| Brevo (brevo.com) | 300 emails / day | Good if you also want marketing emails later. |
| Zoho Mail / Google Workspace | – | Use if you already have a mailbox on your domain. |

In that service:

1. Add your domain (e.g. `mivo.my`).
2. Add the DNS records it shows you (SPF, DKIM, and ideally DMARC) where you
   bought the domain. Wait until the service says **Verified**.
   Without this, emails land in spam.
3. Create an SMTP password / API key.

## 2. Connect it in Supabase

Supabase Dashboard → **Authentication → Emails → SMTP Settings** → turn on
**Enable custom SMTP**:

| Field | Value |
| --- | --- |
| Sender email | `noreply@<your domain>` (e.g. `noreply@mivo.my`) |
| Sender name | `MIVO` |
| Host / Port / Username / Password | From your email service (Resend: `smtp.resend.com`, port `465`, user `resend`, password = API key) |

Then **Authentication → Rate Limits**: raise "emails per hour" (e.g. 100).

## 3. Paste the templates

Supabase Dashboard → **Authentication → Emails → Templates**. For each one,
set the subject and paste the HTML file:

| Template | Subject | File |
| --- | --- | --- |
| Confirm signup | `Confirm your MIVO account` | `confirm-signup.html` |
| Reset password | `Reset your MIVO password` | `reset-password.html` |
| Magic link | `Your MIVO sign-in link` | `magic-link.html` |
| Change email address | `Confirm your new MIVO email` | `change-email.html` |
| Invite user | `You're invited to MIVO` | `invite.html` |

Each email is in English with a short Bahasa Melayu and 中文 line underneath.

## 4. Check the Site URL

**Authentication → URL Configuration → Site URL** must be your live website
(e.g. `https://mivo.my`). The emails use it for the logo and the links.
Add `https://<your domain>/**` to **Redirect URLs** too.

Then sign up with a test email address to check it arrives from MIVO.
