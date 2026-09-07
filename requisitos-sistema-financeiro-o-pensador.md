# Planejamento de Requisitos — Sistema de Controle Financeiro
## Projeto PEX — Restaurante O Pensador

---

## 1. Visão Geral

Aplicação web para controle financeiro de um restaurante (self-service/kilo + churrascaria), permitindo:
- Registro de gastos e receitas diárias
- Rastreamento de recebimentos por operadora de cartão de crédito/débito e das taxas cobradas
- Cálculo de fluxo de caixa (entradas, saídas, taxas, saldo)
- Controle de pagamento de funcionários (fixos, temporários e diaristas)

**Stack:** Node.js (backend) + React (frontend), arquitetura orientada a containers (Docker), rodando inicialmente em servidor local (notebook) e migrando futuramente para VPS Hostinger.

**Restrição importante:** como é PEX, o piloto documentado com usuários reais precisa acontecer num prazo curto (~1 mês). Isso significa que o escopo do MVP precisa ser bem mais enxuto do que "o sistema financeiro completo do restaurante" — vou marcar abaixo o que é essencial pro piloto e o que pode ficar pra depois.

---

## 2. Atores / Personas

| Ator | Necessidade principal |
|---|---|
| Dono/Gestor | Ver fluxo de caixa consolidado, lucro, custo de mão de obra |
| Responsável financeiro/caixa | Lançar receitas do dia, gastos, folha |
| (Opcional) Funcionário | Registrar seu próprio ponto/diária, se aplicável |

**Pergunta em aberto:** quantos perfis de acesso realmente existem no O Pensador? Provavelmente 1-2 pessoas usam o sistema (dono + talvez um caixa/gerente) — isso simplifica muito o módulo de permissões no MVP.

---

## 3. Requisitos Funcionais

### 3.1 Módulo de Receitas (essencial para MVP)
- RF01: Registrar receita diária, com valor total e forma de recebimento (dinheiro, débito, crédito, PIX, vale-refeição etc.)
- RF02: Para recebimentos em cartão, registrar a **operadora** (Stone, Cielo, Rede, GetNet, PagSeguro etc.) e o **valor bruto** recebido
- RF03: Calcular automaticamente a **taxa da operadora** sobre cada transação/lote e o valor líquido
- RF04: Suportar múltiplas formas de pagamento no mesmo dia (ex: parte em dinheiro, parte em cartão, parte em PIX)
- RF04b: Anexar foto do comprovante de recebimento (ex: comprovante da maquininha) — mesmo mecanismo de anexo comprimido da seção 6.4

### 3.2 Módulo de Gastos (essencial para MVP)
- RF05: Registrar gastos por categoria (insumos, aluguel, energia, manutenção, etc.)
- RF06: Registrar gasto com data, valor, categoria e descrição
- RF07: Anexar comprovante/nota fiscal em foto (ver seção 6.4 — anexos comprimidos)

### 3.3 Módulo de Folha de Pagamento (essencial para MVP, mas pode ser simplificado)
- RF08: Cadastrar funcionários com tipo de vínculo: **fixo (mensal/CLT)**, **temporário**, **diarista**
- RF09: Para diaristas: registrar dias trabalhados e valor por diária, calculando total do período
- RF10: Para temporários: registrar período de contrato e valor combinado
- RF11: Para fixos: registrar salário mensal (não precisa cálculo de INSS/FGTS completo — é controle interno, não folha oficial)
- RF12: Consolidar custo total de mão de obra por dia/semana/mês

### 3.4 Módulo de Fluxo de Caixa (essencial para MVP — é o "produto final")
- RF13: Dashboard com: total recebido, total gasto, total pago em taxas, total de folha, saldo do dia/período
- RF14: Filtro por período (dia, semana, mês)
- RF15: Detalhamento por operadora de cartão (quanto cada uma trouxe líquido, quanto cobrou de taxa)
- RF16: Dashboard interativo com gráficos (receita x despesa x lucro, por operadora, por categoria) — **complementar ao módulo de fluxo de caixa, não é o ponto central do MVP**, mas o schema de dados (seção 6) já é desenhado para suportar isso bem desde o início, já que facilita muito construir isso depois sem precisar remodelar tabelas
- RF19: **Fechamento de dia** — ação explícita de "fechar" um dia depois que todos os lançamentos foram feitos, travando edição posterior sem uma reabertura deliberada pelo dono (ver tabela `fechamentos_diarios` na seção 6.1 e fluxo detalhado abaixo). Evita lançamento duplicado ou esquecido, e dá ao dono um ponto de corte confiável pro relatório
- RF20: **Estorno/cancelamento com motivo** — em vez de simplesmente apagar um lançamento errado, registrar um estorno vinculado ao lançamento original com motivo. Mantém rastro completo (importante pro dado financeiro fazer sentido depois, e é basicamente de graça já que você optou por fato imutável no schema)
- RF21: **Exportação de dados** (CSV, no mínimo) por período — o dono provavelmente vai querer levar esses números pro contador em algum momento, e isso é barato de entregar já tendo as views da seção 6.3 prontas

