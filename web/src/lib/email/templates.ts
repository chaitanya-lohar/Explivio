import type { EmailKind } from "./types.ts";

/*
 * Transactional email templates (F13): responsive HTML (tables, inline styles, no images, no tracking) plus a plain-text
 * version of the same words. Every value from outside (the user's name, links) is escaped for HTML; subjects are fixed
 * strings, so nothing a user types can reach an email header. No passwords, session ids or internal details.
 */

export type TemplateData = { name: string; link?: string; appUrl: string };
export type Rendered = { subject: string; html: string; text: string };

const VERIFY_HOURS = 24;
const RESET_MINUTES = 30;

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** A display name safe for any context: one line, no control characters, bounded. */
export function cleanName(name: string): string {
  const one = name.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return one || "there";
}

type Block = { subject: string; preheader: string; heading: string; paragraphs: string[]; action?: { label: string; href: string }; footnote: string };

function blocks(kind: EmailKind, d: TemplateData): Block {
  const name = cleanName(d.name);
  switch (kind) {
    case "verify_email":
      return {
        subject: "Verify your Explivio email address",
        preheader: "Confirm your email to activate your Explivio account.",
        heading: "Confirm your email address",
        paragraphs: [`Hi ${name},`, "Welcome to Explivio. Confirm your email address to activate your account and start creating videos."],
        action: { label: "Verify email address", href: d.link! },
        footnote: `This link works once and expires in ${VERIFY_HOURS} hours. If you didn't create an Explivio account, you can ignore this email.`,
      };
    case "reset_password":
      return {
        subject: "Reset your Explivio password",
        preheader: "Choose a new password for your Explivio account.",
        heading: "Reset your password",
        paragraphs: [`Hi ${name},`, "We received a request to reset the password for your Explivio account. Use the button below to choose a new one."],
        action: { label: "Choose a new password", href: d.link! },
        footnote: `This link works once and expires in ${RESET_MINUTES} minutes. If you didn't ask for this, ignore this email: your password stays the same.`,
      };
    case "password_changed":
      return {
        subject: "Your Explivio password was changed",
        preheader: "Your password was changed and you were signed out everywhere.",
        heading: "Your password was changed",
        paragraphs: [`Hi ${name},`, "The password for your Explivio account was just changed, and every device was signed out. You can sign in again with your new password."],
        action: { label: "Sign in", href: `${d.appUrl}/login` },
        footnote: `If you didn't change your password, reset it now at ${d.appUrl}/forgot-password: someone may have access to your email.`,
      };
    case "account_exists":
      return {
        subject: "Someone tried to create an Explivio account with your email",
        preheader: "Your email already has an Explivio account.",
        heading: "You already have an account",
        paragraphs: [`Hi ${name},`, "Someone tried to sign up for Explivio with this email address, which already has an account. Nothing was changed."],
        action: { label: "Sign in", href: `${d.appUrl}/login` },
        footnote: `Forgot your password? Reset it at ${d.appUrl}/forgot-password. If this wasn't you, you can ignore this email.`,
      };
  }
}

export function renderEmail(kind: EmailKind, data: TemplateData): Rendered {
  const b = blocks(kind, data);
  if (b.action && !/^https?:\/\/[^\s"<>]+$/.test(b.action.href)) throw new Error("Refusing to render an email with an invalid link.");
  const text = [b.heading, "", ...b.paragraphs.flatMap((p) => [p, ""]), ...(b.action ? [`${b.action.label}: ${b.action.href}`, ""] : []), b.footnote, "", "— Explivio"].join("\n");
  const button = b.action
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0"><tr><td style="border-radius:8px;background:#5b4dd6"><a href="${escapeHtml(b.action.href)}" style="display:inline-block;padding:14px 26px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px">${escapeHtml(b.action.label)}</a></td></tr></table>
<p style="margin:0 0 20px;font-size:13px;line-height:20px;color:#6b6b80">If the button doesn't work, copy this link into your browser:<br><a href="${escapeHtml(b.action.href)}" style="color:#5b4dd6;word-break:break-all">${escapeHtml(b.action.href)}</a></p>`
    : "";
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(b.subject)}</title></head>
<body style="margin:0;padding:0;background:#f3f2f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1b29">
<div style="display:none;max-height:0;overflow:hidden">${escapeHtml(b.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f2f8"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e4e2ef">
<tr><td style="padding:28px 32px 0;font-size:20px;font-weight:700;letter-spacing:-0.2px;color:#5b4dd6">Explivio</td></tr>
<tr><td style="padding:16px 32px 32px">
<h1 style="margin:0 0 16px;font-size:22px;line-height:30px;color:#1c1b29">${escapeHtml(b.heading)}</h1>
${b.paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:16px;line-height:24px">${escapeHtml(p)}</p>`).join("\n")}
${button}
<p style="margin:0;font-size:13px;line-height:20px;color:#6b6b80">${escapeHtml(b.footnote)}</p>
</td></tr></table>
<p style="margin:16px 0 0;font-size:12px;color:#8a889c">Explivio · AI educational videos · This is an automatic message about your account.</p>
</td></tr></table></body></html>`;
  return { subject: b.subject, html, text };
}
