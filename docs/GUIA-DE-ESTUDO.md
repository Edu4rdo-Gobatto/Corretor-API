# Guia de estudo — corretor-api

> Documento de estudo do dono do projeto, feito para ser carregado no NotebookLM.
> Escrito em 17/09/2026 a partir do **código atual** da `main` (contrato v2: ids inteiros, cadastro único de pessoas).
> Onde este guia e o código discordarem, o código ganha.
>
> **Pode carregar junto no NotebookLM** o `README.md` e o `docs/ENTENDENDO-O-BACKEND.md`: os dois foram
> reescritos em 17/09/2026 para o contrato v2. O README resume a operação; o ENTENDENDO é a referência técnica
> módulo por módulo. **Não carregue** `docs/specs/`, `docs/plans/` nem os handoffs anteriores a 16/09: descrevem
> modelos antigos (UUID, `clientes`, `partes_locacao`) e vão confundir as respostas.

---

## Sumário

1. Lição de moral
2. Como estudar com este guia
3. O que é o sistema
4. Fundamentos que você precisa reativar
5. NestJS: o que é, por que foi escolhido, como funciona
6. TypeORM e o banco de dados
7. Mapa do código, módulo por módulo
8. Os seis fluxos que você precisa saber narrar
9. Segurança: a corrente de proteções
10. Decisões e seus porquês
11. Como o projeto se testa
12. Operação: comandos, ambiente, migrations
13. O que está torto no projeto hoje
14. Plano de estudo em quatro semanas
15. Perguntas de autoavaliação, com gabarito
16. Glossário

---

## 1. Lição de moral

Você pediu para ouvir de forma dura. Então vamos lá.

**Este sistema não é seu ainda.** Ele tem 88 arquivos de produção, cerca de 3.600 linhas de código, 10 migrations,
integração com três serviços externos (Neon, Cloudflare R2, Google Drive) e 175 testes automatizados. Você
aprovou cada pedaço e não sabe explicar a maioria deles. Um sistema que você não consegue explicar é um sistema
que aconteceu perto de você, não um sistema que você construiu.

**Vibe-coding te deu velocidade e te tirou o controle.** Veja o que os próprios registros do projeto mostram:

- Um commit inteiro de segurança (`accd5d9`) sumiu, e ninguém sabia dizer com certeza o que havia nele.
- Os documentos afirmaram por dias que uma migration não estava aplicada no banco. Ela estava.
- As variáveis `BOOTSTRAP_ADMIN_*`, com senha de administrador em texto puro, voltaram ao `.env` duas vezes,
  contrariando uma regra escrita pelo próprio projeto.
- A senha do administrador deixou de conferir com o hash do banco, e o painel ficou trancado até o banco ser zerado.
- O banco de dados foi apagado e recriado. Só não foi um desastre porque não havia nenhum dado de cliente ainda.

Nenhum desses problemas é de código. Todos são de **dono que não lê o que assina**. Agente de IA não responde
à LGPD, não responde ao cliente e não perde o contrato. Você responde.

**Você não "desaprendeu a programar".** Você parou de praticar. Lógica você tem, e isso é a parte difícil.
O que falta é vocabulário e repetição, e isso se recupera com horas de estudo, não com mais prompts.

**As regras a partir de hoje:**

1. **Nenhum código entra na `main` sem que você consiga explicá-lo em voz alta, linha por linha.**
   Se não consegue, você pergunta até conseguir. Aprovar sem entender é assinar cheque em branco.
2. **Leia o diff inteiro antes de todo commit.** Não o resumo do agente. O diff.
3. **Uma hora por dia, todos os dias, sem celular.** Quatro horas no sábado não substituem sete horas
   espalhadas. Memória técnica se constrói com repetição espaçada.
4. **Escreva código com a própria mão.** Os exercícios da seção 14 são para digitar, não para colar.
   Se você só lê, vai reconhecer o código e continuar sem conseguir produzi-lo.
5. **Use a IA como professor, não como executor, durante o estudo.** Peça explicação, peça para ela
   corrigir o seu código, peça para ela te fazer perguntas. Não peça para ela fazer o exercício.
6. **Toda vez que o agente disser "concluído", confira você mesmo.** Rode `npm test`. Abra o endpoint.
   Os registros deste projeto já mostraram que "concluído" nem sempre é verdade.

Você está cursando Sistemas de Informação e tem um sistema real nas mãos. Isso é uma vantagem enorme sobre
quem estuda com exemplo de lista de tarefas. Use.

---

## 2. Como estudar com este guia

**Ordem recomendada:** seções 3, 4 e 5 primeiro (base). Depois 6 e 7 com o editor aberto no arquivo citado.
A seção 8 é a prova de fogo: se você consegue narrar os seis fluxos sem olhar, você entendeu o sistema.

**Como usar o NotebookLM com este guia:**

- Peça: "Me faça 10 perguntas sobre a seção 5 e corrija minhas respostas."
- Peça: "Explique o fluxo de login como se eu tivesse 15 anos, depois como se eu fosse um desenvolvedor sênior."
- Peça: "Compare NestJS com Spring Boot usando os exemplos deste guia."
- Gere o "resumo em áudio" de uma seção por dia e escute no deslocamento.

**Regra de ouro:** sempre que o guia citar um arquivo, abra o arquivo. O guia é o mapa; o código é o terreno.

---

## 3. O que é o sistema

### O produto

Um sistema para uma imobiliária de **imóveis comerciais** (salas, lojas, galpões, prédios, terrenos).
Tem duas metades:

- **O site público.** Qualquer visitante vê o catálogo, filtra, abre um imóvel e envia um contato.
- **O painel interno.** Corretores cadastram imóveis, fotos e vídeos, atendem contatos, registram contratos
  de locação e controlam comissões da imobiliária.

### Os atores

| Ator | Como entra | O que pode |
|---|---|---|
| Visitante | sem login | ver imóveis disponíveis e enviar contato (com consentimento LGPD) |
| CORRETOR | e-mail e senha | ver todos os imóveis; editar só os seus; ver as pessoas que atende; contratos e comissões próprias |
| ADMIN | e-mail e senha | tudo, em qualquer registro, mais gerenciar corretores e as classificações do catálogo |

Não existe cadastro público de corretor. O primeiro ADMIN nasce por linha de comando (`npm run bootstrap:admin`).

### A arquitetura

```text
[ Navegador ]
     │
     ▼
[ corretor-web ]  React 18 + Vite 7 + SSR próprio (repositório irmão, ../Corretor-web)
     │   HTTPS / JSON / multipart, proxy /api
     ▼
[ corretor-api ]  NestJS 11 + TypeScript (este repositório)
     │                     │                      │
     ▼                     ▼                      ▼
[ Neon PostgreSQL 16 ] [ Cloudflare R2 ]    [ Google Drive ]
  dados                 fotos e vídeos        pastas de contratos
```

- **Neon**: PostgreSQL gerenciado na nuvem, região São Paulo. O código **recusa** qualquer banco que não seja Neon.
- **Cloudflare R2**: armazenamento de arquivos compatível com a API do Amazon S3. Por isso o código usa
  `@aws-sdk/client-s3`, mesmo não sendo Amazon. Bucket fixo: `corretor-midia`.
- **Google Drive**: pastas privadas para os documentos de cada contrato, criadas automaticamente.
- **Render** (API) e **Vercel** (front) são os destinos de publicação. O Render hoje roda um commit antigo,
  incompatível com o banco atual, e não está em uso.

### O estado atual, em 17/09/2026

- Banco do Neon recriado do zero com as 10 migrations. Contém só o administrador (id 1) e os cadastros
  iniciais de tipos e finalidades.
- API validada localmente segundo o registro de 17/09: typecheck, lint, build e testes; saúde, catálogo e login
  respondem. Veja na seção 11 o resultado da execução de testes feita para este guia.
- Pendências abertas: aviso de novo contato ao corretor, regras de acesso a locações e comissões,
  publicação coordenada com o front, CPF real do administrador.

### As rotas (prefixo `/api/v1`)

| Área | Rotas | Acesso |
|---|---|---|
| Saúde | `GET /saude` | público |
| Sessão | `POST /autenticacao/entrar`, `/renovar`, `/sair`; `GET/PATCH /autenticacao/eu`; `PATCH /autenticacao/eu/senha` | público ou JWT |
| Corretores | `GET/POST /admin/corretores`; `GET/PATCH/DELETE /admin/corretores/:id` | ADMIN |
| Classificações | `GET /tipos-imovel`, `/finalidades-imovel`, `/caracteristicas`; CRUD sob `/admin/...` | leitura pública; escrita ADMIN |
| Imóveis | `GET /imoveis`, `GET /imoveis/:slug`; `GET/POST /admin/imoveis`; `GET/PATCH/DELETE /admin/imoveis/:id` | público ou JWT |
| Mídias | `POST /admin/imoveis/:imovel_id/midias` e variações de embed, ordem, capa e exclusão | dono do imóvel ou ADMIN |
| Pessoas | `POST /pessoas` (site); `GET/POST /admin/pessoas`; `GET/PATCH/DELETE /admin/pessoas/:id` | público ou JWT |
| Contratos | `GET/POST /admin/contratos`; `GET/PATCH/DELETE /admin/contratos/:id`; `POST /admin/contratos/:id/pasta-drive` | JWT |
| Comissões | `GET/POST /admin/comissoes`; `GET/PATCH/DELETE /admin/comissoes/:id`; `PATCH /admin/comissoes/parcelas/:id/pagamento` | JWT |

