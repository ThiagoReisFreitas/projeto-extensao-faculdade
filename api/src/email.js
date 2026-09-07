// Envio de e-mail. Ligado quando RESEND_API_KEY existe no .env; senao so registra no log.
// Trocar o provider (SMTP/SES) = mexer so aqui, as rotas nao mudam.

const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.MAIL_FROM || 'O Pensador <no-reply@opensador.local>';

// true quando o envio real esta configurado (o front usa via GET /auth/config)
export const emailAtivo = () => !!RESEND_KEY;

export async function enviarEmail({ para, assunto, texto }) {
  if (!RESEND_KEY) {
    console.log(`[email:stub] para=${para} assunto="${assunto}"\n${texto}\n`);
    return;
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: para, subject: assunto, text: texto }),
  });
  if (!r.ok) console.error(`[email] falha ao enviar (${r.status}): ${await r.text()}`);
}

export async function notificarReset(user, token) {
  const base = process.env.APP_URL || 'http://localhost:8080';
  const url = `${base}/reset/${token}`;
  await enviarEmail({
    para: user.email,
    assunto: 'Redefinição de senha — O Pensador',
    texto: `Abra este link para definir uma nova senha (expira em 1 hora):\n${url}\n\n`
      + 'Se você não pediu isso, ignore este e-mail.',
  });
}
