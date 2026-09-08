# Planilhas de exemplo — teste da importação

Arquivos para testar a tela **Importar de outro sistema** (Cadastros → Importar).
Cada um exercita uma parte do fluxo: upload, leitura de colunas, mapeamento de
campos, seletores de formato e a tela de erros.

Os nomes de categoria / forma de pagamento / operadora batem com o seed
(`db/migrations/03_seed.sql`). Se você já editou esses cadastros, ajuste os
arquivos ou escolha um valor "padrão" na tela.

| Arquivo | Tipo | Formato data / valor | O que testar |
|---|---|---|---|
| `gastos-ok.xlsx` | Gastos | (Excel: célula de data e número — seletores são ignorados) | Caminho `.xlsx`. Colunas `Data, Valor, Categoria, Descricao` mapeiam sozinhas. Deve importar 5 linhas. |
| `receitas-ok.xlsx` | Receitas | (Excel) | Cabeçalhos "tortos" (`Dia, Bruto, Pagamento, Maquina, Nota`). Auto-map parcial — você mapeia `Valor bruto → Bruto` e `Maquininha → Maquina` na mão. Débito/Crédito exigem maquininha (vem na coluna). Deve importar 4 linhas. |
| `receitas-ok.csv` | Receitas | DD/MM/AAAA · `1.234,56` | Mesmo caso do xlsx, agora em CSV com separador `;`. Cabeçalhos `Data Venda, Vlr Bruto, Forma, Maquininha, Obs`. |
| `receitas-formato-us.csv` | Receitas | **MM/DD/AAAA** · **`1,234.56`** | Trocar os dois seletores para o formato americano. Se esquecer, as linhas dão erro de data/valor — é o comportamento esperado. |
| `pagamentos-ok.csv` | Pagamentos | DD/MM/AAAA · `1.234,56` | Tipo Pagamentos + snapshot do vínculo. **Edite os nomes** (`FULANO DE TAL`, `BELTRANO DE TAL`) para funcionários que existam no seu cadastro, ou escolha um funcionário "padrão". |
| `gastos-com-erros.csv` | Gastos | DD/MM/AAAA · `1.234,56` | Tela "nada foi importado — corrija o arquivo". 4 linhas com problema: data inexistente (linha 2), valor negativo (3), categoria fora do cadastro (4), valor em branco (5). Nenhum registro entra. |

## Roteiro rápido de teste manual

1. **Upload + leitura** — escolher o tipo, subir `gastos-ok.xlsx`, clicar em
   *Ler colunas*. Conferir a prévia (8 primeiras linhas) e o total.
2. **Definição de campos** — subir `receitas-ok.csv`. Ver o que veio mapeado
   automático e o que ficou em branco. Mapear o resto. O botão *Importar* fica
   travado enquanto faltar campo obrigatório.
3. **Seletores de formato** — subir `receitas-formato-us.csv`, importar sem
   mexer nos seletores (deve dar erro), depois trocar para MM/DD/AAAA e
   `1,234.56` e importar de novo.
4. **Tudo-ou-nada** — subir `gastos-com-erros.csv`. Confirmar que a lista de
   erros aponta a linha certa e que **nada** foi gravado.
5. **CSV do Excel pt-BR** — abrir um `.csv` no Excel, salvar de novo como
   "CSV (separado por vírgulas)" e importar. Acentos nas categorias devem
   continuar certos (o backend cai para latin1 se detectar lixo de encoding).

## `bagunca/` — planilhas mal preenchidas

Testam a tolerância a arquivo "do jeito que o usuário mandar". Todos são **gastos**;
mapear `data / valor / categoria` (nomes de coluna variam por arquivo).

| Arquivo | Bagunça | Resultado esperado |
|---|---|---|
| `b01-cabecalho-afastado.csv` | 3 linhas de título/branco antes do cabeçalho; linha `TOTAL` no fim | detecta cabeçalho na linha 4 sozinho; importa 2, ignora a linha de total |
| `b02-colunas-e-espacos.csv` | coluna vazia entre campos, espaços nos cabeçalhos e valores | ignora a coluna sem nome; importa 3 |
| `b03-valores-sujos.csv` | `R$ 50,00`, `1.500,00 (nota 55)`, `1.200`, `-`, vazio, **`30 reais`** | limpa R$/parênteses; `30 reais`, `aprox.` e vazios viram **erro claro** (não adivinha número dentro de texto) |
| `b04-datas-variadas.csv` | `01/09` (sem ano), `02.09.2026`, `2026/09/03`, serial `45905`, mês por extenso | aceita as 4 primeiras (ano vem do campo "Ano quando faltar"); mês por extenso e `MM/DD` fora do formato viram erro |
| `b05-categorias-variadas.csv` | `insumos`, `INSUMOS`, `Insumo`, `compras de insumos`, `Energia eletrica`, `gás` | casa por acento/caixa/inclusão; as aproximações aparecem em **"Aproximações usadas"** pra você conferir |
| `b06-mistureba.csv` | título + coluna vazia + `SUBTOTAL`/`TOTAL GERAL` + `30 reais` | cabeçalho na linha 3; ignora subtotal e total; `30 reais` = erro |
| `b07-multi-aba.xlsx` | dados na 2ª aba (`setembro`), 1ª aba só instruções | escolher a aba **setembro** no seletor; importa 2, ignora total |
| `b08-tudo-junto.xlsx` | título + coluna vazia + data variada + valor sujo + total | cabeçalho na linha 3; `30 reais` = erro, resto importa |

**Fluxo pra bagunça:** ler colunas → se for xlsx com várias abas, escolher a aba →
ajustar "Cabeçalho na linha" se a prévia vier torta → mapear os campos → **"Validar
antes de importar"** (mostra erros, linhas ignoradas e aproximações sem gravar nada)
→ corrigir o arquivo/opções → **Importar**.

O que **não** é tratado de propósito: número dentro de palavra (`30 reais`), mês por
extenso (`4 de setembro`). Viram erro por linha — corrigir na planilha de origem.

## Regenerar os `.xlsx`

```
cd api && node scripts/gerar-exemplos-importacao.mjs
```