### 3.5 Módulo de Autenticação (essencial, mas simples)
- RF17: Login com usuário e senha
- RF18: (Opcional MVP) Perfis com permissões diferentes — se só 1-2 pessoas usam, pode ser só "autenticado" vs "não autenticado" no piloto

### 3.6 Módulo de Configurações (essencial — evita hardcode de regra de negócio)
- RF23: Tela de configurações, acessível só pelo **Dono**, onde ele cadastra/edita **operadoras de cartão** (nome + taxas de débito/crédito à vista/parcelado) e **formas de pagamento** aceitas (dinheiro, PIX, débito, crédito à vista, crédito parcelado, outros)
- RF24: Essas duas listas alimentam os formulários de lançamento de receita (RF01-RF04) como opções — o dono pode ativar/desativar ou ajustar taxa a qualquer momento sem precisar de alteração de código ou novo deploy
- Isso também resolve, na prática, a pendência da seção 5 item 1: não é mais preciso ter todas as operadoras e taxas do O Pensador fechadas *antes* de começar a construir — dá pra lançar o sistema com uma configuração inicial simples e o próprio dono ajusta depois pelo app

### 3.7 Módulo de Auditoria (baixo esforço, alto valor de confiança)
- RF22: Registrar quem lançou e quem editou cada registro (já existe `usuario_id` no schema — é só expor isso na UI e manter histórico de alterações, não sobrescrever)

### 3.8 Fora do escopo do MVP (mapear, mas não construir agora)
- Emissão de nota fiscal (NF-e/NFC-e) — é módulo fiscal separado, exige certificado digital e integração com SEFAZ
- Integração automática via API com as operadoras de cartão (extrato automático) — no MVP, lançamento é manual
- Controle de estoque
- App mobile nativo (React responsivo resolve o piloto)

---

## 4. Requisitos Não Funcionais

- RNF01: **Dados sensíveis** — informações financeiras e de funcionários (nome, valor pago) são dados sensíveis pela LGPD. Mesmo em ambiente acadêmico, vale ter controle de acesso básico e não deixar a aplicação exposta publicamente sem autenticação.
- RNF02: **Disponibilidade** — rodando num notebook em casa, não existe SLA de uptime. Isso precisa estar claro no relatório do PEX: é ambiente de piloto controlado, não produção crítica.
- RNF03: **Backup** — como o "servidor" é um notebook sem redundância, é essencial ter rotina de backup do banco de dados e dos arquivos, com cópia **fora do notebook** (ver seção 7.7 para o plano completo)
- RNF04: **Portabilidade** — toda a aplicação deve subir via `docker compose up` tanto no notebook quanto na VPS futura, sem mudanças de código (só variáveis de ambiente).
- RNF05: **Usabilidade** — quem vai lançar dados no dia a dia não é necessariamente alguém técnico; a UI de lançamento de receita/gasto precisa ser rápida (poucos cliques, mobile-friendly se o caixa usa celular/tablet).
- RNF06: **Performance** — irrelevante em escala de restaurante único (baixíssimo volume de dados), não é uma preocupação real aqui.
- RNF08: **Segurança de autenticação** — senha com hash (bcrypt/argon2, nunca texto puro), sessão via JWT com expiração, limite de tentativas de login (evita brute-force) — mesmo com só 2 usuários, é dado financeiro real
- RNF09: **Monitoramento básico do servidor** — como o "servidor" é um notebook doméstico sem equipe de infra, vale um healthcheck simples (ex: um cron que testa se a API responde e avisa por e-mail/Telegram se cair) — sem isso, ninguém percebe uma queda até o dono tentar usar e não conseguir
- RNF07: **Mobile-first sem prejudicar desktop** — a aplicação precisa funcionar bem tanto no celular (lançamento rápido de gasto/receita, tirar foto do comprovante na hora) quanto no computador (dono analisando o dashboard com mais calma). Ver seção 7.5 para a estratégia.

