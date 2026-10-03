import 'dotenv/config';
import { Client } from 'pg';
import * as argon2 from 'argon2';

interface SeedResult {
  corretores: number;
  caracteristicas: number;
  pessoas: number;
  imoveis: number;
  midias: number;
  contratos: number;
  comissoes: number;
  parcelas: number;
}

export async function executarSeed(): Promise<SeedResult> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL não configurada no ambiente.');
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('✓ Conectado ao banco de dados PostgreSQL.');

  const senhaPadraoHash = await argon2.hash('03032005Edu@', { type: argon2.argon2id });

  try {
    await client.query('BEGIN');

    // 1. CARACTERÍSTICAS
    console.log('Populando características...');
    const listaCaracteristicas = [
      { nome: 'Estacionamento para Clientes', icone: 'Car' },
      { nome: 'Ar-condicionado Central', icone: 'Wind' },
      { nome: 'Pé-direito Duplo (7m+)', icone: 'ArrowUpDown' },
      { nome: 'Docas para Carga e Descarga', icone: 'Truck' },
      { nome: 'Piso de Alta Resistência (5 ton/m²)', icone: 'Layers' },
      { nome: 'Energia Solar Fotovoltaica', icone: 'Sun' },
      { nome: 'Portaria e Segurança 24h', icone: 'ShieldCheck' },
      { nome: 'Acessibilidade PCD', icone: 'Accessibility' },
      { nome: 'Sistema de Câmeras e Alarme', icone: 'Video' },
      { nome: 'Mezanino Corporativo', icone: 'Building' },
      { nome: 'Refeitório e Vestiários', icone: 'Coffee' },
      { nome: 'Gerador Próprio de Energia', icone: 'Zap' },
    ];

    const mapaCaracteristicas = new Map<string, number>();
    for (const c of listaCaracteristicas) {
      const res = await client.query(
        `INSERT INTO caracteristicas (nome, icone, ativo, criado_em, alterado_em, criado_por, alterado_por)
         VALUES ($1, $2, true, now(), now(), 1, 1)
         ON CONFLICT (nome) DO UPDATE SET icone = EXCLUDED.icone, ativo = true
         RETURNING id, nome`,
        [c.nome, c.icone]
      );
      mapaCaracteristicas.set(res.rows[0].nome, res.rows[0].id);
    }
    console.log(`✓ ${mapaCaracteristicas.size} características prontas.`);

    // 2. CORRETORES / USUÁRIOS
    console.log('Populando corretores/usuários...');
    const listaCorretores = [
      {
        nome: 'Lucas Gobatto',
        email: 'lucas.gobatto@corretor.com.br',
        cpf: '04285194103',
        whatsapp: '5566999881577',
        creci: '15776-MT',
        cargo: 'CORRETOR',
        url_foto: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&q=80',
      },
      {
        nome: 'Mariana Silveira',
        email: 'mariana.silveira@corretor.com.br',
        cpf: '85317496104',
        whatsapp: '5566996541234',
        creci: '18420-MT',
        cargo: 'CORRETOR',
        url_foto: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
      },
      {
        nome: 'Carlos Eduardo Mendes',
        email: 'carlos.mendes@corretor.com.br',
        cpf: '72491823100',
        whatsapp: '5566997123456',
        creci: '12390-MT',
        cargo: 'ADMIN',
        url_foto: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80',
      },
    ];

    const mapaCorretores = new Map<string, number>();
    // Pegar existentes também
    const corretoresExistentes = await client.query('SELECT id, email FROM corretores WHERE ativo = true');
    for (const r of corretoresExistentes.rows) {
      mapaCorretores.set(r.email, r.id);
    }

    for (const c of listaCorretores) {
      const res = await client.query(
        `INSERT INTO corretores (nome, email, senha_hash, cpf, whatsapp, creci, cargo, url_foto, ativo, criado_em, alterado_em, criado_por, alterado_por)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, now(), now(), 1, 1)
         ON CONFLICT (email) DO UPDATE SET
           nome = EXCLUDED.nome,
           cpf = EXCLUDED.cpf,
           whatsapp = EXCLUDED.whatsapp,
           creci = EXCLUDED.creci,
           cargo = EXCLUDED.cargo,
           url_foto = EXCLUDED.url_foto,
           ativo = true
         RETURNING id, email`,
        [c.nome, c.email, senhaPadraoHash, c.cpf, c.whatsapp, c.creci, c.cargo, c.url_foto]
      );
      mapaCorretores.set(res.rows[0].email, res.rows[0].id);
    }
    console.log(`✓ ${mapaCorretores.size} corretores mapeados.`);

    const corretorPrincipalId = mapaCorretores.get('eduardogobt@gmail.com') || 1;
    const corretorLucasId = mapaCorretores.get('lucas.gobatto@corretor.com.br') || corretorPrincipalId;
    const corretoraMarianaId = mapaCorretores.get('mariana.silveira@corretor.com.br') || corretorPrincipalId;

    // 3. PESSOAS (Proprietários, Inquilinos, Clientes e Leads)
    console.log('Populando pessoas e contatos de clientes...');
    const listaPessoas = [
      // Proprietários
      {
        nome: 'Roberto Alcantara Fagundes',
        telefone: '66998123344',
        email: 'roberto.fagundes@agroinvest.com.br',
        tipo_pessoa: 'PF',
        cpf_cnpj: '19482736109',
        data_nascimento: '1975-04-12',
        endereco: 'Av. das Acácias, 1420 - Centro, Sinop/MT',
        banco_nome: 'Banco do Brasil',
        banco_agencia: '1234-5',
        banco_conta: '54321-0',
        chave_pix: 'roberto.fagundes@agroinvest.com.br',
        observacoes: 'Proprietário de 2 galpões no setor industrial e salão comercial de esquina.',
        mensagem: null,
        imovel_id: null,
        corretor_id: corretorLucasId,
        origem: 'MANUAL',
        status_contato: 'FINALIZADO',
        consentimento: false,
        consentimento_ip: null,
        consentimento_em: null,
        versao_termos: null,
      },
      {
        nome: 'Agropecuária & Logística Pioneira Ltda',
        telefone: '6635319900',
        email: 'diretoria@logisticapioneira.com.br',
        tipo_pessoa: 'PJ',
        cpf_cnpj: '03847291000185',
        data_nascimento: null,
        endereco: 'Rodovia MT-220, Km 4, Distrito Industrial, Sinop/MT',
        banco_nome: 'Sicredi',
        banco_agencia: '0810',
        banco_conta: '98765-4',
        chave_pix: '03847291000185',
        observacoes: 'Grupo empresarial focado em infraestrutura logística e galpões industriais no Nortão.',
        mensagem: null,
        imovel_id: null,
        corretor_id: corretorPrincipalId,
        origem: 'MANUAL',
        status_contato: 'FINALIZADO',
        consentimento: false,
        consentimento_ip: null,
        consentimento_em: null,
        versao_termos: null,
      },
      {
        nome: 'Dra. Helena Martins Vasconcelos',
        telefone: '66997445566',
        email: 'helena.vasconcelos@advocacia.med.br',
        tipo_pessoa: 'PF',
        cpf_cnpj: '92817364100',
        data_nascimento: '1982-08-25',
        endereco: 'Rua das Nogueiras, 850 - Jardim Botânico, Sinop/MT',
        banco_nome: 'Itaú Unibanco',
        banco_agencia: '4321',
        banco_conta: '11223-4',
        chave_pix: '66997445566',
        observacoes: 'Proprietária de prédio corporativo e salas comerciais para locação.',
        mensagem: null,
        imovel_id: null,
        corretor_id: corretoraMarianaId,
        origem: 'MANUAL',
        status_contato: 'FINALIZADO',
        consentimento: false,
        consentimento_ip: null,
        consentimento_em: null,
        versao_termos: null,
      },
      // Inquilinos
      {
        nome: 'Distribuidora de Peças Agrícolas Norte Ltda',
        telefone: '6635214400',
        email: 'financeiro@pecasnorte.com.br',
        tipo_pessoa: 'PJ',
        cpf_cnpj: '12345678000195',
        data_nascimento: null,
        endereco: 'Av. dos Jacarandás, 2200 - Setor Industrial, Sinop/MT',
        banco_nome: 'Bradesco',
        banco_agencia: '2345',
        banco_conta: '67890-1',
        chave_pix: 'financeiro@pecasnorte.com.br',
        observacoes: 'Inquilino pontual, locação de galpão para armazenagem e distribuição de implementos.',
        mensagem: null,
        imovel_id: null,
        corretor_id: corretorLucasId,
        origem: 'MANUAL',
        status_contato: 'FINALIZADO',
        consentimento: false,
        consentimento_ip: null,
        consentimento_em: null,
        versao_termos: null,
      },
      {
        nome: 'Dr. Marcos Vinicius Queiroz',
        telefone: '66996332211',
        email: 'marcos.queiroz@odontoclinic.com.br',
        tipo_pessoa: 'PF',
        cpf_cnpj: '38471928105',
        data_nascimento: '1988-11-03',
        endereco: 'Rua das Figueiras, 410, Sala 302 - Centro, Sinop/MT',
        banco_nome: 'Santander',
        banco_agencia: '3456',
        banco_conta: '78901-2',
        chave_pix: 'marcos.queiroz@odontoclinic.com.br',
        observacoes: 'Cirurgião-dentista, locatário de casa comercial adaptada para clínica integrada.',
        mensagem: null,
        imovel_id: null,
        corretor_id: corretorLucasId,
        origem: 'MANUAL',
        status_contato: 'FINALIZADO',
        consentimento: false,
        consentimento_ip: null,
        consentimento_em: null,
        versao_termos: null,
      },
      // Leads do Site e Contatos Comerciais
      {
        nome: 'Fernando Rossi Medeiros',
        telefone: '66999112233',
        email: 'fernando.rossi@agrotransp.com.br',
        tipo_pessoa: 'PF',
        cpf_cnpj: '67182934102',
        data_nascimento: '1984-06-18',
        endereco: 'Av. Dom Henrique Froehlich, 770 - Jardim Maringá, Sinop/MT',
        banco_nome: null,
        banco_agencia: null,
        banco_conta: null,
        chave_pix: null,
        observacoes: 'Diretor de logística buscando expansão de frota e armazenagem climatizada.',
        mensagem: 'Olá! Tenho muito interesse no Galpão Logístico Modular na MT-220. Gostaria de agendar uma visita presencial nesta quinta-feira e saber se há carência para montagem de porta-paletes.',
        imovel_id: null,
        corretor_id: corretorLucasId,
        origem: 'SITE',
        status_contato: 'PENDENTE',
        consentimento: true,
        consentimento_ip: '177.136.241.10',
        consentimento_em: new Date('2026-10-01T15:30:00Z'),
        versao_termos: 'v1.0',
      },
      {
        nome: 'Camila Beatriz Fontana',
        telefone: '66998774411',
        email: 'camila.fontana@studiodesign.com.br',
        tipo_pessoa: 'PF',
        cpf_cnpj: '58291037108',
        data_nascimento: '1992-09-05',
        endereco: 'Rua das Macaúbas, 340 - Setor Residencial Sul, Sinop/MT',
        banco_nome: null,
        banco_agencia: null,
        banco_conta: null,
        chave_pix: null,
        observacoes: 'Arquiteta titular de escritório de design de interiores em expansão.',
        mensagem: 'Boa tarde! Vi o anúncio da Sala Corporativa no Edifício Prime Corporate. O condomínio tem vaga coberta privativa e permite instalação de divisórias acústicas de vidro? Gostaria de visitar amanhã.',
        imovel_id: null,
        corretor_id: corretoraMarianaId,
        origem: 'SITE',
        status_contato: 'PENDENTE',
        consentimento: true,
        consentimento_ip: '189.40.112.55',
        consentimento_em: new Date('2026-10-02T10:15:00Z'),
        versao_termos: 'v1.0',
      },
      {
        nome: 'Thiago Mendonça Alencar',
        telefone: '66996558899',
        email: 'thiago.alencar@superfrango.com.br',
        tipo_pessoa: 'PF',
        cpf_cnpj: '49281736104',
        data_nascimento: '1979-03-22',
        endereco: 'Av. André Maggi, 1200 - Setor Comercial, Sinop/MT',
        banco_nome: null,
        banco_agencia: null,
        banco_conta: null,
        chave_pix: null,
        observacoes: 'Investidor interessado em terrenos às margens da BR-163 para entreposto de distribuição de perecíveis.',
        mensagem: 'Bom dia! Estou avaliando terrenos industriais para centro de distribuição regional em Sinop ou Sorriso. Vi o terreno no Eixo BR-163. Poderiam me encaminhar a certidão de zoneamento e o laudo de avaliação?',
        imovel_id: null,
        corretor_id: corretorPrincipalId,
        origem: 'SITE',
        status_contato: 'PENDENTE',
        consentimento: true,
        consentimento_ip: '201.86.32.190',
        consentimento_em: new Date('2026-10-02T18:45:00Z'),
        versao_termos: 'v1.0',
      },
      {
        nome: 'Patrícia Bueno Zanin',
        telefone: '66997223344',
        email: 'patricia.zanin@clinicaestetica.com.br',
        tipo_pessoa: 'PF',
        cpf_cnpj: '73928164106',
        data_nascimento: '1986-12-14',
        endereco: 'Av. das Sibipirunas, 980 - Jardim Botânico, Sinop/MT',
        banco_nome: null,
        banco_agencia: null,
        banco_conta: null,
        chave_pix: null,
        observacoes: 'Primeiro contato recebido pelo site. Atendida pela Mariana Silveira via WhatsApp. Visita agendada.',
        mensagem: 'Olá, tenho grande interesse no Ponto Comercial de Esquina na Av. Júlio Campos para filial de clínica dermatológica. Poderia me confirmar se aceita fiador bancário?',
        imovel_id: null,
        corretor_id: corretoraMarianaId,
        origem: 'SITE',
        status_contato: 'RESPONDIDO',
        consentimento: true,
        consentimento_ip: '179.180.45.67',
        consentimento_em: new Date('2026-09-28T14:20:00Z'),
        versao_termos: 'v1.0',
      },
      {
        nome: 'Gustavo Barreto Siqueira',
        telefone: '66999447788',
        email: 'gustavo@siqueiratransportes.com.br',
        tipo_pessoa: 'PF',
        cpf_cnpj: '84729163101',
        data_nascimento: '1981-05-30',
        endereco: 'Rua dos Cajueiros, 550 - Setor Industrial, Sinop/MT',
        banco_nome: null,
        banco_agencia: null,
        banco_conta: null,
        chave_pix: null,
        observacoes: 'Diretor presidente da Siqueira Transportes. Análise de documentação do Prédio Comercial em andamento pelo jurídico.',
        mensagem: 'Interesse de compra do Prédio Comercial Corporativo no Centro Cívico. Solicitou matrícula atualizada com negativa de ônus e certidões cíveis para apresentação à diretoria.',
        imovel_id: null,
        corretor_id: corretorLucasId,
        origem: 'SITE',
        status_contato: 'RESPONDIDO',
        consentimento: true,
        consentimento_ip: '177.68.99.12',
        consentimento_em: new Date('2026-09-26T11:00:00Z'),
        versao_termos: 'v1.0',
      },
      {
        nome: 'Mariane Costa Rezende',
        telefone: '66996885522',
        email: 'mariane.rezende@contabilidade.com.br',
        tipo_pessoa: 'PF',
        cpf_cnpj: '95827163103',
        data_nascimento: '1995-02-17',
        endereco: 'Rua das Araribas, 727, Apto 2 - Jardim das Palmeiras, Sinop/MT',
        banco_nome: null,
        banco_agencia: null,
        banco_conta: null,
        chave_pix: null,
        observacoes: 'Contrato de locação firmado com sucesso. Locatária do imóvel Kitnet 32m².',
        mensagem: 'Gostaria de agendar visita na Kitnet da Rua das Araribas.',
        imovel_id: 2,
        corretor_id: corretorPrincipalId,
        origem: 'SITE',
        status_contato: 'FINALIZADO',
        consentimento: true,
        consentimento_ip: '186.230.15.80',
        consentimento_em: new Date('2026-08-01T09:30:00Z'),
        versao_termos: 'v1.0',
      },
      {
        nome: 'Empresa Vale do Teles Pires Grãos S.A.',
        telefone: '6635118800',
        email: 'compras@valetelespires.com.br',
        tipo_pessoa: 'PJ',
        cpf_cnpj: '98765432000109',
        data_nascimento: null,
        endereco: 'Av. dos Tarumãs, 2100 - Setor Comercial, Sinop/MT',
        banco_nome: 'Banco do Brasil',
        banco_agencia: '0485',
        banco_conta: '33445-5',
        chave_pix: '98765432000109',
        observacoes: 'Negociação comercial de venda concluída e honorários de corretagem quitados.',
        mensagem: 'Aquisição de área comercial e estruturação da nova sede regional.',
        imovel_id: null,
        corretor_id: corretorLucasId,
        origem: 'MANUAL',
        status_contato: 'FINALIZADO',
        consentimento: false,
        consentimento_ip: null,
        consentimento_em: null,
        versao_termos: null,
      },
    ];

    const mapaPessoas = new Map<string, number>();
    for (const p of listaPessoas) {
      // Verificar se já existe por email ou nome
      const check = await client.query('SELECT id FROM pessoas WHERE email = $1 OR (email IS NULL AND nome = $2)', [p.email, p.nome]);
      let pessoaId: number;
      if (check.rows.length > 0) {
        pessoaId = check.rows[0].id;
        await client.query(
          `UPDATE pessoas SET
             telefone = $1, tipo_pessoa = $2, cpf_cnpj = $3, data_nascimento = $4, endereco = $5,
             banco_nome = $6, banco_agencia = $7, banco_conta = $8, chave_pix = $9, observacoes = $10,
             mensagem = $11, corretor_id = $12, status_contato = $13, alterado_em = now()
           WHERE id = $14`,
          [p.telefone, p.tipo_pessoa, p.cpf_cnpj, p.data_nascimento, p.endereco, p.banco_nome, p.banco_agencia, p.banco_conta, p.chave_pix, p.observacoes, p.mensagem, p.corretor_id, p.status_contato, pessoaId]
        );
      } else {
        const res = await client.query(
          `INSERT INTO pessoas (
             nome, telefone, email, tipo_pessoa, cpf_cnpj, data_nascimento, endereco,
             banco_nome, banco_agencia, banco_conta, chave_pix, observacoes, mensagem,
             imovel_id, corretor_id, origem, status_contato,
             consentimento, consentimento_ip, consentimento_em, versao_termos,
             ativo, criado_em, alterado_em, criado_por, alterado_por
           ) VALUES (
             $1, $2, $3, $4, $5, $6, $7,
             $8, $9, $10, $11, $12, $13,
             $14, $15, $16, $17,
             $18, $19, $20, $21,
             true, now(), now(), 1, 1
           ) RETURNING id`,
          [
            p.nome, p.telefone, p.email, p.tipo_pessoa, p.cpf_cnpj, p.data_nascimento, p.endereco,
            p.banco_nome, p.banco_agencia, p.banco_conta, p.chave_pix, p.observacoes, p.mensagem,
            p.imovel_id, p.corretor_id, p.origem, p.status_contato,
            p.consentimento, p.consentimento_ip, p.consentimento_em, p.versao_termos,
          ]
        );
        pessoaId = res.rows[0].id;
      }
      mapaPessoas.set(p.nome, pessoaId);
    }
    console.log(`✓ ${mapaPessoas.size} pessoas cadastradas/atualizadas.`);

    const idProprietarioRoberto = mapaPessoas.get('Roberto Alcantara Fagundes')!;
    const idProprietarioPioneira = mapaPessoas.get('Agropecuária & Logística Pioneira Ltda')!;
    const idProprietarioHelena = mapaPessoas.get('Dra. Helena Martins Vasconcelos')!;
    const idLocatarioMarcos = mapaPessoas.get('Dr. Marcos Vinicius Queiroz')!;
    const idLocatarioPecas = mapaPessoas.get('Distribuidora de Peças Agrícolas Norte Ltda')!;
    const idLocatarioMariane = mapaPessoas.get('Mariane Costa Rezende')!;
    const idClienteTelesPires = mapaPessoas.get('Empresa Vale do Teles Pires Grãos S.A.')!;

    // 4. IMÓVEIS COMPLETOS (Pelo menos 5 novos)
    console.log('Populando imóveis comerciais e residenciais completos...');
    const novosImoveis = [
      {
        titulo: 'Galpão Logístico Modular de Alto Padrão - Setor Industrial',
        slugBase: 'galpao-logistico-modular-alto-padrao-setor-industrial',
        tipo_id: 2, // Galpão
        finalidade_id: 2, // Locação
        valor_venda: null,
        valor_locacao: '28500.00',
        valor_condominio: '2400.00',
        valor_iptu: '850.00',
        area_util: '1850.00',
        area_total: '3200.00',
        cep: '78550-000',
        logradouro: 'Rodovia MT-220, Km 2',
        numero: '4500',
        complemento: 'Módulo 01',
        bairro: 'Distrito Industrial',
        cidade: 'Sinop',
        estado: 'MT',
        descricao: 'Excelente galpão logístico e industrial modular construído em estrutura pré-moldada de concreto com pé-direito livre de 9 metros. Possui piso industrial nivelado a laser com capacidade de carga de 6 ton/m², 4 docas elevadas para carretas com niveladores eletro-hidráulicos, amplo pátio de manobras pavimentado para bitrens, subestação transformadora própria de 300 kVA e sistema completo de combate a incêndio com hidrantes e reservatório exclusivo de 45.000 litros. Bloco administrativo com recepção, mezanino climatizado para escritórios, refeitório estruturado, vestiários masculinos e femininos com chuveiros e guarita de controle de acesso 24h. Localização estratégica com saída direta para a MT-220 e fácil acesso à BR-163.',
        status: 'DISPONIVEL',
        destaque: true,
        corretor_id: corretorLucasId,
        proprietario_id: idProprietarioPioneira,
        exclusividade: true,
        exclusividade_ate: '2027-12-31',
        data_captacao: '2026-08-15',
        chaves: 'Portaria principal do condomínio industrial, autorização prévia por WhatsApp.',
        matricula: 'Matrícula nº 62.418 - Livro 2 do Cartório de Registro de Imóveis de Sinop/MT',
        inscricao_municipal: 'IM-2026-981240',
        observacoes_internas: 'Laudo de avaliação mercadológica realizado em 10/08/2026 pelo perito avaliador imobiliário (CNAI 34812). Valor locativo apurado entre R$ 26.000 e R$ 30.000. Proprietário aceita propostas com até 60 dias de carência em contratos de longo prazo (mínimo 36 meses). Instalações elétricas recém-revisadas e AVCB válido até 2027.',
        motivo_baixa: null,
        caracteristicas: [
          { nome: 'Pé-direito Duplo (7m+)', valor: '9 metros livres' },
          { nome: 'Docas para Carga e Descarga', valor: '4 docas com nivelador' },
          { nome: 'Piso de Alta Resistência (5 ton/m²)', valor: '6 ton/m² laser' },
          { nome: 'Portaria e Segurança 24h', valor: 'Guarita blindada' },
          { nome: 'Refeitório e Vestiários', valor: 'Capacidade 40 pessoas' },
          { nome: 'Mezanino Corporativo', valor: '180 m² climatizado' },
          { nome: 'Energia Solar Fotovoltaica', valor: 'Geração 15 kWp' },
        ],
        midias: [
          { url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80', capa: true, ordem: 0 },
          { url: 'https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=1200&q=80', capa: false, ordem: 1 },
          { url: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=1200&q=80', capa: false, ordem: 2 },
          { url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80', capa: false, ordem: 3 },
        ],
      },
      {
        titulo: 'Sala Comercial Executiva no Edifício Prime Corporate',
        slugBase: 'sala-comercial-executiva-edificio-prime-corporate',
        tipo_id: 4, // Sala Comercial
        finalidade_id: 2, // Locação
        valor_venda: null,
        valor_locacao: '3800.00',
        valor_condominio: '680.00',
        valor_iptu: '220.00',
        area_util: '78.50',
        area_total: '105.00',
        cep: '78550-100',
        logradouro: 'Av. das Embaúbas',
        numero: '1200',
        complemento: 'Sala 804',
        bairro: 'Setor Comercial',
        cidade: 'Sinop',
        estado: 'MT',
        descricao: 'Moderna sala corporativa no 8º andar do Edifício Prime Corporate, um dos endereços empresariais mais nobres de Sinop. O imóvel conta com acabamento de alto padrão, piso em porcelanato acetinado 90x90cm, forro em gesso com projeto luminotécnico em LED dimerizável, pré-instalação para 3 máquinas de ar-condicionado split inverter e copa integrada com bancada em granito São Gabriel. Possui 2 lavabos individuais (sendo um adaptado para PCD) e ampla vista panorâmica da cidade através de pele de vidro com tratamento termoacústico. O edifício dispõe de portaria com catracas eletrônicas e leitor facial, 3 elevadores inteligentes de alta velocidade, auditório mobiliado para 80 pessoas e 2 vagas de garagem privativas cobertas no subsolo.',
        status: 'DISPONIVEL',
        destaque: true,
        corretor_id: corretoraMarianaId,
        proprietario_id: idProprietarioHelena,
        exclusividade: true,
        exclusividade_ate: '2027-06-30',
        data_captacao: '2026-09-01',
        chaves: 'Imobiliária - Claviculário gaveta 3, chave 18B.',
        matricula: 'Matrícula nº 41.520 - CRI Sinop',
        inscricao_municipal: 'IM-2026-773190',
        observacoes_internas: 'Avaliação técnica realizada pela equipe interna. Imóvel desocupado e recém-pintado com tinta Suvinil fosca lavável. Excelente taxa de retorno locatício. Condomínio com água inclusa.',
        motivo_baixa: null,
        caracteristicas: [
          { nome: 'Ar-condicionado Central', valor: 'Split Inverter instalado' },
          { nome: 'Acessibilidade PCD', valor: 'Lavabo adaptado e rampas' },
          { nome: 'Estacionamento para Clientes', valor: '2 vagas privativas cobertas' },
          { nome: 'Portaria e Segurança 24h', valor: 'Leitor facial e catracas' },
          { nome: 'Sistema de Câmeras e Alarme', valor: 'CFTV nos corredores' },
        ],
        midias: [
          { url: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=1200&q=80', capa: true, ordem: 0 },
          { url: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1200&q=80', capa: false, ordem: 1 },
          { url: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1200&q=80', capa: false, ordem: 2 },
          { url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80', capa: false, ordem: 3 },
        ],
      },
      {
        titulo: 'Ponto Comercial de Esquina - Av. Júlio Campos',
        slugBase: 'ponto-comercial-de-esquina-av-julio-campos',
        tipo_id: 3, // Loja
        finalidade_id: 1, // Locação e Venda
        valor_venda: '2450000.00',
        valor_locacao: '14000.00',
        valor_condominio: null,
        valor_iptu: '580.00',
        area_util: '380.00',
        area_total: '520.00',
        cep: '78550-010',
        logradouro: 'Av. Governador Júlio Campos',
        numero: '890',
        complemento: 'Esquina',
        bairro: 'Centro',
        cidade: 'Sinop',
        estado: 'MT',
        descricao: 'Ponto comercial de esquina em localização super premium, situado na avenida de maior fluxo comercial e pedestre de Sinop. Fachada monumental envidraçada de 28 metros lineares de testada com excelente visibilidade para marcas de varejo, bancos, farmácias, clínicas ou franquias nacionais. Salão principal em vão livre com piso em granito polido, mezanino reforçado para estoque ou administrativo, 3 sanitários, copa para funcionários, portas de enrolar automáticas microperfuradas e estacionamento frontal recuado para até 6 veículos com piso intertravado. Rede elétrica trifásica com transformador próprio de 75 kVA.',
        status: 'DISPONIVEL',
        destaque: true,
        corretor_id: corretorLucasId,
        proprietario_id: idProprietarioRoberto,
        exclusividade: false,
        exclusividade_ate: null,
        data_captacao: '2026-07-20',
        chaves: 'Com o proprietário (Roberto Fagundes), agendar 1 dia antes.',
        matricula: 'Matrícula nº 19.344 - 1º Ofício Sinop',
        inscricao_municipal: 'IM-2026-114820',
        observacoes_internas: 'Avaliação imobiliária consolidada em R$ 2.400.000 para venda à vista e R$ 14.500 para locação mensal. Imóvel muito cobiçado por redes de farmácias e cooperativas de crédito. Regularizado com habite-se comercial e projeto de bombeiros aprovado.',
        motivo_baixa: null,
        caracteristicas: [
          { nome: 'Estacionamento para Clientes', valor: '6 vagas frontais recuadas' },
          { nome: 'Acessibilidade PCD', valor: 'Rampa e portas amplas' },
          { nome: 'Energia Solar Fotovoltaica', valor: 'Economia estimada de 80%' },
          { nome: 'Sistema de Câmeras e Alarme', valor: 'Monitoramento 24h' },
          { nome: 'Mezanino Corporativo', valor: '110 m² com copa e banheiro' },
        ],
        midias: [
          { url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80', capa: true, ordem: 0 },
          { url: 'https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?auto=format&fit=crop&w=1200&q=80', capa: false, ordem: 1 },
          { url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80', capa: false, ordem: 2 },
          { url: 'https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?auto=format&fit=crop&w=1200&q=80', capa: false, ordem: 3 },
        ],
      },
      {
        titulo: 'Prédio Comercial Monousuário - Centro Cívico',
        slugBase: 'predio-comercial-monousuario-centro-civico',
        tipo_id: 5, // Prédio
        finalidade_id: 3, // Venda
        valor_venda: '6800000.00',
        valor_locacao: null,
        valor_condominio: null,
        valor_iptu: '1450.00',
        area_util: '1420.00',
        area_total: '1650.00',
        cep: '78550-120',
        logradouro: 'Av. das Figueiras',
        numero: '1450',
        complemento: null,
        bairro: 'Centro Cívico',
        cidade: 'Sinop',
        estado: 'MT',
        descricao: 'Imponente edifício corporativo monousuário composto por térreo comercial com recepção e mezanino, mais 3 pavimentos tipo em vão livre e cobertura técnica. Estrutura concebida para sedes corporativas de multinacionais do agronegócio, cooperativas de crédito, órgãos públicos ou instituições de ensino superior. O imóvel possui elevador panorâmico Atlas Schindler com capacidade para 10 passageiros, cabeamento estruturado Cat6 em canaletas de piso elevado, salas de reunião com isolamento acústico, 12 banheiros distribuídos nos andares, refeitório com área de descompressão e terraço privativo na cobertura. Garagem privativa no subsolo para 20 automóveis e bicicletário.',
        status: 'DISPONIVEL',
        destaque: true,
        corretor_id: corretorLucasId,
        proprietario_id: idProprietarioHelena,
        exclusividade: true,
        exclusividade_ate: '2027-12-31',
        data_captacao: '2026-06-10',
        chaves: 'Com corretor Lucas Gobatto, cópia na imobiliária.',
        matricula: 'Matrícula nº 55.901 - CRI Sinop',
        inscricao_municipal: 'IM-2026-339841',
        observacoes_internas: 'Laudo de avaliação patrimonial engenharia civil (CREA-MT 12894) em R$ 7.100.000. Proprietário estuda permuta em até 30% por imóveis rurais ou grãos (soja/milho) em armazém credenciado.',
        motivo_baixa: null,
        caracteristicas: [
          { nome: 'Estacionamento para Clientes', valor: '20 vagas no subsolo' },
          { nome: 'Ar-condicionado Central', valor: 'Sistema VRF Daikin' },
          { nome: 'Acessibilidade PCD', valor: 'Elevador panorâmico' },
          { nome: 'Portaria e Segurança 24h', valor: 'Recepção controlada' },
          { nome: 'Gerador Próprio de Energia', valor: 'Cummins 250 kVA' },
          { nome: 'Refeitório e Vestiários', valor: 'Área de descompressão' },
          { nome: 'Mezanino Corporativo', valor: 'Piso elevado Cat6' },
        ],
        midias: [
          { url: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80', capa: true, ordem: 0 },
          { url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80', capa: false, ordem: 1 },
          { url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80', capa: false, ordem: 2 },
          { url: 'https://images.unsplash.com/photo-1577495508048-b635879837f1?auto=format&fit=crop&w=1200&q=80', capa: false, ordem: 3 },
        ],
      },
      {
        titulo: 'Terreno Comercial e Industrial na BR-163 - Eixo Estratégico',
        slugBase: 'terreno-comercial-industrial-br-163-eixo-estrategico',
        tipo_id: 1, // Terreno
        finalidade_id: 3, // Venda
        valor_venda: '3200000.00',
        valor_locacao: null,
        valor_condominio: null,
        valor_iptu: '420.00',
        area_util: '5000.00',
        area_total: '5000.00',
        cep: '78550-800',
        logradouro: 'Rodovia BR-163, Km 825',
        numero: 'S/N',
        complemento: 'Lote 04-A',
        bairro: 'Setor Industrial Norte',
        cidade: 'Sinop',
        estado: 'MT',
        descricao: 'Excelente terreno comercial e industrial com frente direta para a rodovia BR-163, o principal corredor logístico e de escoamento de grãos do Brasil. Área 100% plana, sem necessidade de aterro ou terraplanagem complexa, com testada de 65 metros lineares para a marginal da rodovia. Zoneamento ZEU (Zona de Expansão Urbana) aprovado pela Prefeitura Municipal, perfeito para instalação de concessionárias de caminhões, postos de combustíveis, silos, centros de distribuição ou complexos industriais. Infraestrutura completa com asfalto pesado, rede de água tratada, energia trifásica de alta tensão na porta e iluminação pública em LED.',
        status: 'DISPONIVEL',
        destaque: false,
        corretor_id: corretorPrincipalId,
        proprietario_id: idProprietarioPioneira,
        exclusividade: true,
        exclusividade_ate: '2027-08-30',
        data_captacao: '2026-05-18',
        chaves: 'Área aberta, cerca com porteira e cadeado senha 1577.',
        matricula: 'Matrícula nº 78.330 - Cartório 1º Ofício de Sinop',
        inscricao_municipal: 'IM-2026-664421',
        observacoes_internas: 'Avaliação mercadológica recente em R$ 640/m² (total R$ 3.200.000). Documentação impecável, livre de quaisquer ônus, hipotecas ou penhoras. Geo-referenciamento e CAR homologados.',
        motivo_baixa: null,
        caracteristicas: [
          { nome: 'Estacionamento para Clientes', valor: 'Acesso facilitado para bitrens' },
          { nome: 'Docas para Carga e Descarga', valor: 'Topografia nivelada' },
        ],
        midias: [
          { url: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80', capa: true, ordem: 0 },
          { url: 'https://images.unsplash.com/photo-1473496169904-658ba7c44d8a?auto=format&fit=crop&w=1200&q=80', capa: false, ordem: 1 },
          { url: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=1200&q=80', capa: false, ordem: 2 },
        ],
      },
      {
        titulo: 'Salão Comercial Pronto para Clínica / Restaurante - Av. dos Tarumãs',
        slugBase: 'salao-comercial-pronto-clinica-restaurante-av-dos-tarumas',
        tipo_id: 3, // Loja
        finalidade_id: 2, // Locação
        valor_venda: null,
        valor_locacao: '8900.00',
        valor_condominio: null,
        valor_iptu: '340.00',
        area_util: '245.00',
        area_total: '310.00',
        cep: '78550-220',
        logradouro: 'Av. dos Tarumãs',
        numero: '620',
        complemento: null,
        bairro: 'Jardim Botânico',
        cidade: 'Sinop',
        estado: 'MT',
        descricao: 'Charmoso salão comercial térreo totalmente reformado, com infraestrutura completa adaptada para clínicas médicas, odontologia avançada, laboratórios ou restaurantes de alta gastronomia. Possui recepção ampla com balcão em mármore, 5 consultórios/salas individualizadas com pontos de água e esgoto, sala de esterilização/expurgo, 4 banheiros (2 adaptados para PCD), copa/cozinha industrial com coifa instalada e depósito. Fachada com jardim frontal iluminado e 5 vagas exclusivas de estacionamento.',
        status: 'RESERVADO',
        destaque: false,
        corretor_id: corretoraMarianaId,
        proprietario_id: idProprietarioRoberto,
        exclusividade: false,
        exclusividade_ate: null,
        data_captacao: '2026-08-05',
        chaves: 'Na imobiliária com Eduardo Teste Bergamin.',
        matricula: 'Matrícula nº 33.102 - 1º Ofício Sinop',
        inscricao_municipal: 'IM-2026-442190',
        observacoes_internas: 'Imóvel atualmente em processo de reserva e análise de fiadores para a clínica OdontoMed. Avaliação de locação em R$ 8.900/mês.',
        motivo_baixa: null,
        caracteristicas: [
          { nome: 'Acessibilidade PCD', valor: 'Banheiros adaptados' },
          { nome: 'Ar-condicionado Central', valor: '5 aparelhos inverter' },
          { nome: 'Estacionamento para Clientes', valor: '5 vagas privativas' },
          { nome: 'Sistema de Câmeras e Alarme', valor: 'Alarme perimetral' },
        ],
        midias: [
          { url: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1200&q=80', capa: true, ordem: 0 },
          { url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80', capa: false, ordem: 1 },
          { url: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=1200&q=80', capa: false, ordem: 2 },
        ],
      },
      {
        titulo: 'Casa Comercial de Alto Padrão para Escritório Corporativo',
        slugBase: 'casa-comercial-alto-padrao-escritorio-corporativo',
        tipo_id: 6, // Casa
        finalidade_id: 2, // Locação
        valor_venda: null,
        valor_locacao: '6500.00',
        valor_condominio: null,
        valor_iptu: '290.00',
        area_util: '210.00',
        area_total: '450.00',
        cep: '78550-050',
        logradouro: 'Rua dos Jacarandás',
        numero: '780',
        complemento: null,
        bairro: 'Centro',
        cidade: 'Sinop',
        estado: 'MT',
        descricao: 'Imóvel com alvará comercial ativo para escritórios executivos, advocacia ou agências. Composto por recepção elegante, 4 salas de atendimento privativas, sala de reunião para 12 pessoas com painel amadeirado e iluminação intimista, jardim de inverno, copa espaçosa e área externa gramada com pergolado para eventos corporativos. Portão eletrônico e garagem coberta para 3 veículos.',
        status: 'ALUGADO',
        destaque: false,
        corretor_id: corretorLucasId,
        proprietario_id: idProprietarioRoberto,
        exclusividade: true,
        exclusividade_ate: '2027-02-28',
        data_captacao: '2026-04-10',
        chaves: 'Com inquilino (Contrato CTR-2026-001 ativo).',
        matricula: 'Matrícula nº 22.890 - CRI Sinop',
        inscricao_municipal: 'IM-2026-551109',
        observacoes_internas: 'Contrato de locação firmado por 30 meses a R$ 6.500/mês. Imóvel alugado com excelente pontualidade de pagamento e garantia caução registrada.',
        motivo_baixa: null,
        caracteristicas: [
          { nome: 'Estacionamento para Clientes', valor: '3 vagas cobertas' },
          { nome: 'Ar-condicionado Central', valor: 'Todas as salas climatizadas' },
          { nome: 'Sistema de Câmeras e Alarme', valor: 'Cerca elétrica e alarme' },
          { nome: 'Energia Solar Fotovoltaica', valor: 'Microgeração distribuída' },
        ],
        midias: [
          { url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80', capa: true, ordem: 0 },
          { url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80', capa: false, ordem: 1 },
          { url: 'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=1200&q=80', capa: false, ordem: 2 },
        ],
      },
    ];

    const mapaImoveis = new Map<string, number>();
    // Mapear também os já existentes
    const imoveisExistentes = await client.query('SELECT id, titulo FROM imoveis');
    for (const row of imoveisExistentes.rows) {
      mapaImoveis.set(row.titulo, row.id);
    }

    for (const im of novosImoveis) {
      let imovelId: number;
      const check = await client.query('SELECT id FROM imoveis WHERE titulo = $1', [im.titulo]);
      if (check.rows.length > 0) {
        imovelId = check.rows[0].id;
        const slug = `${im.slugBase}-${imovelId}`;
        await client.query(
          `UPDATE imoveis SET
             slug = $1, tipo_id = $2, finalidade_id = $3, valor_venda = $4, valor_locacao = $5,
             valor_condominio = $6, valor_iptu = $7, area_util = $8, area_total = $9, cep = $10,
             logradouro = $11, numero = $12, complemento = $13, bairro = $14, cidade = $15, estado = $16,
             descricao = $17, status = $18, destaque = $19, corretor_id = $20, proprietario_id = $21,
             exclusividade = $22, exclusividade_ate = $23, data_captacao = $24, chaves = $25,
             matricula = $26, inscricao_municipal = $27, observacoes_internas = $28, motivo_baixa = $29,
             ativo = true, alterado_em = now()
           WHERE id = $30`,
          [
            slug, im.tipo_id, im.finalidade_id, im.valor_venda, im.valor_locacao,
            im.valor_condominio, im.valor_iptu, im.area_util, im.area_total, im.cep,
            im.logradouro, im.numero, im.complemento, im.bairro, im.cidade, im.estado,
            im.descricao, im.status, im.destaque, im.corretor_id, im.proprietario_id,
            im.exclusividade, im.exclusividade_ate, im.data_captacao, im.chaves,
            im.matricula, im.inscricao_municipal, im.observacoes_internas, im.motivo_baixa,
            imovelId,
          ]
        );
      } else {
        const dummySlug = `temp-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const res = await client.query(
          `INSERT INTO imoveis (
             titulo, slug, tipo_id, finalidade_id, valor_venda, valor_locacao,
             valor_condominio, valor_iptu, area_util, area_total, cep,
             logradouro, numero, complemento, bairro, cidade, estado,
             descricao, status, destaque, corretor_id, proprietario_id,
             exclusividade, exclusividade_ate, data_captacao, chaves,
             matricula, inscricao_municipal, observacoes_internas, motivo_baixa,
             ativo, criado_em, alterado_em, criado_por, alterado_por
           ) VALUES (
             $1, $2, $3, $4, $5, $6,
             $7, $8, $9, $10, $11,
             $12, $13, $14, $15, $16, $17,
             $18, $19, $20, $21, $22,
             $23, $24, $25, $26,
             $27, $28, $29, $30,
             true, now(), now(), 1, 1
           ) RETURNING id`,
          [
            im.titulo, dummySlug, im.tipo_id, im.finalidade_id, im.valor_venda, im.valor_locacao,
            im.valor_condominio, im.valor_iptu, im.area_util, im.area_total, im.cep,
            im.logradouro, im.numero, im.complemento, im.bairro, im.cidade, im.estado,
            im.descricao, im.status, im.destaque, im.corretor_id, im.proprietario_id,
            im.exclusividade, im.exclusividade_ate, im.data_captacao, im.chaves,
            im.matricula, im.inscricao_municipal, im.observacoes_internas, im.motivo_baixa,
          ]
        );
        imovelId = res.rows[0].id;
        const slug = `${im.slugBase}-${imovelId}`;
        await client.query('UPDATE imoveis SET slug = $1 WHERE id = $2', [slug, imovelId]);
      }
      mapaImoveis.set(im.titulo, imovelId);

      // Características do imóvel
      for (const car of im.caracteristicas) {
        const carId = mapaCaracteristicas.get(car.nome);
        if (carId) {
          await client.query(
            `INSERT INTO imoveis_caracteristicas (imovel_id, caracteristica_id, valor, ativo, criado_em, alterado_em, criado_por, alterado_por)
             VALUES ($1, $2, $3, true, now(), now(), 1, 1)
             ON CONFLICT (imovel_id, caracteristica_id) DO UPDATE SET valor = EXCLUDED.valor, ativo = true`,
            [imovelId, carId, car.valor]
          );
        }
      }

      // Mídias do imóvel
      await client.query('DELETE FROM imoveis_midias WHERE imovel_id = $1', [imovelId]);
      for (const m of im.midias) {
        await client.query(
          `INSERT INTO imoveis_midias (imovel_id, tipo, url, chave_armazenamento, ordem, capa, criado_em, alterado_em, criado_por, alterado_por)
           VALUES ($1, 'IMAGEM', $2, null, $3, $4, now(), now(), 1, 1)`,
          [imovelId, m.url, m.ordem, m.capa]
        );
      }
    }
    console.log(`✓ ${mapaImoveis.size} imóveis registrados com características e mídias.`);

    // Vincular leads aos imóveis correspondentes
    const idGalpao = mapaImoveis.get('Galpão Logístico Modular de Alto Padrão - Setor Industrial');
    const idSalaPrime = mapaImoveis.get('Sala Comercial Executiva no Edifício Prime Corporate');
    const idPontoJulio = mapaImoveis.get('Ponto Comercial de Esquina - Av. Júlio Campos');
    const idPredioCivico = mapaImoveis.get('Prédio Comercial Monousuário - Centro Cívico');
    const idTerrenoBr = mapaImoveis.get('Terreno Comercial e Industrial na BR-163 - Eixo Estratégico');
    const idCasaJacarandas = mapaImoveis.get('Casa Comercial de Alto Padrão para Escritório Corporativo');

    if (idGalpao) await client.query(`UPDATE pessoas SET imovel_id = $1 WHERE email = 'fernando.rossi@agrotransp.com.br'`, [idGalpao]);
    if (idSalaPrime) await client.query(`UPDATE pessoas SET imovel_id = $1 WHERE email = 'camila.fontana@studiodesign.com.br'`, [idSalaPrime]);
    if (idTerrenoBr) await client.query(`UPDATE pessoas SET imovel_id = $1 WHERE email = 'thiago.alencar@superfrango.com.br'`, [idTerrenoBr]);
    if (idPontoJulio) await client.query(`UPDATE pessoas SET imovel_id = $1 WHERE email = 'patricia.zanin@clinicaestetica.com.br'`, [idPontoJulio]);
    if (idPredioCivico) await client.query(`UPDATE pessoas SET imovel_id = $1 WHERE email = 'gustavo@siqueiratransportes.com.br'`, [idPredioCivico]);

    // 5. CONTRATOS DE LOCAÇÃO
    console.log('Populando contratos de locação...');
    const listaContratos = [
      {
        numero_contrato: 'CTR-2026-001',
        imovel_id: idCasaJacarandas!,
        locador_id: idProprietarioRoberto,
        locatario_id: idLocatarioMarcos,
        corretor_id: corretorLucasId,
        data_inicio: '2026-05-01',
        data_fim: '2028-10-31',
        valor_aluguel: '6500.00',
        dia_vencimento: 10,
        taxa_administracao: '8.00',
        garantia_locaticia: 'Caução (3 aluguéis) em conta poupança vinculada',
        indice_reajuste: 'IPCA-IBGE',
        cobranca_iptu_condominio: 'IPTU pago pelo locatário junto com boleto do aluguel',
        url_pasta_drive: 'https://drive.google.com/drive/folders/corretor-contrato-001',
        status: 'ATIVO',
        observacoes: 'Locação comercial para consultório odontológico. Vistoria inicial aprovada.',
      },
      {
        numero_contrato: 'CTR-2026-002',
        imovel_id: 2, // Kitnet 32m2
        locador_id: idProprietarioHelena,
        locatario_id: idLocatarioMariane,
        corretor_id: corretorPrincipalId,
        data_inicio: '2026-08-01',
        data_fim: '2027-07-31',
        valor_aluguel: '1120.00',
        dia_vencimento: 5,
        taxa_administracao: '10.00',
        garantia_locaticia: 'Seguro Fiança Locatícia Porto Seguro',
        indice_reajuste: 'IPCA',
        cobranca_iptu_condominio: 'Condomínio e IPTU inclusos no boleto',
        url_pasta_drive: null,
        status: 'ATIVO',
        observacoes: 'Locação residencial de 12 meses. Locatária com documentação aprovada.',
      },
    ];

    const mapaContratos = new Map<string, number>();
    for (const c of listaContratos) {
      const check = await client.query('SELECT id FROM contrato WHERE numero_contrato = $1', [c.numero_contrato]);
      let contratoId: number;
      if (check.rows.length > 0) {
        contratoId = check.rows[0].id;
        await client.query(
          `UPDATE contrato SET
             imovel_id = $1, locador_id = $2, locatario_id = $3, corretor_id = $4,
             data_inicio = $5, data_fim = $6, valor_aluguel = $7, dia_vencimento = $8,
             taxa_administracao = $9, garantia_locaticia = $10, indice_reajuste = $11,
             cobranca_iptu_condominio = $12, url_pasta_drive = $13, status = $14,
             observacoes = $15, ativo = true, alterado_em = now()
           WHERE id = $16`,
          [
            c.imovel_id, c.locador_id, c.locatario_id, c.corretor_id,
            c.data_inicio, c.data_fim, c.valor_aluguel, c.dia_vencimento,
            c.taxa_administracao, c.garantia_locaticia, c.indice_reajuste,
            c.cobranca_iptu_condominio, c.url_pasta_drive, c.status,
            c.observacoes, contratoId,
          ]
        );
      } else {
        const res = await client.query(
          `INSERT INTO contrato (
             numero_contrato, imovel_id, locador_id, locatario_id, corretor_id,
             data_inicio, data_fim, valor_aluguel, dia_vencimento, taxa_administracao,
             garantia_locaticia, indice_reajuste, cobranca_iptu_condominio, url_pasta_drive,
             status, observacoes, ativo, status_pasta_drive,
             criado_em, alterado_em, criado_por, alterado_por
           ) VALUES (
             $1, $2, $3, $4, $5,
             $6, $7, $8, $9, $10,
             $11, $12, $13, $14,
             $15, $16, true, 'PENDENTE',
             now(), now(), 1, 1
           ) RETURNING id`,
          [
            c.numero_contrato, c.imovel_id, c.locador_id, c.locatario_id, c.corretor_id,
            c.data_inicio, c.data_fim, c.valor_aluguel, c.dia_vencimento, c.taxa_administracao,
            c.garantia_locaticia, c.indice_reajuste, c.cobranca_iptu_condominio, c.url_pasta_drive,
            c.status, c.observacoes,
          ]
        );
        contratoId = res.rows[0].id;
      }
      mapaContratos.set(c.numero_contrato, contratoId);
    }
    console.log(`✓ ${mapaContratos.size} contratos de locação configurados.`);

    const idContrato001 = mapaContratos.get('CTR-2026-001')!;
    const idContrato002 = mapaContratos.get('CTR-2026-002')!;

    // 6. COMISSÕES E PARCELAS
    console.log('Populando comissões e parcelas financeiras...');
    const listaComissoes = [
      {
        tipo_operacao: 'LOCACAO' as const,
        contrato_id: idContrato001,
        imovel_id: idCasaJacarandas!,
        pessoa_id: idLocatarioMarcos,
        valor_total: '6500.00',
        quantidade_parcelas: 2,
        observacoes: 'Honorários de intermediação de locação comercial (1 aluguel). 2 parcelas pagas.',
        parcelas: [
          { numero: 1, data_vencimento: '2026-05-15', valor: '3250.00', status: 'PAGO', pago_em: '2026-05-14T14:30:00Z', obs: 'TED Banco do Brasil doc 489201' },
          { numero: 2, data_vencimento: '2026-06-15', valor: '3250.00', status: 'PAGO', pago_em: '2026-06-15T10:15:00Z', obs: 'PIX locador ref 2ª parcela intermediação' },
        ],
      },
      {
        tipo_operacao: 'VENDA' as const,
        contrato_id: null,
        imovel_id: idTerrenoBr!,
        pessoa_id: idClienteTelesPires,
        valor_total: '120000.00',
        quantidade_parcelas: 3,
        observacoes: 'Comissão de corretagem sobre venda comercial de terreno industrial. 1 parcela paga, 2 a vencer.',
        parcelas: [
          { numero: 1, data_vencimento: '2026-09-10', valor: '40000.00', status: 'PAGO', pago_em: '2026-09-09T16:00:00Z', obs: 'TED Sicredi ref entrada da comissão' },
          { numero: 2, data_vencimento: '2026-10-10', valor: '40000.00', status: 'PENDENTE', pago_em: null, obs: null },
          { numero: 3, data_vencimento: '2026-11-10', valor: '40000.00', status: 'PENDENTE', pago_em: null, obs: null },
        ],
      },
      {
        tipo_operacao: 'LOCACAO' as const,
        contrato_id: idContrato002,
        imovel_id: 2, // Kitnet
        pessoa_id: idLocatarioMariane,
        valor_total: '1120.00',
        quantidade_parcelas: 1,
        observacoes: 'Comissão taxa de agenciamento de locação Kitnet.',
        parcelas: [
          { numero: 1, data_vencimento: '2026-08-10', valor: '1120.00', status: 'PAGO', pago_em: '2026-08-08T11:20:00Z', obs: 'PIX taxa de agenciamento paga à vista' },
        ],
      },
    ];

    let totalParcelasInseridas = 0;
    for (const c of listaComissoes) {
      // Verificar comissão existente por imovel_id e tipo_operacao
      let comissaoId: number;
      const check = await client.query(
        'SELECT id FROM comissoes WHERE imovel_id = $1 AND tipo_operacao = $2',
        [c.imovel_id, c.tipo_operacao]
      );
      if (check.rows.length > 0) {
        comissaoId = check.rows[0].id;
        await client.query(
          `UPDATE comissoes SET
             contrato_id = $1, pessoa_id = $2, valor_total = $3,
             quantidade_parcelas = $4, observacoes = $5, ativo = true, alterado_em = now()
           WHERE id = $6`,
          [c.contrato_id, c.pessoa_id, c.valor_total, c.quantidade_parcelas, c.observacoes, comissaoId]
        );
      } else {
        const res = await client.query(
          `INSERT INTO comissoes (
             tipo_operacao, contrato_id, imovel_id, pessoa_id, valor_total,
             quantidade_parcelas, observacoes, ativo, criado_em, alterado_em, criado_por, alterado_por
           ) VALUES (
             $1, $2, $3, $4, $5,
             $6, $7, true, now(), now(), 1, 1
           ) RETURNING id`,
          [c.tipo_operacao, c.contrato_id, c.imovel_id, c.pessoa_id, c.valor_total, c.quantidade_parcelas, c.observacoes]
        );
        comissaoId = res.rows[0].id;
      }

      // Parcelas da comissão
      for (const p of c.parcelas) {
        await client.query(
          `INSERT INTO parcelas_comissao (
             comissao_id, numero_parcela, data_vencimento, valor, status,
             pago_em, observacao_pagamento, ativo, criado_em, alterado_em, criado_por, alterado_por
           ) VALUES (
             $1, $2, $3, $4, $5,
             $6, $7, true, now(), now(), 1, 1
           )
           ON CONFLICT (comissao_id, numero_parcela) DO UPDATE SET
             data_vencimento = EXCLUDED.data_vencimento,
             valor = EXCLUDED.valor,
             status = EXCLUDED.status,
             pago_em = EXCLUDED.pago_em,
             observacao_pagamento = EXCLUDED.observacao_pagamento,
             ativo = true,
             alterado_em = now()`,
          [comissaoId, p.numero, p.data_vencimento, p.valor, p.status, p.pago_em, p.obs]
        );
        totalParcelasInseridas++;
      }
    }
    console.log(`✓ ${listaComissoes.length} comissões e ${totalParcelasInseridas} parcelas cadastradas.`);

    // Sincronizar sequences de todas as tabelas
    const tabelasSequencia = [
      'corretores', 'tipos_imovel', 'finalidades_imovel', 'caracteristicas',
      'pessoas', 'imoveis', 'imoveis_midias', 'contrato', 'comissoes', 'parcelas_comissao'
    ];
    for (const tab of tabelasSequencia) {
      await client.query(`SELECT setval(pg_get_serial_sequence('${tab}', 'id'), COALESCE((SELECT max(id) FROM ${tab}), 0) + 1, false)`);
    }
    console.log('✓ Sequências autoincrement sincronizadas.');

    await client.query('COMMIT');
    console.log('🎉 Transação de injeção de dados concluída com sucesso!');

    return {
      corretores: mapaCorretores.size,
      caracteristicas: mapaCaracteristicas.size,
      pessoas: mapaPessoas.size,
      imoveis: mapaImoveis.size,
      midias: novosImoveis.reduce((acc, curr) => acc + curr.midias.length, 0),
      contratos: mapaContratos.size,
      comissoes: listaComissoes.length,
      parcelas: totalParcelasInseridas,
    };
  } catch (erro) {
    await client.query('ROLLBACK');
    console.error('❌ Erro durante o seed, rollback executado:', erro);
    throw erro;
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  executarSeed()
    .then((resultado) => {
      console.log('Resultado do Seed:', resultado);
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
