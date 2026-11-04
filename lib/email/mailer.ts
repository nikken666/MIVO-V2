import nodemailer, { type Transporter } from "nodemailer";

// Sends from your own mailbox over SMTP. For Gmail:
//   SMTP_USER = you@gmail.com, SMTP_PASS = a 16-letter App Password
//   (Google Account > Security > 2-Step Verification > App passwords).
// Other providers: also set SMTP_HOST / SMTP_PORT.

let transporter: Transporter | null = null;

function smtpUser() {
  return (process.env.SMTP_USER || "").trim().replace(/^["']|["']$/g, "").toLowerCase();
}
function smtpPass() {
  // Gmail shows App Passwords as "abcd efgh ijkl mnop": spaces and stray quotes are removed.
  return (process.env.SMTP_PASS || "").replace(/\s+/g, "").replace(/^["']|["']$/g, "");
}

/** What the server actually sees, without revealing the password. */
export function smtpDiagnostics() {
  const pass = smtpPass();
  return {
    host: process.env.SMTP_HOST?.trim() || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 465),
    user: smtpUser() || null,
    passLength: pass.length,
    passLooksLikeAppPassword: /^[a-z]{16}$/i.test(pass),
    vercelEnv: process.env.VERCEL_ENV || null,
  };
}

/** Log in to the mail server without sending anything. */
export async function verifySmtp() {
  if (!emailConfigured()) throw new Error("SMTP_USER / SMTP_PASS missing.");
  await transport().verify();
}

export function emailConfigured() {
  return Boolean(smtpUser() && smtpPass());
}

function transport() {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 465);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST?.trim() || "smtp.gmail.com",
      port,
      secure: port === 465,
      auth: { user: smtpUser(), pass: smtpPass() },
    });
  }
  return transporter;
}

export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://mivo-v2.vercel.app").replace(/\/$/, "");
}

export type Mail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  unsubscribeUrl?: string;
};

export async function sendMail(mail: Mail) {
  if (!emailConfigured()) throw new Error("Email is not set up (SMTP_USER / SMTP_PASS missing in Vercel).");
  const user = smtpUser();
  const name = (process.env.EMAIL_FROM_NAME || "MIVO").replace(/["\r\n]/g, "");
  await transport().sendMail({
    from: `"${name}" <${process.env.EMAIL_FROM?.trim() || user}>`,
    replyTo: process.env.EMAIL_REPLY_TO?.trim() || undefined,
    to: mail.to,
    subject: mail.subject.replace(/[\r\n]+/g, " "),
    html: mail.html,
    text: mail.text,
    headers: mail.unsubscribeUrl
      ? { "List-Unsubscribe": `<${mail.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
      : undefined,
  });
}