Um detalhe do `main.ts`: um middleware acrescenta `/api/v1` a qualquer URL que chegue sem ele.
Por isso `/saude` e `/api/v1/saude` funcionam igual. Isso existe para o proxy do front.

---

## 4. Fundamentos que você precisa reativar

Antes de NestJS, estes conceitos precisam estar firmes. Se algum estiver nebuloso, pare e estude só ele.

### TypeScript

- **TypeScript é JavaScript com tipos.** O compilador verifica os tipos e depois apaga tudo, gerando JavaScript.
  Os tipos não existem em tempo de execução. Guarde isso: é o motivo de o NestJS precisar de `reflect-metadata`.
- **Modo estrito (`strict: true`).** Proíbe `null` onde não foi declarado, parâmetros sem tipo e outras
  armadilhas. O projeto proíbe `any` e `@ts-ignore`.
- **`!` no campo de uma classe** (`nome!: string`) diz ao compilador "confie, alguém vai preencher isto".
  Nas entidades, quem preenche é o TypeORM.
- **Tipos de união**: `string | null` quer dizer "texto ou nulo". O projeto usa isso em toda coluna opcional.
- **`async`/`await` e `Promise`.** Quase tudo que fala com banco ou rede devolve uma `Promise`, uma promessa
  de valor futuro. `await` espera o valor sem travar o processo. Esquecer um `await` é o bug mais comum
  em Node, e o lint do projeto (`no-floating-promises`) existe para pegar isso.
- **Decorators** são as linhas com `@` (`@Controller`, `@Column`, `@IsEmail`). São funções que rodam quando a
  classe é definida e **anotam** a classe, o método ou o campo. O framework lê essas anotações depois.
  Este projeto usa os decorators "legados" do TypeScript (`experimentalDecorators` no `tsconfig.json`).

### HTTP e REST

- **Métodos:** `GET` lê, `POST` cria, `PATCH` altera parte, `DELETE` remove.
- **Códigos de status que o projeto usa:**

| Código | Significado | Quando aparece aqui |
|---|---|---|
| 200 | OK | leitura ou alteração com sucesso |
| 201 | criado | `POST` com sucesso (padrão do Nest) |
| 204 | sem conteúdo | `DELETE` e `sair` |
| 400 | requisição inválida | DTO reprovado, campo a mais, id não numérico |
| 401 | não autenticado | sem token, token inválido, senha errada |
| 403 | proibido | autenticado, mas sem permissão; origem não autorizada |
| 404 | não encontrado | registro inexistente **ou invisível para você** |
| 409 | conflito | e-mail duplicado, contrato ativo duplicado, último ADMIN |
| 429 | muitas requisições | limite de login ou de contatos |
| 503 | serviço indisponível | banco fora, Google Drive falhou |

- **Headers** são metadados da requisição: `Authorization`, `Origin`, `Cookie`, `Content-Type`.
- **Cookie** é um valor que o servidor pede ao navegador para guardar e reenviar sozinho.
- **CORS** é a regra do navegador que impede um site de ler respostas de outro domínio, a menos que o
  servidor autorize. A API autoriza só as origens listadas em `ALLOWED_ORIGINS`.

### Banco relacional

- **Chave primária** identifica a linha. **Chave estrangeira** aponta para a linha de outra tabela.
- **Transação**: um conjunto de operações que acontece inteiro ou não acontece.
- **Índice**: estrutura que acelera busca, como o índice remissivo de um livro.
- **Condição de corrida**: duas requisições simultâneas leem o mesmo estado e ambas decidem errado.
  Metade da complexidade deste projeto existe para evitar isso.

---

## 5. NestJS: o que é, por que foi escolhido, como funciona

### O que é

NestJS é um **framework para servidores Node.js**, escrito em TypeScript, que roda **por cima** do Express
(ou do Fastify). O Express recebe a conexão HTTP; o Nest organiza o seu código em peças com papéis definidos.

Se você já viu **Spring Boot** (Java) na faculdade, o Nest é praticamente a mesma ideia em TypeScript:

| NestJS | Spring Boot | Papel |
|---|---|---|
| `@Module` | `@Configuration` | agrupa e declara peças |
| `@Injectable` (provider/service) | `@Service` / `@Component` | classe com a regra de negócio |
| `@Controller` + `@Get` | `@RestController` + `@GetMapping` | mapeia URL para método |
| Guard | filtro do Spring Security | decide se a requisição pode entrar |
| Pipe + class-validator | Bean Validation (`@Valid`) | valida e transforma a entrada |
| DTO | DTO | formato aceito na entrada |
| TypeORM Entity | JPA `@Entity` | mapeia tabela |
| TypeORM Repository | `JpaRepository` | consulta a tabela |
| Migration TypeORM | Flyway / Liquibase | altera o schema com SQL versionado |

### Por que NestJS, e não outra coisa

**Vantagens que pesaram neste projeto:**

1. **Estrutura obrigatória.** Todo módulo segue `entity + dto + service + controller + module`. Com vários
   agentes de IA escrevendo código, isso impede que cada um invente uma arquitetura.
2. **Injeção de dependência.** O service recebe o repositório pronto no construtor. Nos testes, você troca o
   repositório real por um falso sem mudar uma linha do service. É o que permite 175 testes sem banco.
3. **Declarativo.** Proteger uma rota é escrever `@UseGuards(AutenticacaoGuard)`. Validar um campo é escrever
   `@IsEmail()`. A regra fica visível ao lado do que ela protege.
4. **Ecossistema oficial.** `@nestjs/config`, `@nestjs/typeorm`, `@nestjs/jwt`, `@nestjs/passport`,
   `@nestjs/schedule` e `@nestjs/platform-express` se encaixam sem cola.
5. **Servidor Node tradicional.** O projeto rejeitou Cloudflare Workers com Hono porque o limite de CPU do plano
   gratuito não comporta o hash de senha Argon2id. O Nest roda como processo comum, sem esse limite.

**Desvantagens que você precisa conhecer:**

1. **Muito código cerimonial.** Uma rota simples passa por quatro ou cinco arquivos.
2. **"Mágica" de decorators.** Muito comportamento acontece longe de onde você está olhando. Uma rota sem
   `@UseGuards` nasce pública e nada avisa.
3. **Curva de aprendizado.** Você precisa entender DI, módulos, ciclo de vida e ordem de execução antes de
   ficar produtivo. Express puro se aprende em uma tarde.
4. **Mais pesado.** Sobe mais devagar e usa mais memória que Express ou Fastify puros. Num plano gratuito com
   cold start, isso pesa.

### As peças, uma a uma, com exemplos deste projeto

#### Módulo (`@Module`)

Uma caixa que declara o que existe dentro dela. Não tem lógica, é planta baixa.

```ts
// src/comissoes/comissoes.module.ts
@Module({
  imports: [AutenticacaoModule, TypeOrmModule.forFeature([Comissao, ParcelaComissao])],
  controllers: [ComissoesController],
  providers: [ComissoesService],
  exports: [ComissoesService],
})
export class ComissoesModule {}
```

- `imports`: outros módulos de que este precisa. Aqui, os guards de autenticação e os repositórios.
- `controllers`: quem atende HTTP.
- `providers`: classes que o Nest instancia e injeta.
- `exports`: o que outros módulos podem usar. **Sem `exports`, a injeção falha no boot.**

O `AppModule` (`src/app.module.ts`) é a raiz: importa a configuração, o banco, o agendador e os nove
módulos de domínio.

**Três formas de registrar módulos que você vai ver:**

- `forRoot(...)`: configuração global, uma vez, no módulo raiz. Ex.: `ConfigModule.forRoot`, `ScheduleModule.forRoot`.
- `forRootAsync({ inject, useFactory })`: igual, mas a configuração depende de outra coisa que só existe em
  execução. Ex.: o banco precisa do `ConfigService` já validado.
- `forFeature([...])`: registra repositórios de entidades **dentro de um módulo específico**.

#### Provider e injeção de dependência

```ts
// src/corretores/corretores.service.ts
@Injectable()
export class CorretoresService {
  constructor(
    @InjectRepository(Corretor) private readonly corretores: Repository<Corretor>,
    private readonly senhas: SenhasService,
  ) {}
}
```

