// Gera as planilhas .xlsx de exemplo em ../exemplos-importacao/.
// Rode de dentro de api/:  node scripts/gerar-exemplos-importacao.mjs
// (precisa do pacote xlsx, que ja e dependencia da api)
import * as XLSX from 'xlsx';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const destino = join(raiz, 'exemplos-importacao');
mkdirSync(destino, { recursive: true });

// abas = [ [nomeAba, linhas], ... ]
function salvarAbas(nome, abas) {
  const wb = XLSX.utils.book_new();
  for (const [aba, linhas] of abas) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(linhas, { cellDates: true }), aba);
  }
  writeFileSync(join(destino, nome), XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellDates: true }));
  console.log('gerado:', nome);
}

function salvar(nome, linhas) {
  salvarAbas(nome, [['Dados', linhas]]);
}

const d = (a, m, dia) => new Date(Date.UTC(a, m, dia));

// Gastos OK — datas como celula de data, valores como numero (caso classico de Excel).
salvar('gastos-ok.xlsx', [
  ['Data', 'Valor', 'Categoria', 'Descricao'],
  [d(2026, 8, 1), 50, 'Insumos', 'hortifruti'],
  [d(2026, 8, 2), 1200, 'Aluguel', ''],
  [d(2026, 8, 3), 89.9, 'Energia', 'conta de luz'],
  [d(2026, 8, 4), 30, 'Gas', ''],
  [d(2026, 8, 5), 15.5, 'Manutencao', 'troca de lampada'],
]);

// Receitas OK — cabecalhos "tortos" pra exercitar o mapeamento manual.
salvar('receitas-ok.xlsx', [
  ['Dia', 'Bruto', 'Pagamento', 'Maquina', 'Nota'],
  [d(2026, 8, 1), 1250, 'Dinheiro', '', 'caixa 1'],
  [d(2026, 8, 1), 340.5, 'PIX', '', ''],
  [d(2026, 8, 2), 89.9, 'Debito', 'Stone', ''],
  [d(2026, 8, 2), 1500, 'Credito a vista', 'Cielo', 'mesa 12'],
]);

// --- BAGUNCA: formatos "do jeito mais burro possivel" ---

// Dados na 2a aba; 1a aba so tem instrucoes.
salvarAbas('bagunca/b07-multi-aba.xlsx', [
  ['Leia-me', [
    ['Planilha de gastos do mes'],
    ['Preencher a partir da aba "setembro"'],
  ]],
  ['setembro', [
    ['Gastos de Setembro', '', '', ''],
    ['', '', '', ''],
    ['Data', 'Valor', 'Categoria', 'Obs'],
    [d(2026, 8, 1), 50, 'insumos', 'feira'],
    [d(2026, 8, 2), 'R$ 120,00', 'gás', 'botijao'],
    ['', '', '', ''],
    ['TOTAL', 170, '', ''],
  ]],
]);

// Tudo junto: titulo, coluna vazia, valores sujos, datas variadas, linha de total.
salvarAbas('bagunca/b08-tudo-junto.xlsx', [
  ['Plan1', [
    ['Controle Financeiro - O Pensador', '', '', '', ''],
    ['', '', '', '', ''],
    ['', 'Dia', 'Gasto (R$)', 'Tipo', 'Anotacao'],
    ['', d(2026, 8, 1), 50, 'insumos', 'hortifruti'],
    ['', '01/09', '30 reais', 'gás', 'botijao'],
    ['', '02.09.2026', 1200, 'Aluguel', 'setembro'],
    ['', d(2026, 8, 3), '1.234,5', 'Energia eletrica', ''],
    ['', '', '', '', ''],
    ['', 'TOTAL', 2514.5, '', ''],
  ]],
]);
