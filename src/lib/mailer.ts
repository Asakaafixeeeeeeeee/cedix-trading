// Email delivery for verification codes and notifications.
// Uses SMTP when SMTP_HOST/SMTP_USER/SMTP_PASS are configured; otherwise runs in
// sandbox mode (no email sent — callers surface the code in the UI with a notice).

export function mailerConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendMail(to: string, subject: string, text: string): Promise<boolean> {
  if (!mailerConfigured()) return false;
  const nodemailer = await import('nodemailer');
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transport.sendMail({
    from: process.env.SMTP_FROM || `CediX <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
  });
  return true;
}
