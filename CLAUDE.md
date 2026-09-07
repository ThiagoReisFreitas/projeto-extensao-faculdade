# Sistema de Controle Financeiro — O Pensador (PEX)

Aplicação web de controle financeiro para restaurante (self-service/kilo + churrascaria), projeto de extensão universitária (PEX) do curso de ADS.

**Documento de requisitos completo:** `docs/requisitos-sistema-financeiro-o-pensador.md` — sempre consultar antes de decisões de modelagem ou regra de negócio; este arquivo é só o resumo operacional.

## Stack

- Backend: Node.js + Express, Postgres
- Frontend: React (mobile-first, ver seção "Design" abaixo)
- Infra: Docker + docker-compose (todos os serviços containerizados desde o dia 1)
- Deploy: local (notebook, ambiente do piloto) → migração futura para VPS Hostinger

## Escopo do MVP (piloto de ~1 mês)

Receitas, Gastos, Taxas de operadora, Folha de Pagamento (fixos/temporários/diaristas), Fluxo de Caixa. **Não construir:** NF-e, integração automática com operadoras, controle de estoque, app nativo — ver seção 3.8 do documento de requisitos.

## Usuários e permissões

2 perfis: **Dono** (acesso total, único que cadastra operadoras/formas de pagamento/funcionários, reabre dias fechados **e estorna/corrige lançamentos**) e **Caixa/Gerência** (lança receita/gasto/pagamento, sem editar configurações, **sem estornar** — pede ao Dono). Ver tabela de permissões na seção 8.1 do documento de requisitos. Backend: `somenteDono` nas rotas de estorno, edição e reabertura.

## Segurança (não afrouxar)

- **Credenciais só no `.env`** (não versionado). `docker-compose.yml` usa `${VAR:?}` — a API **recusa subir** sem `JWT_SECRET` forte e `ADMIN_SENHA` (≥8, ≠ `trocar123`); ver `assertConfigSeguranca` em `api/src/auth.js`. Gerar com `./ops/gen-env.sh`.
- Validadores compartilhados em `api/src/validacao.js` (data ISO, `comprovante_path`, senha, magic bytes de imagem, guarda anti-lockout do último Dono). Toda entrada de data e todo `comprovante_path` passam por lá.
- Proxy escuta só `127.0.0.1` e sem TLS no piloto — checklist pré-LAN/VPS em `ops/README.md`.
- **Redefinição de senha**: no piloto, quem redefine é o **Dono** em Cadastros › Acesso e
  perfis (editar usuário → nova senha). O Login não tem "Esqueci a senha" — só um aviso
  "peça ao Dono". Se o próprio Dono se tranca pra fora: `sh ops/reset-senha.sh <email>`
  (chama `api/src/reset-cli.js` dentro do container — break-glass, precisa de acesso ao host).
  O fluxo por link existe pronto (`POST /auth/esqueci` + `/auth/redefinir`, token JWT de 1h,
  página `/reset/:token`) e **liga por env**: com `RESEND_API_KEY` no `.env`, `emailAtivo()`
  fica `true`, `GET /auth/config` sinaliza, e o Login mostra "Esqueci a senha" — sem tocar em
  código. Sem a key: botão vira "Não consigo entrar" (peça ao Dono).

## Regras de lançamento

- Data do lançamento não pode ser no futuro (`dataNaoFutura` em `api/src/validacao.js`).
  Lançamento retroativo é permitido enquanto o dia não estiver fechado (`assertDiaAberto`);
  dia fechado exige reabertura do Dono.
- Toda confirmação/aviso é modal interno (`ConfirmModal`/`Modal` em `web/src/components.jsx`) —
  nunca `alert()`/`confirm()`/`prompt()` do navegador.

## Princípios de modelagem (não violar sem justificar)

- **Fato imutável**: `receitas`, `gastos` e `pagamentos_funcionarios` guardam valores já calculados (`valor_taxa`, `valor_liquido`) no momento do lançamento — nunca recalcular retroativamente a partir de configuração atual.
- **Snapshot em vez de referência viva**: `pagamentos_funcionarios.tipo_vinculo_snapshot` guarda o vínculo do funcionário no momento do pagamento, não uma FK que muda se o cadastro mudar depois.
- **Configuração, não hardcode**: operadoras de cartão e formas de pagamento são tabelas editáveis pelo Dono (`operadoras_cartao`, `formas_pagamento`), nunca ENUM fixo no código ou valores fixos na UI.
- **Sem edição silenciosa**: correção de lançamento errado é estorno vinculado ao original (com motivo), não exclusão. Edição/exclusão em dia já fechado (`fechamentos_diarios`) é bloqueada pela API até reabertura explícita do Dono.
- **Views para o dashboard**: agregação (fluxo diário, receita por operadora, gasto por categoria, folha por vínculo) vive em views do Postgres, não em lógica de agregação no frontend.

## Anexos de comprovante (fotos)

Compressão **no client antes do upload** (redimensionar ~1600px, WebP ~70-75%), nunca subir a foto crua da câmera. Backend só recebe, valida tipo/tamanho como trava de segurança, e salva em disco (nunca BLOB no banco) em volume Docker separado do volume do Postgres.

## Design

Mobile-first de verdade: desenhar pro celular primeiro (uso operacional — lançar receita/gasto rápido, tirar foto na hora), depois enriquecer pra desktop (uso analítico — dashboard com mais espaço). CSS mobile-first (ex: Tailwind, breakpoints `md:`/`lg:` só adicionam, nunca reduzem).

## Estado atual do projeto

Fase de planejamento concluída. Próximo passo: Sprint 1 (infra + auth) — ver seção 9 do documento de requisitos para o plano completo de sprints.

## Pendências que ainda dependem do restaurante (não assumir valores)

- Momento do desconto da taxa (na hora vs. acerto posterior) e prazo de repasse
- Regra de pagamento dos diaristas (por dia fixo, por turno, variação por função)
- Uso de antecipação de recebíveis
- Se a migração para VPS entra no escopo do PEX ou fica como roadmap pós-piloto

Ver seção 10 do documento de requisitos para a lista completa.