Você **não** escreve `new CorretoresService(...)`. O Nest lê os tipos do construtor, procura quem oferece
cada um e entrega pronto. Isso é **injeção de dependência** (DI).

**Por que o Nest consegue ler o tipo, se os tipos somem na compilação?** Por causa de
`emitDecoratorMetadata: true` no `tsconfig.json` e do `import 'reflect-metadata'` no `main.ts`. O compilador
grava os tipos dos parâmetros como metadado, e o Nest os lê em execução. Sem essas duas coisas, nada funciona.

**Provider com token próprio.** Quando o que você injeta não é uma classe sua, você cria um token:

```ts
// src/midias/midias.module.ts
providers: [MidiasService, {
  provide: R2_MIDIAS,
  inject: [ConfigService],
  useFactory: (configuracao: ConfigService) => new S3Client({ ... }),
}]

// src/midias/midias.service.ts
constructor(@Inject(R2_MIDIAS) private readonly armazenamento: S3Client) {}
```

O cliente do R2 é criado uma vez, com as credenciais do ambiente, e injetado onde for pedido. Nos testes,
basta trocar esse provider por um falso.

#### Controller

Mapeia URL para método. Neste projeto os controllers são **finos de propósito**: recebem, delegam ao service
e devolvem.

```ts
// src/imoveis/imoveis.controller.ts
@Controller('admin/imoveis')
@UseGuards(AutenticacaoGuard)
export class ImoveisController {
  constructor(private readonly imoveis: ImoveisService) {}
  @Get(':id') encontrar(@Param('id', ParseIntPipe) id: number) { return this.imoveis.encontrar_interno(id); }
  @Delete(':id') @HttpCode(204) desativar(...) { ... }
}
```

Decorators de parâmetro que aparecem no projeto: `@Body()`, `@Query()`, `@Param()`, `@Req()`, `@Res()`,
`@UploadedFiles()`. Decorators de método: `@HttpCode(204)`, `@Header('Cache-Control', 'no-store')`.

**Peculiaridade: `@Res({ passthrough: true })`.** No login, o controller precisa gravar um cookie na resposta.
Se você injeta `@Res()` puro, o Nest para de cuidar da resposta e você precisa enviá-la à mão. Com
`passthrough: true`, você grava o cookie e o Nest continua serializando o retorno normalmente.

**Peculiaridade: controllers gerados por função.** Em `src/cadastros/cadastros.controller.ts`, as funções
`controladorPublico(categoria)` e `controladorAdministrativo(categoria)` **fabricam classes** de controller.
Funciona porque decorators são só funções: a mesma classe decorada é criada três vezes, uma para cada
categoria. É um truque elegante, mas pouco comum; não imite sem motivo.

#### Guard

Responde a uma pergunta: **esta requisição pode entrar?** Devolve `true` ou lança exceção.

Os guards deste projeto:

| Guard | Arquivo | O que decide | Erro |
|---|---|---|---|
| `AutenticacaoGuard` | `autenticacao/autenticacao.guard.ts` | o token JWT é válido e o corretor está ativo? | 401 |
| `CargosGuard` | `autenticacao/cargos.guard.ts` | o cargo do usuário está na lista de `@Cargos(...)`? | 403 |
| `OrigemGuard` | `autenticacao/origem.guard.ts` | o header `Origin` está em `ALLOWED_ORIGINS`? | 403 |
| `TentativasGuard` | `autenticacao/tentativas.guard.ts` | passou do limite de tentativas de login? | 429 |
| `LimitePessoasGuard` | `pessoas/limite-pessoas.guard.ts` | passou de 5 contatos por minuto por IP? | 429 |

**Como o `CargosGuard` sabe quais cargos a rota exige?** Por metadado:

```ts
export const Cargos = (...cargos) => SetMetadata('cargos_permitidos', cargos);
// ...
const cargos = this.reflector.getAllAndOverride('cargos_permitidos', [contexto.getHandler(), contexto.getClass()]);
```

`@Cargos('ADMIN')` grava uma etiqueta na rota. O guard lê a etiqueta com o `Reflector`. Esse é o padrão do Nest
para decorators personalizados de autorização.

**Não existe guard global.** Cada controller declara os seus. O lado bom: fica explícito. O lado ruim:
**uma rota nova sem `@UseGuards` nasce pública**. Isso é a coisa mais importante para lembrar ao criar endpoint.

#### Pipe

Transforma e valida o que entra. Dois tipos aparecem aqui:

- **`ValidationPipe` global** (`main.ts`), com três opções que você precisa decorar:
  - `whitelist: true` remove do corpo qualquer campo que não esteja no DTO.
  - `forbidNonWhitelisted: true` transforma essa remoção em **erro 400**.
  - `transform: true` entrega o DTO como instância de classe de verdade, o que ativa `@Transform` e `@Type`.
  Consequência prática: **todo campo novo precisa ser declarado no DTO**, senão a requisição responde 400.
  Isso impede *mass assignment*: ninguém consegue mandar `cargo: "ADMIN"` onde o DTO não prevê.
- **`ParseIntPipe`** nos parâmetros de URL: `/admin/imoveis/abc` responde 400 antes de chegar ao service.

#### DTO (Data Transfer Object)

Uma classe que descreve o formato aceito, com decorators do `class-validator` e do `class-transformer`.

```ts
// src/autenticacao/autenticacao.dto.ts
export class EntrarDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail() @MaxLength(254)
  email!: string;

  @IsString() @Length(1, 128)
  senha!: string;
}
```

Padrões que se repetem no projeto e valem entender:

- **`@Transform(aparar)`** tira espaços antes de validar.
- **`@ValidateIf(informado)`** só valida se o valor não for `null` nem `undefined`. Permite mandar `null`
  para **limpar** um campo opcional.
- **`PartialType(CriarImovelDto)`** gera o DTO de alteração com todos os campos opcionais, sem reescrever.
  Vem de `@nestjs/mapped-types`. `PickType` escolhe só alguns campos.
- **`IdRegistro()`** (`src/comum/dto.ts`) é um decorator **composto**: junta `@Type(() => Number)`, `@IsInt()`
  e `@Min(1)` num só, com `applyDecorators`.
- **Validadores próprios** em `src/comum/validacao.ts`: `@DocumentoValido()` confere os dígitos verificadores
  de CPF e CNPJ; `@TelefoneValido()` aceita telefone brasileiro com ou sem 55; `@DataCivilValida()` recusa
  datas como 31/02.
- **Query string é sempre texto.** Por isso os DTOs de consulta usam `@Type(() => Number)` em `pagina` e
  `limite`. No corpo JSON, número chega como número.

#### Interceptor

Envolve a execução do handler, antes e depois. O único do projeto é o `FilesInterceptor` do upload de mídia,
que lê o multipart com o Multer, guarda os arquivos **em memória** e limita tamanho e quantidade.

#### Exception filter

Captura erros e decide a resposta. O `GlobalExceptionFilter` (`src/common/filters/global-exception.filter.ts`)
pega **qualquer** erro: se for `HttpException`, usa o status e a mensagem dela; se não for, responde 500 com
"Erro interno do servidor." e registra no log só um código genérico, **nunca** o SQL ou os dados.

Nos services, você lança exceções prontas do Nest e o filtro faz o resto:
`NotFoundException` (404), `BadRequestException` (400), `ForbiddenException` (403),
`UnauthorizedException` (401), `ConflictException` (409), `ServiceUnavailableException` (503).

#### Middleware

Roda antes de tudo, no nível do Express. Aqui: `helmet()` (headers de segurança), o reescritor de URL que
acrescenta `/api/v1`, e o CORS.

#### Ciclo de vida e agendamento

- **`OnModuleInit` / `OnModuleDestroy`**: métodos chamados quando o módulo sobe e desce. O `SessoesService` usa
  para ligar e desligar a limpeza horária de sessões expiradas.
- **`enableShutdownHooks()`** no `main.ts` garante que esses métodos rodem quando o processo recebe sinal de parada.
- **`@Cron('0 * * * *')`** de `@nestjs/schedule`: executa um método a cada hora. Usado para encerrar contratos
  vencidos e marcar parcelas atrasadas.
- **`NestFactory.createApplicationContext`** (em `commands/bootstrap-admin.ts`): sobe o Nest **sem servidor HTTP**,
  só para usar os services num script de linha de comando.

### A ordem em que tudo acontece numa requisição

```text
1. Middleware do Express  (helmet, reescrita de URL, CORS, leitura do corpo JSON)
2. Guards                 (autenticação, cargo, origem, limite)
3. Interceptors (antes)   (upload de arquivos)
4. Pipes                  (ValidationPipe, ParseIntPipe)
5. Handler do controller  → service → banco / R2 / Drive
6. Interceptors (depois)
7. Serialização em JSON e envio
   Qualquer erro em qualquer etapa → GlobalExceptionFilter
```

