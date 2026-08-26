import { Resend } from 'resend';
import type { EmailSender } from './auth.types.js';

export class ResendEmailSender implements EmailSender {
  private readonly resend: Resend | null;

  constructor(
    apiKey: string,
    private readonly from: string
  ) {
    this.resend = apiKey ? new Resend(apiKey) : null;
  }

  async sendPasswordReset(input: { to: string; name: string; resetUrl: string }) {
    if (!this.resend) {
      console.info(`Password reset requested for ${input.to}. Configure RESEND_API_KEY to send e-mail.`);
      return;
    }

    await this.resend.emails.send({
      from: this.from,
      to: input.to,
      subject: 'Redefinicao de senha - Paladar Buffet',
      html: `<p>Ola, ${input.name}.</p><p>Acesse este link para redefinir sua senha:</p><p><a href="${input.resetUrl}">Redefinir senha</a></p>`
    });
  }
}
