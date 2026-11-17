import nodemailer from 'nodemailer';

const NAME = process.env.EVENT_NAME || 'STEM Fusion Challenge: Think, Build, Prove';

export async function sendEmail(to: string, subject: string, text: string) {
  const from = process.env.MAIL_FROM || `${NAME} <no-reply@example.com>`;
  if (process.env.SMTP_URL) {
    const t = nodemailer.createTransport(process.env.SMTP_URL);
    await t.sendMail({ from, to, subject, text });
    return;
  }
  if (process.env.RESEND_API_KEY) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
    if (!r.ok) throw new Error(`Email provider error ${r.status}`);
    return;
  }
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[DEV EMAIL] to=${to} subject=${subject}\n${text}`);
    return;
  }
  throw new Error('No email provider configured (set RESEND_API_KEY or SMTP_URL)');
}

export async function sendOtpEmail(to: string, name: string, code: string) {
  await sendEmail(
    to,
    `Your login code: ${code}`,
    `Hello ${name},\n\nYour one-time login code for ${NAME} is ${code}.\nIt is valid for 10 minutes. If you did not request it, ignore this email.\n`,
  );
}