**A consequência que mais confunde: guard roda antes de pipe.** Um `POST /admin/imoveis` sem token **e** com
corpo inválido responde **401**, nunca 400. A validação nem chega a rodar.

Segunda consequência: o `TentativasGuard` precisa do e-mail para contar tentativas, mas o DTO ainda não foi
validado nem transformado quando ele roda. Por isso o guard lê o corpo cru e faz a própria normalização
(`trim().toLowerCase()`).

---

## 6. TypeORM e o banco de dados

### Entity, Repository, Migration: três coisas diferentes

- **Entity** é uma classe anotada que descreve uma tabela para o ORM (`src/imoveis/imovel.entity.ts`).
  **Ela não cria nada no banco.**
- **Repository** é o objeto que consulta e grava aquela tabela: `find`, `findOneBy`, `save`, `update`,
  `createQueryBuilder`.
- **Migration** é um arquivo com o SQL que **de fato** cria e altera o schema (`src/database/migrations/`).

`synchronize: false` e `migrationsRun: false` em `src/config/database.config.ts`: o TypeORM **nunca** altera o
banco sozinho. Se você adiciona uma coluna na entity e esquece a migration, o código compila e **quebra em
execução**, porque a coluna não existe no banco.

**Regra inegociável:** migration aplicada **nunca** é editada, renomeada ou apagada. Para mudar o schema, cria-se
uma migration nova. Editar uma aplicada deixa o histórico do banco real diferente do código.

### As 10 migrations e a história do schema

| Migration | O que fez |
|---|---|
| `1789084800000` a `1789084804000` | modelo original em inglês: `agents`, `properties`, `property_media`, `leads`, `refresh_sessions` |
| `1789257600000`, `1789344000000`, `1789430400000` | administração de locações, comissões de captação e pagamentos de aluguel (modelo intermediário) |
| `1789516800000-modelo-portugues` | reescreve tudo em português, com UUID, e arquiva as tabelas antigas no schema `legado_20260913` |
| `1789603200000-ids-inteiros-pessoas` | troca UUID por inteiro, funde clientes e partes em `pessoas` e arquiva o anterior em `legado_20260916` |

Existe ainda `1789084805000-hardening.ts` no disco, **fora** da lista registrada em `src/database/registros.ts`.
Ela nunca roda. As duas últimas migrations recusam reversão (`down` lança erro): voltar atrás exige restaurar backup.

Em 17/09/2026 o banco foi zerado e as 10 rodaram do zero, então os schemas `legado_*` existem e estão vazios.

### As tabelas atuais

| Tabela | Guarda | Detalhes que importam |
|---|---|---|
| `corretores` | usuários do painel | `senha_hash` com `select: false`; e-mail único e minúsculo; `cargo` ADMIN ou CORRETOR |
| `sessoes_login` | sessões de renovação | chave primária é o SHA-256 do token; `ON DELETE CASCADE` com o corretor |
| `tipos_imovel`, `finalidades_imovel` | classificações do catálogo | cadastráveis pelo ADMIN; seeds: 5 tipos, 3 finalidades |
| `caracteristicas` e `imoveis_caracteristicas` | etiquetas como "Portaria 24h" | tabela de ligação com chave composta e campo `valor` |
| `imoveis` | o catálogo | `valor_venda` e `valor_locacao` opcionais; ficha interna (proprietário, chaves, matrícula) |
| `imoveis_midias` | fotos e vídeos | única exclusão física; índice único parcial garante uma só capa |
| `pessoas` | lead, cliente, proprietário e inquilino | um cadastro só; `status_contato`; IP do consentimento com `select: false` |
| `contrato` | contratos de locação | índice único parcial: um só contrato ATIVO por imóvel |
| `comissoes` e `parcelas_comissao` | receita da imobiliária | parcelas geradas automaticamente, baixa manual |
| `pastas_drive` | registro das pastas criadas no Drive | garante que a mesma pasta não seja criada duas vezes |

### Padrões de modelagem que atravessam todas as tabelas

**Auditoria universal.** Toda entity herda de `Auditoria` (`src/comum/auditoria.entity.ts`):
`criado_em`, `alterado_em`, `criado_por`, `alterado_por`. Você sempre sabe quem mexeu e quando.

**Exclusão lógica (soft delete).** `DELETE /admin/imoveis/5` não apaga a linha: grava `ativo = false` e
responde 204. `PATCH { "ativo": true }` reativa. Motivo: contratos, comissões e histórico de atendimento não
podem perder referências. A exceção é a mídia, apagada de verdade do banco e do R2 para economizar espaço.

**Ids inteiros gerados pelo banco.** `GENERATED BY DEFAULT AS IDENTITY`. Decisão do dono em 16/09: ids curtos
permitem buscar "imóvel #42" e simplificam as URLs.

**Dinheiro como texto.** Colunas `numeric(12,2)` voltam do driver `pg` como **string** (`"1500.00"`), porque o
`number` do JavaScript é ponto flutuante e erra centavos. O projeto mantém string de ponta a ponta:
os DTOs exigem o formato `"1500.00"` e o cálculo de parcelas converte para **centavos em `BigInt`**
(`src/comissoes/parcelamento.ts`). Nunca some dinheiro com `number`.

**Datas civis como texto.** Colunas `date` (vencimento, início de contrato) circulam como `"2026-09-17"`.
Datas de negócio usam o fuso `America/Cuiaba` (`src/comum/datas.ts`), o do escritório.

**Regras no banco, não só no código.** As migrations criam `CHECK`s (área útil positiva, valores não negativos,
documento coerente com PF/PJ, contato do site exige consentimento) e **índices únicos parciais**:

```sql
CREATE UNIQUE INDEX unico_contrato_ativo_imovel ON contrato (imovel_id) WHERE status = 'ATIVO';
CREATE UNIQUE INDEX uq_imoveis_midias_capa ON imoveis_midias (imovel_id) WHERE capa = true;
```

O código valida, mas se duas requisições simultâneas passarem pela validação, o banco é a última barreira.

**`ON DELETE`** diz o que acontece com a linha filha quando a mãe é apagada:

- `RESTRICT`: impede a exclusão. Usado em quase tudo (imóvel de corretor, contrato de pessoa).
- `CASCADE`: apaga junto. Usado em mídias e características do imóvel, e sessões do corretor.
- `SET NULL`: mantém a filha e zera a referência. Usado no imóvel de interesse da pessoa.

**Busca textual rápida.** A extensão `pg_trgm` e índices GIN aceleram buscas `ILIKE '%termo%'` em nome,
título, cidade, bairro, telefone e documento.

### Consultas: três estilos no mesmo projeto

1. **Métodos do repositório**, para casos simples:
   ```ts
   this.corretores.findOneBy({ id, ativo: true })
   ```
2. **Opções de busca com relações**:
   ```ts
   this.imoveis.findOne({ where, relations: { corretor: true, midias: true } })
   ```
3. **QueryBuilder**, para filtros dinâmicos e SQL mais fino:
   ```ts
   const busca = this.pessoas.createQueryBuilder('pessoa');
   if (consulta.status_contato) busca.andWhere('pessoa.status_contato = :status', { status: consulta.status_contato });
   ```
   O `:status` é um **parâmetro**. O valor nunca é colado no SQL, e isso impede SQL injection.

**`escaparBusca`** (`src/comum/validacao.ts`) escapa `%` e `_` antes de um `ILIKE`. Não é contra SQL injection
(o parâmetro já cuida disso): é para que uma busca por `%` não case com todos os registros.

**Paginação em duas fases nos imóveis.** Carregar relações de um-para-muitos junto com `LIMIT` faz o banco
contar linhas do JOIN, não imóveis, e a paginação quebra. Por isso `ImoveisService.listar` primeiro busca só
os ids da página, ordenados, e depois carrega imóveis, mídias e características desses ids.

### Transações e travas

Quando uma regra depende de "ler, decidir e gravar", duas requisições simultâneas podem decidir errado.
O projeto usa três ferramentas:

1. **Transação** (`manager.transaction(async gerenciador => { ... })`): tudo lá dentro acontece junto ou nada acontece.
2. **Trava pessimista de linha** (`lock: { mode: 'pessimistic_write' }`, vira `SELECT ... FOR UPDATE`): quem chega
   depois espera o primeiro terminar. Usado ao editar imóvel, pessoa, contrato e parcela.
3. **Advisory lock** (`SELECT pg_advisory_xact_lock(741901)`): uma trava por **número**, não por linha, liberada
   no fim da transação. Serve para regras que nenhuma linha representa sozinha.

O exemplo clássico está em `CorretoresService.atualizar`: "não pode rebaixar o último ADMIN". Sem a trava, dois
ADMINs rebaixando um ao outro ao mesmo tempo veriam "existem dois ADMINs" e ambos passariam. O sistema ficaria
sem administrador. Nenhuma constraint de banco consegue expressar "pelo menos um ADMIN ativo"; o advisory lock
serializa essas operações.