### 7.5 Estratégia Mobile-first (sem prejudicar desktop)

"Mobile-first" aqui não significa "só pensar no celular" — significa **desenhar primeiro pra tela pequena e progressivamente enriquecer pra tela grande**, em vez do caminho inverso (que é o que normalmente quebra a experiência mobile: encolher um layout de desktop cheio de coisa).

**Diferença de uso por dispositivo (isso já é uma pista de design):**
- **Celular** → uso operacional, rápido: lançar receita do dia, lançar gasto, tirar foto do comprovante na hora. Precisa ser 2-3 toques, não uma tela cheia de campos.
- **Desktop** → uso analítico, sentado: olhar o dashboard, comparar períodos, ver gráficos com mais espaço.

**Decisões técnicas:**
- CSS com abordagem mobile-first de verdade (ex: Tailwind, que já é `mobile-first` por padrão — estilo base é o mobile, e você adiciona `md:` / `lg:` pra enriquecer em telas maiores, nunca o contrário)
- Formulários de lançamento (receita/gasto/pagamento) otimizados pro toque: campos grandes, teclado numérico automático em campo de valor (`inputmode="decimal"`), botão de "tirar foto" acessível direto do formulário
- Navegação: no mobile, barra inferior fixa com os 3-4 atalhos mais usados (lançar receita, lançar gasto, dashboard); no desktop, isso vira uma sidebar lateral com mais opções visíveis de uma vez — mesma informação, disposição diferente pro espaço disponível
- Gráficos do dashboard: usar uma lib responsiva (ex: Recharts, que você já tem disponível no ecossistema React) que se **realoca** — no mobile empilha os gráficos em coluna única e simplifica (menos eixos/legendas visíveis), no desktop aproveita a largura pra mostrar comparações lado a lado
- Testar sempre a partir do mobile: se o formulário de lançamento funciona bem apertado na tela pequena, ele só melhora ao ganhar espaço — o caminho contrário (desenhar rico pro desktop e depois tentar encaixar no celular) é o que gera a experiência ruim que você quer evitar

---

## 5. Regras de Negócio a Definir com o Restaurante

Essas ainda são regras específicas do O Pensador — mas com o Módulo de Configurações (seção 3.6), a maioria delas **não bloqueia mais o início da construção**: dá pra lançar com uma configuração inicial simples e o dono ajusta depois pelo próprio app, sem depender de você:

1. ~~Quais operadoras de cartão eles usam hoje, e qual a taxa de cada uma~~ — agora é o próprio dono quem cadastra isso na tela de Configurações (RF23), a qualquer momento
2. As taxas são descontadas na hora (recebimento líquido já vem descontado) ou entram e depois é feito o acerto? — isso ainda é regra de cálculo que precisa ser confirmada, não é só cadastro
3. Existe prazo de repasse (D+1, D+30) que precisa aparecer no fluxo de caixa, ou o sistema só precisa do valor bruto/líquido, sem se importar com quando o dinheiro efetivamente cai na conta?
4. Como funciona o pagamento dos diaristas — é por dia fixo, por turno, tem variação por função (cozinha, salão)?
5. Categorias de gastos: quais fazem sentido pro negócio deles (insumos, gás, aluguel, manutenção de equipamento, etc.) — pode virar cadastro editável também (`categorias_gasto` já é tabela própria), mas vale ter uma lista inicial pra não começar vazio

---

## 6. Modelo de Dados

Pensado com cuidado extra pro dashboard: em vez de campos de texto livre (categoria, forma de pagamento como string solta), as dimensões viram **tabelas próprias**, e os fatos (receita, gasto, pagamento) ficam com **granularidade de transação** — não pré-agregados. Isso é o que te dá liberdade de fatiar por qualquer eixo depois (dia, operadora, categoria, tipo de vínculo) sem remodelar nada, no mesmo espírito de como você já pensa em BigQuery/Looker Studio no trabalho.

### 6.1 Tabelas de dimensão (cadastros — mudam pouco)

