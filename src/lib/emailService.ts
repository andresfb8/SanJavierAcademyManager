/**
 * San Javier Academy Manager - Email Service
 * Handles transactional emails using Brevo (Sendinblue) API.
 */

const BREVO_API_KEY = import.meta.env.VITE_BREVO_API_KEY;
const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin;
const EMAIL_SENDER = import.meta.env.VITE_EMAIL_SENDER || 'no-reply@clubdepadelsanjavier.es';

interface SendEmailParams {
  to: { email: string; name?: string }[];
  subject: string;
  htmlContent: string;
}

export async function sendEmail({ to, subject, htmlContent }: SendEmailParams) {
  if (!BREVO_API_KEY) {
    console.warn('[EmailService] No Brevo API Key found. Skipping email.');
    return;
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { name: 'San Javier Academy', email: EMAIL_SENDER },
        to,
        subject,
        htmlContent,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[EmailService] Brevo API Error Detail:', errorData);
      throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.info('[EmailService] Email sent successfully:', result);
    return result;
  } catch (error) {
    console.error('[EmailService] Failed to send email:', error);
    throw error;
  }
}

/**
 * Sends a welcome invitation to a new player.
 */
export async function sendPlayerInvitation(player: { name: string; email: string }, activationToken: string) {
  const activationLink = `${APP_URL}/activar-cuenta?token=${activationToken}&email=${encodeURIComponent(player.email)}`;

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
      <div style="background-color: #059669; padding: 32px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">¡Bienvenido a San Javier Academy!</h1>
      </div>
      <div style="padding: 32px; color: #334155; line-height: 1.6;">
        <p>Hola <strong>${player.name}</strong>,</p>
        <p>Tu cuenta ha sido creada con éxito. Ahora puedes acceder a tu portal personal para gestionar tus clases, ver tus horarios y avisar de tu asistencia.</p>
        <div style="text-align: center; margin: 40px 0;">
          <a href="${activationLink}" style="background-color: #059669; color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: bold; display: inline-block;">Activar mi Portal</a>
        </div>
        <p style="font-size: 14px; color: #64748b;">Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
        <p style="font-size: 12px; color: #94a3b8; word-break: break-all;">${activationLink}</p>
      </div>
      <div style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0; font-size: 12px; color: #94a3b8;">© 2026 San Javier Academy Manager. Todos los derechos reservados.</p>
      </div>
    </div>
  `;

  return sendEmail({
    to: [{ email: player.email, name: player.name }],
    subject: '🎾 Activa tu portal de alumno - San Javier Academy',
    htmlContent,
  });
}