Contratos e comissões usam a mesma ideia com `hashtext('locacoes:integridade')` e `hashtext('comissoes:integridade')`.

---

## 7. Mapa do código, módulo por módulo

```text
src/
  main.ts            ponto de entrada: helmet, filtro de erros, prefixo, CORS, ValidationPipe, porta
  app.module.ts      módulo raiz: configuração validada, TypeORM, agendador e os nove módulos
  config/            validação das variáveis de ambiente e opções de conexão com TLS
  comum/             auditoria, validadores de CPF/CNPJ/telefone/data, decorators de DTO, datas
  common/filters/    o filtro global de exceções
  autenticacao/      login, renovação, saída, perfil, guards, estratégia JWT, sessões
  corretores/        CRUD de corretores (ADMIN), hash de senha, proteção do último ADMIN
  cadastros/         tipos, finalidades e características do catálogo
  imoveis/           catálogo público e gestão interna, filtros, ordenação, slug
  midias/            upload para o R2, vídeos do YouTube/Vimeo, ordem, capa, exclusão
  pessoas/           contato do site com LGPD e cadastro manual de pessoas
  locacoes/          contratos de locação e integração com o Drive
  comissoes/         comissões e parcelas
  drive/             cliente HTTP do Google Drive e registro de pastas
  saude/             GET /saude, que testa o banco com SELECT 1
  database/          DataSource do CLI, registro de migrations, logger que não vaza dados
  commands/          bootstrap do primeiro ADMIN e executor de migrations
  testing/           substituto do agendador nos testes
```

### `config/`

- `env.validation.ts` trata o `.env` como entrada não confiável e valida com os mesmos decorators dos DTOs.
  Se algo falhar, o processo **morre no boot**, e a mensagem lista **só os nomes** dos campos, nunca os valores.
  Regras que chamam atenção: `DATABASE_URL` precisa ser Neon com `sslmode` e sem parâmetros extras;
  `JWT_SECRET` com 32 caracteres ou mais; em produção, `ALLOWED_ORIGINS` só HTTPS; as quatro variáveis do
  Drive vêm juntas ou nenhuma, e a chave precisa ser RSA de 2048 bits ou mais.
- `database.config.ts` apaga os parâmetros SSL da URL e força `ssl: { rejectUnauthorized: true }`. Motivo: no
  driver `pg`, parâmetros da URL vencem o objeto `ssl`, e alguém poderia desligar a verificação do certificado.

### `autenticacao/` e `corretores/`

Detalhados no fluxo de login (seção 8). Destaques:

- `SenhasService` é o **único** lugar que gera e confere hash, com Argon2id.
- `perfilCorretor()` monta a resposta **campo a campo**, sem o hash.
- Trocar a própria senha revoga **todas** as sessões do corretor. Redefinir a senha de outro corretor pelo ADMIN
  (`PATCH /admin/corretores/:id`) **não** revoga.

### `cadastros/`

Classificações dinâmicas: o ADMIN cria "Galpão", "Locação", "Pé-direito alto" pelo painel, sem deploy.
A leitura pública mostra só os ativos. Duplicata de nome ou slug responde 409, graças à tradução do erro
`23505` (violação de unicidade) do PostgreSQL.

### `imoveis/`

- Dois controllers: `ImoveisPublicosController` (`/imoveis`) e `ImoveisController` (`/admin/imoveis`).
- O público força `ativo = true AND status = 'DISPONIVEL' AND corretor.ativo = true`.
- **Qualquer corretor autenticado lê todos os imóveis internos**, mas só o dono ou ADMIN altera (403 para os outros).
- **Slug = título normalizado + id** (`galpao-na-br-163-42`). Muda quando o título muda. A rota pública localiza
  pelo número no fim, então links antigos continuam funcionando. Para saber o id antes do INSERT, o service
  pede o próximo valor da sequência com `nextval`.
- **Duas funções de resposta**: `resposta_imovel_publico` e `resposta_imovel` (interna, com proprietário,
  matrícula, chaves e observações). Campo interno nunca sai na rota pública.
- O preço usado em filtro e ordenação depende da finalidade: venda usa `valor_venda`, locação usa
  `valor_locacao`, sem filtro usa o primeiro preenchido. Nulos ficam por último.

### `midias/`

- Upload multipart com campo `arquivos`: até 20 arquivos, imagem até 10 MB, vídeo até 30 MB, lote até 60 MB.
- `validacao-arquivo.ts` confere os **primeiros bytes do arquivo** (assinatura), não só o tipo declarado pelo
  cliente. Um `.exe` renomeado para `.jpg` é recusado.
- A chave no R2 é `imoveis/{id}/{uuid}{extensão}`. Nenhum texto enviado pelo cliente entra no caminho.
- Vídeos do YouTube e Vimeo são normalizados para a URL de embed, comparando o host por igualdade exata.
  `youtube.com.site-falso.net` não passa. YouTube vira `youtube-nocookie.com`.
- A primeira imagem vira capa. Apagar a capa promove a próxima imagem.

### `pessoas/`

- **Uma pessoa é uma pessoa.** O contato do site, o cliente, o proprietário e o inquilino são o mesmo cadastro.
- `POST /pessoas` (site) exige `consentimento: true`, imóvel ativo e disponível; grava IP, data e versão dos
  termos; nasce com `status_contato = PENDENTE`; responde só `{ id }`.
- Cadastro manual pelo painel nunca finge consentimento: grava `consentimento = false`.
- Visibilidade: ADMIN vê todas; corretor vê as que atende e as que participam de contratos que intermedeia.
  O filtro entra no `WHERE`, então pessoa alheia responde **404**, não 403.
- Se vier só o CPF/CNPJ, o tipo PF/PJ é deduzido pelo tamanho (11 ou 14 dígitos).
- Pessoa com contrato ativo não pode ser desativada (409).

### `locacoes/` e `drive/`

- Contrato liga imóvel, locador, locatário e corretor. Locador e locatário precisam ser pessoas diferentes.
- Corretor comum só cria contrato sob a própria intermediação.
- Contratos com `data_fim` no passado viram INATIVO: a cada hora pelo `@Cron` e também antes de cada consulta.
- Ao salvar um contrato ativo, o serviço tenta criar a pasta `Imobiliária/Contratos/{número} - {locatário}` no
  Drive compartilhado. **Se o Drive falhar, o contrato continua salvo** com `status_pasta_drive = FALHOU`, e existe
  uma rota para tentar de novo.

### `comissoes/`

- Comissão de VENDA não tem contrato; de LOCAÇÃO exige contrato do mesmo imóvel. O banco também garante isso com CHECK.
- Pessoa e imóvel precisam ter o mesmo corretor responsável.
- Parcelas geradas automaticamente, até 600. Os centavos que sobram da divisão vão para as primeiras parcelas.
  Vencimento dia 31 em fevereiro cai no último dia do mês, sem empurrar os meses seguintes.
- Baixa manual exige `confirmar_pagamento: true` e uma referência do comprovante. Repetir a mesma baixa é
  **idempotente** (não dá erro); baixar com comprovante diferente dá 409.

### `database/` e `commands/`

- `LoggerSeguro` silencia os logs do TypeORM, porque SQL com parâmetros pode conter CPF e telefone.
- `commands/migracoes.ts` é o executor de `npm run migration:*`. Para executar ou reverter, exige
  `MIGRACAO_BACKUP_ARQUIVO` apontando para um backup não vazio. Sem backup, não roda.
- `commands/bootstrap-admin.ts` cria o primeiro ADMIN e recusa se já houver um.

---

## 8. Os seis fluxos que você precisa saber narrar

Se você consegue contar estes seis fluxos sem olhar, você entende o sistema. Treine em voz alta.

### Fluxo 1 — Login e renovação de sessão

**Por que existem dois tokens.** O token de acesso é usado em toda requisição, então precisa ser rápido de
conferir e dura pouco. O token de renovação é usado raramente, então pode ser guardado no banco e revogado.

| | Token de acesso | Token de renovação |
|---|---|---|
| Formato | JWT assinado (HS256) | 48 bytes aleatórios |
| Duração | 15 minutos | 30 dias |
| Onde o front guarda | só na memória | cookie `corretor_renovacao` HttpOnly |
| Onde o servidor guarda | em lugar nenhum | SHA-256 na tabela `sessoes_login` |
| Revogável | não, só expira | sim, apagando a linha |

**Passo a passo do `POST /autenticacao/entrar`:**

1. `OrigemGuard` confere o `Origin` contra `ALLOWED_ORIGINS`. Origem estranha: 403.
2. `TentativasGuard` conta tentativas: 50 por IP e 10 por conta a cada 15 minutos. Passou: 429.
3. `ValidationPipe` valida o `EntrarDto` e põe o e-mail em minúsculas.
4. `AutenticacaoService.entrar` busca o corretor **com** o hash (que normalmente é oculto por `select: false`).
5. Confere a senha com Argon2id. **Se o e-mail não existe, confere contra um hash de disfarce**, para que a
   resposta demore o mesmo tempo. Sem isso, um atacante descobriria quais e-mails existem medindo o tempo.