```sql
usuarios (
  id, nome, email, senha_hash, perfil ENUM('dono','caixa'), ativo, criado_em
)

operadoras_cartao (
  id, nome, taxa_debito NUMERIC(5,2), taxa_credito_vista NUMERIC(5,2),
  taxa_credito_parcelado NUMERIC(5,2), ativo
  -- editável pelo Dono na tela de Configurações (RF23) — cadastro inicial simples,
  -- ajustado depois pelo próprio dono sem precisar de deploy
)

categorias_gasto (
  id, nome, ativo
  -- ex: Insumos, Aluguel, Energia, Manutenção, Gás, Outros
)

formas_pagamento (
  id, nome, requer_operadora BOOLEAN, ativo
  -- ex: Dinheiro (requer_operadora=false), PIX (false), Débito (true), Crédito à vista (true), Crédito parcelado (true)
  -- editável pelo Dono na tela de Configurações (RF23) — não é mais ENUM fixo no código
)

funcionarios (
  id, nome, tipo_vinculo ENUM('fixo','temporario','diarista'),
  valor_referencia NUMERIC(10,2), ativo, criado_em
)

fechamentos_diarios (
  data DATE PRIMARY KEY,
  fechado_por FK -> usuarios, fechado_em TIMESTAMP,
  reaberto_por FK -> usuarios NULL, reaberto_em TIMESTAMP NULL
  -- existência de registro sem reaberto_em = dia travado pra novos lançamentos/edições.
  -- reabrir não apaga a linha, só preenche reaberto_por/reaberto_em (mantém rastro de quem reabriu e quando)
)
```

### 6.2 Tabelas de fato (transações — crescem todo dia, é o que alimenta os gráficos)

```sql
receitas (
  id, data DATE, valor_bruto NUMERIC(10,2),
  forma_pagamento_id FK -> formas_pagamento,
  operadora_id FK -> operadoras_cartao (nullable, só quando forma_pagamento.requer_operadora=true),
  valor_taxa NUMERIC(10,2),      -- calculado no lançamento, guardado (não recalcular depois)
  valor_liquido NUMERIC(10,2),   -- valor_bruto - valor_taxa
  comprovante_path TEXT NULL,    -- caminho relativo do arquivo comprimido, ver 6.4
  usuario_id FK -> usuarios,
  observacao TEXT, criado_em TIMESTAMP
)

gastos (
  id, data DATE, valor NUMERIC(10,2),
  categoria_id FK -> categorias_gasto,
  descricao TEXT,
  comprovante_path TEXT NULL,    -- caminho relativo do arquivo comprimido, ver 6.4
  usuario_id FK -> usuarios, criado_em TIMESTAMP
)

pagamentos_funcionarios (
  id, funcionario_id FK -> funcionarios, data DATE,
  valor NUMERIC(10,2), periodo_referencia TEXT,  -- ex: "diária 15/09" ou "mês 09/2026"
  tipo_vinculo_snapshot ENUM('fixo','temporario','diarista'),
  -- snapshot do tipo no momento do pagamento: se o funcionário mudar de vínculo depois,
  -- o histórico não se reescreve sozinho
  usuario_id FK -> usuarios, criado_em TIMESTAMP
)
```

**Por que guardar `valor_taxa` e `valor_liquido` calculados** (em vez de só a taxa da operadora e recalcular na query): a taxa da operadora pode mudar com o tempo (renegociação), e você não quer que uma alteração futura reescreva o valor histórico de uma receita já lançada. Isso é o princípio de "fato imutável" — comum em modelagem analítica.

### 6.3 Views para o dashboard (a parte que importa pra você como analista)

Em vez do frontend fazer agregação na mão, o banco já entrega pronto:

