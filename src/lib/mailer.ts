import nodemailer from 'nodemailer';

/**
 * SMTP is optional. With no SMTP_HOST configured we fall back to printing the
 * message to the server log — that keeps local development working without
 * credentials, but it is refused outside development so codes can never be
 * silently swallowed in production.
 */
const host = process.env.SMTP_HOST;
const port = Number(process.env.SMTP_PORT ?? 587);
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASSWORD;
const from = process.env.MAIL_FROM ?? user ?? 'no-reply@expense-tracker.local';

export const mailConfigured = Boolean(host && user && pass);

const transporter = mailConfigured
  ? nodemailer.createTransport({ host, port, secure: port === 465, auth: { user: user!, pass: pass! } })
  : null;

export async function sendMail(to: string, subject: string, text: string, html?: string) {
  if (!transporter) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Email is not configured on this server.');
    }
    // eslint-disable-next-line no-console
    console.log(`\n─── DEV EMAIL ───\nTo: ${to}\nSubject: ${subject}\n\n${text}\n─────────────────\n`);
    return;
  }
  await transporter.sendMail({ from, to, subject, text, html });
}

export function otpEmail(code: string, minutes: number) {
  const text =
    `Your Expense Tracker verification code is ${code}.\n\n` +
    `It expires in ${minutes} minutes. If you did not request this, ignore this email.`;
  const html =
    `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:420px">
       <h2 style="font-size:18px;margin:0 0 12px">Verify your email</h2>
       <p style="color:#52514e;margin:0 0 16px">Use this code to continue signing in to Expense Tracker.</p>
       <div style="font-size:30px;font-weight:600;letter-spacing:8px;padding:14px 18px;background:#f2f2ef;border-radius:10px;display:inline-block">${code}</div>
       <p style="color:#898781;font-size:13px;margin:16px 0 0">Expires in ${minutes} minutes. If you did not request this, ignore this email.</p>
     </div>`;
  return { text, html };
}