6. Mensagem sempre igual para e-mail ou senha errados: "E-mail ou senha inválidos."
7. Emite o JWT com `sub` (id do corretor) e `cargo`, cria a sessão no banco e grava o cookie.
8. O controller **tira** o token de renovação do corpo da resposta. Ele só existe no cookie.

**Toda requisição autenticada depois disso:**

1. O front manda `Authorization: Bearer <token_acesso>`.
2. `AutenticacaoGuard` chama a `EstrategiaJwt`, que confere assinatura, algoritmo, emissor, audiência e expiração.
3. **A estratégia vai ao banco e relê o corretor.** O `cargo` do token **não** é usado para autorizar: vale o do banco.
   Desativar ou rebaixar um corretor tem efeito na requisição seguinte, sem esperar os 15 minutos.
4. O usuário lido vira `request.user` e chega ao service.

**`POST /autenticacao/renovar`:**

1. Lê o cookie à mão (não há `cookie-parser`).
2. `SessoesService.consumir` executa **um único comando**: `DELETE ... WHERE token_hash = ... RETURNING ...`.
   Se duas renovações chegarem juntas com o mesmo cookie, só uma recebe a linha. A outra leva 401.
   O token de renovação é de **uso único** e é trocado a cada renovação.
3. Emite um par novo.

**Por que SHA-256 no token e Argon2 na senha?** Argon2 é lento de propósito, contra quem testa milhões de senhas
humanas. Um token de 384 bits aleatórios não tem dicionário para testar. E o hash do token é a chave primária da
tabela, então precisa ser determinístico para busca. SHA-256 é a ferramenta certa para cada caso.

### Fluxo 2 — Catálogo público

`GET /api/v1/imoveis?finalidade_id=1&cidade=Sinop&ordenar=valor_asc&pagina=2`

1. Nenhum guard: rota pública.
2. `ValidationPipe` monta o `ConsultaImoveisDto`: converte texto em número, aplica padrões (`pagina = 1`,
   `limite = 20`, máximo 100) e recusa campo desconhecido com 400.
3. O service descobre a coluna de preço pela finalidade e monta o QueryBuilder com a restrição pública.
4. Conta o total, busca os ids da página ordenados, depois carrega imóveis, corretor, mídias e características.
5. `resposta_imovel_publico` escolhe os campos que saem. Do corretor sai só nome, WhatsApp, CRECI e foto.
6. Resposta: `{ itens, total, pagina, limite, total_paginas }`.

### Fluxo 3 — Contato do site (LGPD)

`POST /api/v1/pessoas` com `{ imovel_id, nome, telefone, email?, mensagem?, consentimento: true }`

1. `LimitePessoasGuard`: no máximo 5 envios por minuto por IP.
2. `PessoaPublicaDto`: telefone brasileiro válido e `consentimento` exatamente `true`.
3. O service confere de novo o consentimento (defesa em profundidade) e busca o imóvel ativo e disponível.
4. A pessoa é atribuída ao **corretor do imóvel**, com origem SITE, status PENDENTE, IP, data e versão dos termos.
5. O banco também recusa contato do site sem consentimento, por um `CHECK`.
6. Resposta: `{ id }`, sem ecoar os dados.

**O que não acontece:** ninguém é avisado. O contato espera alguém abrir o painel. É a tarefa aberta NOTIFY-001.

### Fluxo 4 — Upload de fotos

`POST /api/v1/admin/imoveis/42/midias` com multipart `arquivos`

1. `AutenticacaoGuard`, depois o `FilesInterceptor` lê os arquivos para a memória, com limites.
2. Cada arquivo é validado por assinatura de bytes e tamanho.
3. Abre uma transação e **trava o imóvel** (`pessimistic_write`); confere se o usuário é dono ou ADMIN.
4. Envia cada arquivo ao R2 e anota a chave numa lista.
5. Grava as linhas de `imoveis_midias`.
6. **Se qualquer coisa falhar**, apaga do R2 todas as chaves da lista. Isso se chama **compensação**: banco e R2
   não compartilham transação, então o código desfaz à mão o que já tinha feito fora do banco.
7. A exclusão faz o caminho inverso: baixa uma cópia do arquivo, apaga no R2, apaga a linha; se o banco falhar,
   devolve a cópia ao R2.

Nada é gravado no disco do servidor, porque o disco do Render é apagado a cada reinício.

### Fluxo 5 — Contrato de locação com pasta no Drive

1. Transação com advisory lock de locações, que também encerra contratos vencidos.
2. Valida datas, valores, partes distintas, pessoas e imóvel ativos, travando as linhas na mesma ordem
   para evitar deadlock.
3. Salva. Se já houver contrato ATIVO no imóvel, o índice único parcial estoura e o erro vira 409.
4. **Depois de salvo**, tenta criar a pasta no Drive:
   - Registra a pasta em `pastas_drive` com um **id pré-gerado pelo Google**, antes de criá-la de fato.
   - Cria a pasta usando esse id. Se a rede cair e a tentativa se repetir, o Google responde 409 ("já existe")
     e o código entende que a criação anterior deu certo. Isso torna a operação **idempotente**.
   - Confere que nenhuma permissão da pasta é pública (`anyone` ou `domain`).
5. Sucesso: `status_pasta_drive = CRIADA` e o link. Falha: `FALHOU`, contrato preservado, rota de nova tentativa.

O cliente do Drive (`drive/drive-cliente.ts`) não usa a biblioteca oficial do Google. Ele assina o JWT RS256 com
`node:crypto` e chama a API com `fetch`, com timeout de 10 segundos e até três tentativas. Motivo registrado:
não adicionar dependência.

### Fluxo 6 — Comissão e parcelas

1. Valida a coerência entre tipo de operação e contrato.
2. Calcula as parcelas **antes** da transação: converte o total para centavos em `BigInt`, divide, distribui o resto.
3. Na transação, confere contrato, imóvel e pessoa, e grava a comissão e as parcelas.
4. Parcelas com vencimento passado já nascem ATRASADO. As demais viram ATRASADO pelo `@Cron` e a cada consulta.
5. A resposta calcula `valor_pago` e `saldo_pendente` em centavos, sem erro de arredondamento.

---

## 9. Segurança: a corrente de proteções

Segurança aqui não é uma parede, é uma sobreposição de camadas. Cada uma cobre a falha possível da anterior.

| Camada | Onde | Protege contra |
|---|---|---|
| Validação do ambiente | `config/env.validation.ts` | segredo curto, banco errado, TLS desligado, segredo impresso em log |
| TLS verificado | `config/database.config.ts` | interceptação da conexão com o banco |
| Headers HTTP | `helmet()` no `main.ts` | clickjacking, *MIME sniffing*, ausência de HSTS |
| `ValidationPipe` com whitelist | `main.ts` | *mass assignment*: mandar `cargo`, `senha_hash`, `ativo` onde não pode |
| Argon2id e `select: false` | `SenhasService`, entities | vazamento de senha mesmo com o banco exposto |
| Hash de disfarce no login | `AutenticacaoService` | descobrir quais e-mails existem pelo tempo de resposta |
| Par de tokens e cookie HttpOnly | autenticação | XSS roubando sessão longa |
| `SameSite=Strict` e `OrigemGuard` | cookie e guard | CSRF, com uma defesa no navegador e outra no servidor |
| Limites de tentativa | `TentativasGuard`, `LimitePessoasGuard` | força bruta e spam de contatos |
| Cargo relido do banco | `EstrategiaJwt` | JWT que não pode ser revogado |
| Filtro de dono no `WHERE` | services | IDOR: acessar registro de outro trocando o id |
| Respostas montadas à mão | funções `resposta_*` | vazar e-mail, cargo, chave do R2, IP do consentimento |
| Assinatura de bytes e host exato | `midias/` | arquivo disfarçado e host enganoso |
| Filtro global e logger seguro | `common/filters`, `database/log-seguro.ts` | vazar SQL, stack trace ou dado pessoal |

**Três conceitos que você precisa saber explicar:**

- **XSS** é código malicioso rodando dentro da página. Ele lê tudo que o JavaScript lê. Por isso o token longo
  fica num cookie HttpOnly, que o JavaScript não lê.
- **CSRF** é outro site fazendo o seu navegador disparar uma requisição autenticada, porque cookies vão sozinhos.
  Por isso `SameSite=Strict` e o `OrigemGuard` nas rotas que dependem do cookie. As demais rotas usam o header
  `Authorization`, que o navegador **não** envia sozinho, então não sofrem CSRF.
- **IDOR** é acessar o registro de outra pessoa trocando o id na URL. O projeto responde 404, e não 403, para
  registros alheios de pessoas e contratos: assim ninguém descobre se o id existe.