```sql
-- Fluxo de caixa diário
CREATE VIEW vw_fluxo_diario AS
SELECT
  COALESCE(r.data, g.data, p.data) AS data,
  COALESCE(SUM(r.valor_liquido), 0) AS total_receita_liquida,
  COALESCE(SUM(g.valor), 0)          AS total_gasto,
  COALESCE(SUM(p.valor), 0)          AS total_folha,
  COALESCE(SUM(r.valor_taxa), 0)     AS total_taxas
FROM receitas r
FULL OUTER JOIN gastos g ON g.data = r.data
FULL OUTER JOIN pagamentos_funcionarios p ON p.data = r.data
GROUP BY 1;

-- Receita por operadora
CREATE VIEW vw_receita_por_operadora AS
SELECT o.nome AS operadora, r.data,
       SUM(r.valor_bruto) AS bruto, SUM(r.valor_taxa) AS taxa, SUM(r.valor_liquido) AS liquido
FROM receitas r JOIN operadoras_cartao o ON o.id = r.operadora_id
GROUP BY o.nome, r.data;

-- Gasto por categoria
CREATE VIEW vw_gasto_por_categoria AS
SELECT c.nome AS categoria, g.data, SUM(g.valor) AS total
FROM gastos g JOIN categorias_gasto c ON c.id = g.categoria_id
GROUP BY c.nome, g.data;

-- Custo de mão de obra por tipo de vínculo
CREATE VIEW vw_folha_por_vinculo AS
SELECT tipo_vinculo_snapshot AS tipo_vinculo, data, SUM(valor) AS total
FROM pagamentos_funcionarios
GROUP BY tipo_vinculo_snapshot, data;
```

O frontend (React) então só consome essas views prontas — o componente de gráfico não precisa saber somar nada, só plotar. Isso também deixa a porta aberta pra, no futuro, apontar essas mesmas views num Looker Studio ou Metabase, se você quiser um BI mais robusto sem reescrever a base.

### 6.4 Anexos de comprovante (fotos) — lastro de gastos e receitas

Objetivo: permitir foto do comprovante (nota, cupom, comprovante de maquininha) em `gastos` e `receitas`, ocupando o mínimo de espaço possível — importante porque o "servidor" no piloto é um notebook com disco limitado, e cada dia gera várias fotos.

**Onde comprimir: no cliente (React), antes do upload.** Não faz sentido subir a foto de 4-8 MB que sai direto da câmera do celular pra depois comprimir no servidor — isso desperdiça banda e I/O à toa. A ideia:

1. Usuário tira a foto ou seleciona da galeria (`<input type="file" accept="image/*" capture="environment">`)
2. No navegador, antes de enviar: redimensionar (largura máx. ~1600px — nota fiscal não precisa de mais resolução que isso pra ficar legível) e converter pra **WebP** com qualidade ~70-75%. Biblioteca sugerida: `browser-image-compression` (bem simples de usar, roda direto no client)
3. Resultado típico: foto de comprovante que sairia com 3-5 MB fica em torno de **80-200 KB** em WebP — mais de 90% de redução, sem perder legibilidade do texto
4. Upload do arquivo já comprimido pro backend (multipart/form-data)

**No backend:** só recebe e salva — não precisa reprocessar a imagem. Armazenamento:
- **Não guardar a imagem como BLOB no banco** — isso infla o banco, deixa backup lento e dump pesado. Guardar em disco, com o caminho salvo em `comprovante_path`
- Organização de pastas: `/uploads/{gastos|receitas}/{ano}/{mes}/{uuid}.webp`
- No `docker-compose`, isso é um **volume nomeado** separado do volume do banco (ex: `uploads_data:/app/uploads`) — assim ele sobrevive a rebuilds do container e pode ser incluído na rotina de backup (seção RNF03) separadamente do dump do Postgres

**Limite de segurança:** validar no backend tipo de arquivo (só imagem) e tamanho máximo (ex: 2 MB pós-compressão, como trava de segurança caso alguém desative o JS de compressão do client) — nunca confiar só na compressão do frontend.

---

## 7. Arquitetura Técnica (Containerizada)

### 7.1 Containers propostos
- `api` — Node.js/Express (ou Fastify) — backend REST
- `web` — React (build servido via Nginx dentro do próprio container, ou servido pelo Node em dev)
- `db` — Postgres (ou MySQL) em container, com **volume nomeado** para persistência
- `reverse-proxy` — Nginx (você já usa isso no seu home server) fazendo proxy pra api e web

### 7.2 docker-compose
Um único `docker-compose.yml` (ou com override para dev/prod) definindo os 4 serviços acima, rede interna própria, e variáveis de ambiente via `.env` (não versionado). Isso garante que subir na VPS depois seja literalmente `git pull && docker compose up -d`.

