import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type NovoContato = {
  pessoa_id: number; corretor: { nome: string; email: string }; imovel: { titulo: string };
  nome: string; telefone: string | null; email: string | null; mensagem: string | null;
};

const escapar = (texto: string) => texto.replace(/[&<>"']/g, (caractere) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[caractere]!);

/**
 * Aviso por e-mail ao corretor responsável quando chega contato pelo site (NOTIFY-001), pela API HTTP do Resend,
 * sem SDK. Sem `RESEND_API_KEY` e `AVISO_EMAIL_REMETENTE`, o aviso fica desligado. Nunca derruba o cadastro do
 * contato: falhas vão ao log só com o id da pessoa, sem dados pessoais nem segredo.
 */
@Injectable()
export class AvisosService {
  private readonly logger = new Logger(AvisosService.name);
  constructor(private readonly configuracao: ConfigService) {}

  /** Dispara sem esperar: quem chama já confirmou a transação e não deve atrasar a resposta ao visitante. */
  novoContato(contato: NovoContato): void {
    void this.enviarNovoContato(contato);
  }

  private async enviarNovoContato(contato: NovoContato): Promise<void> {
    const chave = this.configuracao.get<string>('RESEND_API_KEY');
    const remetente = this.configuracao.get<string>('AVISO_EMAIL_REMETENTE');
    if (!chave || !remetente) return;
    // A primeira origem permitida é o endereço do site; o painel fica em /admin.
    const origem = this.configuracao.getOrThrow<string>('ALLOWED_ORIGINS').split(',')[0].trim().replace(/\/$/, '');
    const painel = `${origem}/admin/contatos`;
    const linhas: [string, string | null][] = [
      ['Imóvel', contato.imovel.titulo], ['Nome', contato.nome], ['Telefone', contato.telefone],
      ['E-mail', contato.email], ['Mensagem', contato.mensagem],
    ];
    const preenchidas = linhas.filter((linha): linha is [string, string] => Boolean(linha[1]));
    const html = `<p>Olá, ${escapar(contato.corretor.nome)}. Chegou um novo contato pelo site.</p>`
      + `<table cellpadding="6" style="border-collapse:collapse">${preenchidas.map(([rotulo, valor]) => `<tr><th align="left" valign="top">${rotulo}</th><td style="white-space:pre-wrap">${escapar(valor)}</td></tr>`).join('')}</table>`
      + `<p><a href="${escapar(painel)}">Abrir contatos no painel</a></p>`;
    const texto = [`Olá, ${contato.corretor.nome}. Chegou um novo contato pelo site.`, '', ...preenchidas.map(([rotulo, valor]) => `${rotulo}: ${valor}`), '', `Painel: ${painel}`].join('\n');
    try {
      const resposta = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: remetente, to: [contato.corretor.email], subject: `Novo contato: ${contato.imovel.titulo}`.slice(0, 200), html, text: texto,
          ...(contato.email ? { reply_to: contato.email } : {}),
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!resposta.ok) this.logger.warn(`Aviso de novo contato não enviado (pessoa ${contato.pessoa_id}): Resend respondeu ${resposta.status}.`);
    } catch {
      this.logger.warn(`Aviso de novo contato não enviado (pessoa ${contato.pessoa_id}): falha de rede ou tempo esgotado.`);
    }
  }
}