**Fragilidades conhecidas, que estão no código hoje:**

- Os limites de tentativa ficam **na memória do processo**. Com duas instâncias, o limite dobra; a cada reinício, zera.
- Quando o mapa do `TentativasGuard` chega a 10.000 chaves, **todo** login leva 429 por até 15 minutos.
  Um atacante pode encher o mapa com e-mails aleatórios e trancar o login de todos.
- Não há guard global: rota nova sem `@UseGuards` é pública.
- O cookie é sempre `Secure`, então o login pelo navegador exige HTTPS inclusive em desenvolvimento.

---

## 10. Decisões e seus porquês

| Decisão | Por quê | O que foi rejeitado |
|---|---|---|
| NestJS em servidor Node comum | Argon2id precisa de CPU; estrutura padronizada para vários agentes | Cloudflare Workers com Hono (limite de CPU) |
| TypeORM | padrão maduro do Nest; um ORM só | Prisma, Drizzle |
| class-validator | integração nativa com o `ValidationPipe`; um validador só | zod, Joi (no back) |
| Neon PostgreSQL | gratuito, não pausa por dias, região São Paulo | Supabase (pausa longa), Postgres local |
| Conexão direta, sem pooler | migrations e advisory locks precisam de sessão | URL `-pooler` |
| Cloudflare R2 | saída de dados gratuita; disco do Render é efêmero | gravar upload em disco |
| Migrations explícitas | schema versionado e auditável | `synchronize: true` |
| Ids inteiros | ids curtos, busca por "#42", URLs legíveis | UUID em tudo (usado até 16/09) |
| Cadastro único de pessoas | o lead vira cliente, proprietário ou inquilino sem duplicar | tabelas separadas por papel |
| Exclusão lógica | preservar histórico de contratos e comissões | `DELETE` físico |
| Dados pessoais sem criptografia de coluna | criptografia de coluna impede índice e busca `ILIKE`; TLS e disco cifrado do Neon cobrem o resto | AES por coluna (usado no modelo antigo) |
| Access token curto e refresh rotativo em cookie | revogação e resistência a XSS | token longo em `localStorage` |
| Cargo relido do banco a cada requisição | revogação imediata de privilégio | confiar no cargo do JWT |
| Documentos de contrato no Google Drive | a imobiliária já trabalha no Drive; bucket privado evitado | documentos no R2 |
| Trabalho direto na `main` | projeto pequeno, agentes um de cada vez | branches paralelas |
| Tudo em português | vocabulário único de ponta a ponta, sem tradutor no front | nomes em inglês (modelo antigo) |

O `DECISIONS.md` tem cada uma com data e a lista do que **não** fazer. Leia depois deste guia.

---

## 11. Como o projeto se testa

**Ferramentas:** Jest com `ts-jest`. Os arquivos `*.spec.ts` ficam ao lado do código. `npm test` roda tudo em série
(`--runInBand`). O registro de 17/09 anota 175 testes aprovados. Na execução de 17/09 feita para este guia, 174 passaram
e 1 falhou por **tempo esgotado**: o `bootstrap.spec.ts` sobe o `main.ts` num subprocesso com limite de 15 segundos, e
nesta máquina (Windows com a pasta no OneDrive) a subida passou disso. Não é erro de lógica, mas é um teste instável.
A suíte de integração é ignorada sem banco local.

**Quatro tipos de teste convivem:**

1. **Unitários de service com mocks.** Ex.: `pessoas/pessoas.service.spec.ts`. O repositório é um objeto falso com
   `jest.fn()`, e o teste confere **que SQL o service montou** e **o que ele tentou gravar**.
2. **HTTP com aplicação Nest real.** Ex.: `autenticacao/autenticacao.http.spec.ts`. Sobe o Nest de verdade numa porta
   aleatória e troca só o repositório:
   ```ts
   Test.createTestingModule({ imports: [ConfigModule.forRoot({...}), AutenticacaoModule] })
     .overrideProvider(getRepositoryToken(Corretor)).useValue(repositorio)
   ```
   Rotas, guards, pipes e regras são reais; só o banco é falso. Isso é a injeção de dependência pagando a conta.
3. **Processo real.** `bootstrap.spec.ts` executa o `main.ts` num subprocesso sem variáveis de ambiente e prova que
   o processo morre **antes** de conectar e **sem** imprimir segredos.
4. **Integração com PostgreSQL real.** `database/modelo-portugues.integracao.spec.ts` roda as migrations com dados
   sintéticos e testa o fluxo HTTP inteiro. Só roda com `TESTE_LOCAL_DATABASE_URL` (Docker) ou banco de homologação.

**Peculiaridade:** o `jest.config.cjs` troca `@nestjs/schedule` por `src/testing/schedule.mock.ts`, para que os `@Cron`
não disparem durante os testes.

**Duplicação perigosa:** a configuração do `ValidationPipe` está escrita no `main.ts` e de novo nos testes HTTP.
Mudar uma sem a outra deixa os testes verdes validando outra coisa.

**O que os testes não provam:** upload real no R2, criação real de pasta no Drive e a cadeia completa de migrations
sobre banco vazio. Essas partes foram verificadas à mão, uma vez.

---

## 12. Operação: comandos, ambiente, migrations

### Comandos

| Ação | Comando | Precisa de `.env` e rede |
|---|---|---|
| Instalar | `npm ci` | não |
| Desenvolver com recarga | `npm run start:dev` | sim |
| Compilar | `npm run build` | não |
| Rodar o compilado | `npm run start:prod` | sim |
| Testes | `npm test` | não |
| Lint | `npm run lint` | não |
| Tipos | `npm run typecheck` | não |
| Ver migrations pendentes | `npm run migration:show` | sim |
| Aplicar migrations | `npm run migration:run` | sim, com `MIGRACAO_BACKUP_ARQUIVO` |
| Criar o primeiro ADMIN | `npm run bootstrap:admin` | sim |

Antes de qualquer commit: `npm run typecheck`, `npm run lint` e `npm test`. Os três.

### Variáveis de ambiente

| Variável | Para quê | Obrigatória |
|---|---|---|
| `DATABASE_URL` | conexão com o Neon | sim |
| `JWT_SECRET` | assinar o token de acesso (mínimo 32 caracteres) | sim |
| `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_URL` | armazenamento de mídia | sim |
| `PORT`, `NODE_ENV`, `JWT_EXPIRES_IN`, `ALLOWED_ORIGINS` | porta, ambiente, duração do token, origens do front | têm padrão |
| `R2_REQUEST_TIMEOUT_MS`, `R2_CONNECTION_TIMEOUT_MS` | timeouts do R2 | têm padrão |
| `GOOGLE_DRIVE_*` (quatro) | integração com o Drive | opcionais, mas as quatro juntas |
| `MIGRACAO_BACKUP_ARQUIVO`, `MIGRACAO_COMPLEMENTOS_ARQUIVO` | executor de migrations | só na linha de comando |
| `BOOTSTRAP_ADMIN_*` | criar o primeiro ADMIN | só uma vez; **apagar depois** |

O `.env` nunca vai para o Git. Nenhum valor de segredo aparece em log, teste ou mensagem.

### Regras operacionais que você não pode esquecer

- Backup antes de qualquer mudança estrutural no banco.
- Nunca editar migration aplicada.
- Nunca publicar a API sozinha: o contrato v2 quebra o front antigo. API e front sobem juntos, e o health check
  do Render aponta para `/api/v1/saude`.
- Nunca rodar `migration:revert` em produção sem backup e autorização.

---

## 13. O que está torto no projeto hoje

Isto é o que um revisor sênior apontaria. Saber disso é parte de ser dono. Todos os itens foram conferidos no código.

1. **Duas pastas com o mesmo papel:** `src/common/` (só o filtro de exceções) e `src/comum/` (todo o resto compartilhado).
2. **Nomes de método misturados:** `listar_publicos` e `encontrar_interno` em `imoveis/`, `criarPublico` e
   `listarContratos` nos outros módulos. Metade `snake_case`, metade `camelCase`.
3. **Resposta de comissão fora do padrão.** Os outros módulos montam a resposta campo a campo. `ComissoesService`
   devolve a entidade inteira (`{ ...comissao }`) e o `criar` devolve a entity direto. Hoje não vaza nada sensível,
   mas qualquer coluna nova sairá na resposta automaticamente.
4. **Dois mecanismos de agendamento.** Sessões usam `setInterval` no `SessoesService`; contratos e comissões usam
   `@Cron`. O `DECISIONS.md` de 12/09 diz para **não** usar `setInterval`, e a tarefa OPS-001 ainda aparece aberta
   embora a limpeza já exista no código.