### 7.3 Diferença notebook → VPS
- **Agora (notebook):** acesso só na rede local, sem necessidade de domínio/SSL — dá pra usar Cloudflare Tunnel (você já tem essa arquitetura montada no seu home server) se precisar acesso remoto durante o piloto, sem abrir porta no roteador.
- **Depois (VPS Hostinger):** domínio próprio, SSL via Let's Encrypt (Certbot ou Nginx Proxy Manager), firewall (ufw), backups automatizados pra fora do servidor.

### 7.4 Banco de dados: containerizar ou não?
Ponto de decisão: rodar o Postgres/MySQL em container facilita portabilidade, mas em notebook doméstico (sem redundância de disco) o risco de perda de dado é maior. Recomendo: container + volume Docker + **script de backup automatizado** (dump diário salvo fora do container, idealmente sincronizado pra outro lugar — nem que seja um Google Drive/rclone).

### 7.5 Checklist de migração notebook → VPS

O `docker-compose` portável resolve a parte de **código e configuração**, mas migração de ambiente tem mais 2 partes que ainda não estavam documentadas:

1. **Dados**: `pg_dump` no notebook → transferir o arquivo → `pg_restore` na VPS. Simples, mas precisa entrar como passo formal no dia da migração (não é automático só por ter Docker)
2. **Fotos de comprovante**: o volume `uploads_data` (seção 6.4) precisa ser copiado à parte (ex: `rsync` ou `scp` da pasta toda) — é fácil esquecer isso, porque ele não está no dump do banco, só o caminho do arquivo está
3. **Domínio + SSL**: só entra em jogo na VPS (Let's Encrypt/Certbot) — não precisa se preocupar com isso agora, mas é passo a mais na migração, não é automático

### 7.6 Riscos específicos de rodar num notebook doméstico durante o piloto

- **Ponto único de falha física**: notebook não tem redundância de energia nem de internet. Se cair luz ou a internet de casa cair, o sistema fica indisponível pro restaurante inteiro durante o piloto. Vale ter isso documentado no relatório do PEX como limitação conhecida do ambiente (não é falha do projeto, é característica do ambiente escolhido)
- **Notebook ligado 24/7**: rodar sem desligar por semanas tem desgaste (superaquecimento, ciclo de bateria se ele ficar sempre na tomada). Não é bloqueante, só vale considerar deixar em local ventilado

### 7.7 Estratégia de backup contínuo e contingência de migração

O backup aqui cumpre dois papéis diferentes: **proteção do dia a dia** (notebook pode falhar a qualquer momento) e **rede de segurança específica da migração** (não perder nada no dia da troca pra VPS).

**Rotina diária (vale desde a semana 1 do piloto, não só perto da migração):**
1. Cron job diário (ex: 3h da manhã) rodando: `pg_dump` do banco + compactar a pasta `uploads_data` num `.tar.gz` — ambos com timestamp no nome
2. Cópia **para fora do notebook** — como é pouquíssimo volume de dado (é um restaurante só), um `rclone` sincronizando pra um Google Drive/Dropbox já resolve, sem precisar de infraestrutura cara
3. Retenção: manter os últimos 14-30 dias, apagando os mais antigos automaticamente — evita backup infinito consumindo espaço

**Cuidado extra no dia da migração (além da rotina diária):**
1. Antes de começar a migração, tirar um **snapshot manual isolado** (fora da rotação automática) — esse é o "ponto de restauração garantido" caso algo dê errado no meio do processo
2. Depois de restaurar na VPS, **não apagar os dados do notebook imediatamente**. Manter o notebook intacto (mas com lançamentos novos pausados, pra não gerar dado divergente) por um período de validação — ex: 3-7 dias rodando só na VPS, comparando se os números batem, antes de considerar o notebook descartável
3. **Testar a restauração, não só o backup**: um backup nunca testado não é garantia de nada — antes do dia real da migração, vale fazer um ensaio de restaurar o dump numa VPS de teste (ou até localmente) pra confirmar que o processo funciona, em vez de descobrir um problema só na hora que importa

---

## 8. Decisões já fechadas

- **Escopo do MVP/piloto:** Receitas + Gastos + Taxas de operadora + Folha de Pagamento (fixos/temporários/diaristas) + Fluxo de Caixa consolidado. A folha entra desde já porque é, na prática, uma categoria de despesa — não faz sentido ter fluxo de caixa sem ela.
- **Usuários do sistema:** 2 perfis reais — **Dono** e **Caixa/Gerência**. Isso já define que o RF17/RF18 (autenticação com perfis) deixa de ser opcional e vira essencial no MVP.

### 8.1 Perfis de acesso (revisão do RF18)
Com 2 usuários reais, um modelo simples de 2 papéis resolve:

| Permissão | Dono | Caixa/Gerência |
|---|---|---|
| Lançar receita/gasto do dia | ✅ | ✅ |
| Lançar pagamento de funcionário | ✅ | ✅ (a definir com o restaurante) |
| Ver dashboard de fluxo de caixa | ✅ | ✅ |
| Cadastrar/editar operadoras e taxas (RF23) | ✅ | ❌ |
| Cadastrar/editar formas de pagamento (RF23) | ✅ | ❌ |
| Cadastrar funcionários e valores de referência | ✅ | ❌ |
| Editar/excluir lançamentos já feitos | ✅ | ❌ (só o dono corrige erros) |

**Pergunta a confirmar com o restaurante:** a pessoa do caixa/gerência deve ver o valor da folha de pagamento (dados sensíveis de quanto cada funcionário recebe), ou só lançar sem ver o consolidado? Isso muda se o dashboard de folha é visível pros dois perfis ou só pro dono.

## 9. Plano de Sprints — Piloto de 1 mês

| Semana | Foco | Entregável |
|---|---|---|
| 1 | Infra + Auth | `docker-compose` rodando no notebook (api + web + db + proxy); login com 2 perfis; CRUD de Usuário, OperadoraCartao, Funcionario |
| 2 | Receitas e Gastos | Telas de lançamento de receita (com operadora + cálculo de taxa) e gasto (por categoria); listagem e edição |
| 3 | Folha de Pagamento | Cadastro de funcionários por tipo de vínculo; lançamento de pagamento (diária/temporário/fixo); consolidado de custo de mão de obra |
| 4 | Fluxo de Caixa + Piloto com usuário real | Dashboard consolidado (receita, gasto, taxas, folha, saldo); filtro por período; sessão de uso real com o dono/caixa no O Pensador + coleta de feedback |

Isso deixa a última semana livre pra ajustes com base no uso real — importante pro relatório do PEX, que exige evidência de pilotagem com o parceiro, não só o código pronto.

## 10. Perguntas ainda em aberto

1. **Visibilidade da folha pro perfil de Caixa/Gerência** (ver tabela acima).
2. **Acesso durante o piloto:** só na rede local do restaurante, ou precisa ser acessível remotamente (ex: dono olhando o fluxo de caixa de casa)? Decide se você já usa Cloudflare Tunnel no piloto.
3. **Dados históricos:** migrar dados de controle anterior (planilha?) ou começar zerado na data de início do piloto?
4. **Regras de cálculo com o restaurante** (seção 5 acima): as taxas em si viraram configuração (RF23), mas o *momento* do desconto (na hora vs. acerto posterior) e o prazo de repasse ainda precisam ser confirmados antes da Semana 2 — isso é lógica de cálculo, não cadastro.
5. **Nível de detalhe da documentação PEX:** quais artefatos formais o guia oficial exige (ata de reunião, termo de autorização, relatório assinado)? Não é técnico, mas define o formato final deste documento.
6. **Antecipação de recebíveis:** o O Pensador usa antecipação (receber antes do prazo normal, pagando taxa extra pra isso)? Se sim, isso é uma modalidade a mais em `forma_pagamento`/taxa, não coberta ainda no RF02-03.
7. **Consentimento LGPD com funcionários:** como os dados de pagamento de cada funcionário (nome + valor recebido) vão ficar registrados no sistema, vale ter um termo simples avisando que esses dados são armazenados — mesmo sendo uso interno/piloto acadêmico, é dado pessoal de terceiros que não deram consentimento diretamente pra você, e sim pro restaurante como empregador.
8. **A migração pra VPS entra no escopo do PEX ou fica documentada como próximo passo?** O guia do PEX normalmente exige evidência de pilotagem, não necessariamente produção estável — se o piloto de 1 mês roda inteiro no notebook, dá pra deixar a migração pra VPS (seção 7.5) como "roadmap pós-piloto" no relatório, em vez de precisar executar de verdade dentro do prazo apertado. Vale confirmar isso antes de decidir se compra a VPS já ou só depois de aprovado.