5. **Dependência instalada e não usada:** `@aws-sdk/lib-storage` está no `package.json` e nenhum arquivo a importa.
6. **Migration órfã:** `1789084805000-hardening.ts` está no disco e fora do registro.
7. **Documentação histórica misturada com a atual:** o `README.md` e o `docs/ENTENDENDO-O-BACKEND.md` foram
   atualizados em 17/09, mas o handoff de 14/09 ainda diz que trocar senha mantém as sessões, e o código atual
   revoga. Documento velho ensina errado; confira a data antes de confiar.
8. **Redefinição de senha pelo ADMIN não revoga sessões** do corretor alvo, ao contrário da troca da própria senha.
9. **Linhas muito longas.** Muitos arquivos têm vários decorators e instruções numa linha só, sem formatador
   automático (Prettier). Funciona, mas é difícil de ler e revisar. Isso é custo real para quem estuda.
10. **Limites de tentativa em memória**, com o risco de trancar o login ao encher o mapa (seção 9).
11. **O Render publicado roda o contrato antigo** e não funciona contra o banco atual.
12. **Teste instável por tempo.** O `bootstrap.spec.ts` tem limite de 15 segundos para subir a aplicação num
    subprocesso e falha em máquinas lentas, como esta pasta sincronizada pelo OneDrive.

---

## 14. Plano de estudo em quatro semanas

Uma hora por dia. Faça os exercícios **numa cópia descartável do repositório** (outra pasta), sem commit na `main`.
Digite o código. Não cole.

### Semana 1 — Base e boot

- Dia 1: seções 3 e 4. Refaça em papel a tabela de códigos HTTP sem olhar.
- Dia 2: leia `main.ts` e `app.module.ts` linha a linha. Explique cada linha em voz alta.
- Dia 3: leia `config/env.validation.ts`. Exercício: remova `JWT_SECRET` do `.env` da cópia e rode
  `npm run start:dev`. Leia o erro. Explique por que ele não mostra valores.
- Dia 4: seção 5 até "Guard". Exercício: crie um `GET /ping` num módulo novo que devolve `{ ok: true }`.
- Dia 5: continue a seção 5. Exercício: proteja o `/ping` com `AutenticacaoGuard` e depois com `@Cargos('ADMIN')`.
  Teste com e sem token.
- Fim de semana: rode `npm test`. Leia um teste HTTP inteiro, `autenticacao.http.spec.ts`.

### Semana 2 — Dados

- Dia 1: seção 6. Leia `imovel.entity.ts` e a parte `CREATE TABLE imoveis` da migration `1789603200000`.
  Liste cada diferença entre a entity e o SQL.
- Dia 2: exercício: adicione um campo `vagas_garagem` ao imóvel na cópia. Faça migration nova, entity, DTO e
  resposta. Veja o 400 quando falta no DTO.
- Dia 3: leia `pessoas.service.ts`. Desenhe no papel a consulta que `visiveis()` monta para um CORRETOR.
- Dia 4: leia `corretores.service.ts`. Explique a condição de corrida do último ADMIN e como o advisory lock resolve.
- Dia 5: leia `parcelamento.ts`. Exercício: calcule à mão R$ 1.000,00 em 3 parcelas e confira com um teste.
- Fim de semana: escreva um teste unitário novo para `distribuirParcelas`.

### Semana 3 — Fluxos

- Um fluxo da seção 8 por dia. Leia o código do fluxo com o depurador do VS Code, pondo *breakpoint* no controller
  e seguindo com F11 até o banco.
- Ao final de cada dia, narre o fluxo em voz alta sem olhar. Grave e escute.

### Semana 4 — Segurança e revisão

- Dia 1 e 2: seção 9. Para cada camada, escreva qual ataque ela bloqueia e o que aconteceria sem ela.
- Dia 3: escolha dois itens da seção 13 e escreva, em texto, como você corrigiria. Não peça ao agente.
- Dia 4: peça a um agente uma mudança pequena e **revise o diff você mesmo** antes de aceitar.
  Liste o que você entendeu e o que não entendeu.
- Dia 5: responda a seção 15 sem consultar. Onde errar, volte à seção.

---

## 15. Perguntas de autoavaliação, com gabarito

1. **Por que um `POST /admin/imoveis` sem token e com corpo inválido responde 401 e não 400?**
   Porque guards rodam antes de pipes. O `AutenticacaoGuard` rejeita antes de o `ValidationPipe` executar.

2. **O que acontece se alguém mandar `"cargo": "ADMIN"` no `PATCH /autenticacao/eu`?**
   400. O `AtualizarPerfilDto` não declara `cargo`, e o `ValidationPipe` usa `forbidNonWhitelisted`.

3. **O JWT carrega o cargo. Por que rebaixar um ADMIN tem efeito imediato?**
   Porque a `EstrategiaJwt` relê o corretor no banco a cada requisição e usa o cargo de lá, não o do token.

4. **Por que o token de renovação é de uso único mesmo com várias instâncias da API?**
   Porque o consumo é um único `DELETE ... RETURNING` no banco. O PostgreSQL garante que só uma requisição recebe a linha.

5. **Por que o hash do token é SHA-256 e o da senha é Argon2id?**
   Senha humana precisa de hash lento contra dicionário. Token aleatório de 384 bits não tem dicionário e precisa de
   hash determinístico para servir de chave de busca.

6. **Por que dinheiro circula como string?**
   `numeric` volta do driver como texto para não perder precisão. `number` é ponto flutuante e erra centavos.
   Cálculos usam centavos em `BigInt`.

7. **Adicionei uma coluna na entity e o sistema quebrou em execução. Por quê?**
   Com `synchronize: false`, a entity não altera o banco. Falta a migration que cria a coluna.

8. **Por que corretor comum recebe 404, e não 403, ao abrir a pessoa de outro corretor?**
   O filtro de visibilidade entra no `WHERE`. O registro não existe para ele, e o sistema não confirma que o id existe.

9. **O que garante que um imóvel não tenha dois contratos ativos?**
   O índice único parcial `unico_contrato_ativo_imovel`, mais a validação e o advisory lock no service.

10. **Por que o contrato fica salvo quando o Google Drive falha?**
    A pasta é criada depois de gravar o contrato. A falha vira `status_pasta_drive = FALHOU` e existe rota de nova tentativa.

11. **Como o upload evita arquivos órfãos no R2 quando o banco falha?**
    Compensação: guarda as chaves enviadas e apaga todas do R2 no `catch`.

12. **O que acontece com um endpoint novo sem `@UseGuards`?**
    Fica público. Não existe guard global.

13. **Como o Nest descobre o que injetar no construtor, se os tipos somem na compilação?**
    `emitDecoratorMetadata` grava os tipos como metadado, e `reflect-metadata` permite lê-los em execução.

14. **Por que apagar um imóvel pelo painel não apaga as fotos do R2?**
    Porque o `DELETE` de imóvel é lógico (`ativo = false`). A linha continua existindo, com as mídias.

15. **Por que a validação do ambiente só imprime nomes de campos?**
    Mensagens de validador podem incluir o valor, e o valor pode ser segredo.

---

## 16. Glossário

- **Advisory lock**: trava do PostgreSQL identificada por um número, liberada ao fim da transação.
- **Argon2id**: algoritmo de hash de senha, lento de propósito, resistente a GPU.
- **Bearer**: esquema do header `Authorization: Bearer <token>`; quem porta o token é autenticado.
- **Bucket**: recipiente de arquivos num armazenamento de objetos como o R2.
- **Compensação**: desfazer manualmente uma operação externa quando a transação do banco falha.
- **CORS**: regra do navegador sobre quais sites podem ler respostas de outro domínio.
- **CSRF**: ataque que usa o navegador da vítima para disparar requisição autenticada.
- **Decorator**: função aplicada com `@` a uma classe, método ou campo, que anota ou altera o alvo.
- **DTO**: classe que descreve e valida o formato de entrada.
- **Entity**: classe que descreve uma tabela para o ORM.
- **Guard**: peça do Nest que decide se a requisição pode seguir.
- **Idempotente**: operação que, repetida, produz o mesmo resultado sem efeito extra.
- **IDOR**: acesso indevido a um registro trocando o identificador na requisição.
- **Injeção de dependência**: o framework cria e entrega as dependências de uma classe.
- **JWT**: token assinado em três partes (cabeçalho, conteúdo, assinatura); legível, mas inviolável.
- **LGPD**: Lei Geral de Proteção de Dados; exige prova de consentimento para dados pessoais do site.
- **Migration**: arquivo com o SQL versionado que altera o schema.
- **Pipe**: peça do Nest que transforma e valida a entrada.
- **Provider**: classe ou valor que o Nest pode injetar.
- **Slug**: identificador legível na URL (`galpao-na-br-163-42`).
- **Soft delete**: exclusão lógica com `ativo = false`.
- **SSR**: renderização da página no servidor, usada pelo front para SEO.
- **Transação**: grupo de operações que acontece inteiro ou não acontece.
- **XSS**: código malicioso executado dentro da página.
