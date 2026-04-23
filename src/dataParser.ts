import Papa from 'papaparse';

// ── Interfaces Existentes ──────────────────────────────────────────────
export interface TVKpis {
  emFalta: number;
  atrasados: number;
  altoCusto: number;
  coberturaCritica: number;
  comDependencia: number;
  coberturaMedia: number;
  taxaRuptura: number;
  taxaConformidade: number;
  total: number;
}

export interface TVItem {
  codItem: string;
  descItem: string;
  fornec: string;
  emFalta: boolean;
  ruptura: boolean;
  diasAtraso: number;
  cobertura: number;
  estoqDisp: number;
  estoqTot: number;
  qtdPend: number;
  atrasado: boolean;
  ocNum: string;
  ocEntrega: string;
  nfNum: string;
  valorTotal: string;
  vlUnit: string;
  altoCusto: boolean;
  importado: boolean;
  dependencia: string;
  curvABC: string;
}

export interface TVSupplier {
  nome: string;
  total: number;
  atrasados: number;
  emFalta: number;
  diasAtrasoMedio: number;
  coberturaMedia: number;
  pontualidade: number;
}

export interface ABCSummary {
  A: number; B: number; C: number;
  valA: number; valB: number; valC: number;
}

// ── Novas Interfaces (Consumo E Validade) ──────────────────────────────
export interface TVConsumoItem {
  cod: string;
  produto: string;
  qtdConsumo: number;
  vlCustoPeriodo: number;
}

export interface TVValidadeItem {
  produto: string;
  lote: string;
  validadeStr: string;
  validadeData: Date;
  diasParaVencer: number;
  quantidade: number;
}

export interface AbastecimentoTVData {
  savedAt: string;
  kpis: TVKpis;
  items: TVItem[];
  suppliers: TVSupplier[];
  abcSummary?: ABCSummary;
  // Campos Novos
  consumos: TVConsumoItem[];
  validades: TVValidadeItem[];
  kpisValidade?: {
    itensVencendo30d: number;
    itensVencendo90d: number;
  };
}

// Utilitários de Parse
const parseBrNumber = (s: string) => parseFloat((s || '0').trim().replace(/\./g, '').replace(',', '.')) || 0;

export async function processCSVToTVData(): Promise<AbastecimentoTVData> {
  // Dispara os fetches em paralelo
  const [resultCsv, consumoCsv, validadeCsv] = await Promise.all([
    fetch('./data/result%20(17).csv').then(res => res.text()).catch(() => ''),
    fetch('./data/consumo%20insingt.csv').then(res => res.text()).catch(() => ''),
    fetch('./data/conf%20insgith.csv').then(res => res.text()).catch(() => '')
  ]);

  // 1️⃣ PARSE: RESULT (Abastecimento Típico)
  const resultParsed = Papa.parse<{ [key: string]: string }>(resultCsv, { header: true, delimiter: ';', skipEmptyLines: true }).data;

  let emFalta = 0, atrasados = 0, altoCusto = 0, coberturaCritica = 0, comDependencia = 0;
  let coverageSum = 0, coverageCount = 0, conformes = 0;

  resultParsed.forEach((item: any) => {
    const isFalta = item['Em Falta'] === 'Sim' || item['Ruptura'] === 'Sim' || item['Status'] === 'Em Falta';
    if (isFalta) emFalta++;

    const diasAtraso = parseInt(item['Dias Atraso'] || '0') || 0;
    if (diasAtraso > 0 || item['Atrasado'] === 'Sim') atrasados++;

    if (item['Item de Alto Custo (R$)'] === 'Sim') altoCusto++;

    let cobertura = item['Cobertura'] ? parseBrNumber(String(item['Cobertura'])) : 999;
    if (cobertura < 7 && cobertura >= 0 && !isFalta) coberturaCritica++;

    if (item['Dependência'] && item['Dependência'] !== 'Sem dependência' && item['Dependência'] !== '#') comDependencia++;

    const isAtrasado = diasAtraso > 0 || item['Atrasado'] === 'Sim';
    if (!isFalta && cobertura < 999) { coverageSum += cobertura; coverageCount++; }
    if (!isFalta && cobertura >= 7 && !isAtrasado) conformes++;
  });

  const coberturaMedia = coverageCount > 0 ? Math.round(coverageSum / coverageCount) : 0;
  const taxaRuptura = resultParsed.length > 0 ? parseFloat(((emFalta / resultParsed.length) * 100).toFixed(1)) : 0;
  const taxaConformidade = resultParsed.length > 0 ? parseFloat(((conformes / resultParsed.length) * 100).toFixed(1)) : 0;

  const kpis: TVKpis = {
    total: resultParsed.length, emFalta, atrasados, altoCusto, coberturaCritica, comDependencia,
    coberturaMedia, taxaRuptura, taxaConformidade
  };

  const fornecedorMap = new Map<string, { total: number; atrasados: number; emFalta: number; diasAtrasoSum: number; coberturaSum: number; coberturaCount: number }>();
  resultParsed.forEach((item: any) => {
    const nome = (item['Fornec'] || 'Não informado').trim();
    if (!fornecedorMap.has(nome)) {
      fornecedorMap.set(nome, { total: 0, atrasados: 0, emFalta: 0, diasAtrasoSum: 0, coberturaSum: 0, coberturaCount: 0 });
    }
    const f = fornecedorMap.get(nome)!;
    f.total++;
    const isFaltaF = item['Em Falta'] === 'Sim' || item['Ruptura'] === 'Sim' || item['Status'] === 'Em Falta';
    if (isFaltaF) f.emFalta++;
    const diasAtrasoF = parseInt(item['Dias Atraso'] || '0') || 0;
    if (diasAtrasoF > 0 || item['Atrasado'] === 'Sim') { f.atrasados++; f.diasAtrasoSum += diasAtrasoF; }
    const cobF = item['Cobertura'] ? parseBrNumber(String(item['Cobertura'])) : 999;
    if (!isFaltaF && cobF < 999) { f.coberturaSum += cobF; f.coberturaCount++; }
  });

  const suppliers: TVSupplier[] = Array.from(fornecedorMap.entries()).map(([nome, s]) => ({
    nome, total: s.total, atrasados: s.atrasados, emFalta: s.emFalta,
    diasAtrasoMedio: s.atrasados > 0 ? Math.round(s.diasAtrasoSum / s.atrasados) : 0,
    coberturaMedia: s.coberturaCount > 0 ? Math.round(s.coberturaSum / s.coberturaCount) : 0,
    pontualidade: s.total > 0 ? parseFloat((((s.total - s.atrasados) / s.total) * 100).toFixed(1)) : 100,
  })).sort((a, b) => (b.emFalta * 3 + b.atrasados) - (a.emFalta * 3 + a.atrasados));

  const items: TVItem[] = resultParsed.map((item: any) => ({
    codItem: item['Cod Item'] || '',
    descItem: item['Desc Item'] || '',
    fornec: item['Fornec'] || '',
    emFalta: item['Em Falta'] === 'Sim' || item['Ruptura'] === 'Sim' || item['Status'] === 'Em Falta',
    ruptura: item['Ruptura'] === 'Sim',
    diasAtraso: parseInt(item['Dias Atraso'] || '0') || 0,
    cobertura: item['Cobertura'] ? parseBrNumber(String(item['Cobertura'])) : 999,
    estoqDisp: parseInt(item['Estoq Disp'] || '0') || 0,
    estoqTot: parseInt(item['Estoq Tot'] || '0') || 0,
    qtdPend: parseInt(item['Qtd Pend'] || '0') || 0,
    atrasado: (parseInt(item['Dias Atraso'] || '0') || 0) > 0 || item['Atrasado'] === 'Sim',
    ocNum: item['OC - Núm'] || '',
    ocEntrega: item['Nova Data Ent'] || item['OC - Entrega'] || '',
    nfNum: item['NF - Núm'] || '',
    valorTotal: item['Valor total (R$)'] || '',
    vlUnit: item['Vl. Unit. (R$)'] || '',
    altoCusto: item['Item de Alto Custo (R$)'] === 'Sim',
    importado: item['Importado'] === 'Sim',
    dependencia: item['Dependência'] || '',
    curvABC: item['Curva ABC'] || '',
  }));


  // 2️⃣ PARSE: CONSUMO INSINGT
  // Estrutura: 3 linhas vazias no começo. Delimitador vírgula.
  const consumoRawLines = consumoCsv.split('\n');
  const consumoLinesClean = consumoRawLines.slice(4).join('\n'); // Ignora cabeçalhos extras
  const consParsed = Papa.parse<{ [key: string]: string }>(consumoLinesClean, { header: false, delimiter: ',', skipEmptyLines: true }).data;
  
  const consumos: TVConsumoItem[] = [];
  
  consParsed.forEach((row: any) => {
    // Indexes: 1=Cod, 3=Produto, 11=Qtd, 13=VlCustoPeriodo (variável conforme vírgulas vazias)
    // Devido a múltiplas vírgulas adjuntas (,,,,) o index pode variar.
    // Vamos buscar dinamicamente com base nas strings ou índices conhecidos do sample.
    const cols = Object.values(row) as string[];
    const norm = cols.map(c => c.trim()).filter(c => c !== '');
    if (norm.length >= 5) {
      const cod = norm[1] || '';
      const prod = norm[2] || '';
      // Procuramos o valor que se parece com custo do período e quantidade.
      // Usually Quantity is followed by total period cost.
      let vlCusto = 0, qtd = 0;
      for (let i = norm.length - 1; i >= 0; i--) {
        if (norm[i].includes('%')) continue;
        if (vlCusto === 0 && (norm[i].includes(',') || norm[i].includes('.')) && /[0-9]/.test(norm[i])) {
          vlCusto = parseBrNumber(norm[i]);
          continue;
        }
        if (vlCusto > 0 && qtd === 0 && /[0-9]/.test(norm[i])) {
          qtd = parseBrNumber(norm[i]);
          break;
        }
      }
      if (vlCusto > 0 && prod) {
        consumos.push({
          cod: cod.replace(/[^0-9]/g, ''),
          produto: prod,
          qtdConsumo: qtd,
          vlCustoPeriodo: vlCusto
        });
      }
    }
  });


  // 3️⃣ PARSE: CONFIG INSGITH (VALIDADE)
  // O formato exato lido no PowerShell:
  // Coluna 1=ProdCod, 2=Vazio, 3=ProdutoNome, 4=Vazio, 5=Unidade... dependendo de como as vírgulas batem.
  const valParsed = Papa.parse<{ [key: string]: string }>(validadeCsv, { header: false, delimiter: ',', skipEmptyLines: true }).data;

  const validades: TVValidadeItem[] = [];
  let currentProduct = "Desconhecido";
  const hoje = new Date();
  hoje.setHours(0,0,0,0);

  let itensVencendo30d = 0;
  let itensVencendo90d = 0;

  valParsed.forEach((row: any) => {
    const cols = Object.values(row) as string[];
    const norm = cols.map(c => c.trim());
    if (norm.length < 5) return;
    
    // Se a primeira coluna de dado (índice 1 no CSV raw) contiver texto não-data, pode ser um novo produto
    const possivelProduto = norm[2] && isNaN(parseBrNumber(norm[2])) ? norm[2] : null;
    if (possivelProduto && possivelProduto.length > 5 && !possivelProduto.includes('/')) {
      currentProduct = possivelProduto;
    }

    // Procura por data válido no formato DD/MM/YYYY
    const dateIdx = norm.findIndex(c => /^\d{2}\/\d{2}\/\d{4}$/.test(c));
    if (dateIdx !== -1) {
      const dataStr = norm[dateIdx];
      const [dd, mm, yyyy] = dataStr.split('/');
      const dateObj = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
      const diffTime = dateObj.getTime() - hoje.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Lote costuma vir antes da data
      const lote = norm[dateIdx - 2] || norm[dateIdx - 1] || 'S/L';
      
      // Quantidade no lote (costuma vir após a data ou no fim)
      let qtd = 0;
      for (let i = dateIdx + 1; i < norm.length; i++) {
        if (norm[i] && /[0-9]/.test(norm[i])) {
           qtd = parseBrNumber(norm[i]);
        }
      }

      const valItem: TVValidadeItem = {
        produto: currentProduct,
        lote: lote, 
        validadeStr: dataStr,
        validadeData: dateObj,
        diasParaVencer: diffDays,
        quantidade: qtd
      };

      validades.push(valItem);

      if (diffDays >= 0) {
        if (diffDays <= 30) itensVencendo30d++;
        if (diffDays <= 90) itensVencendo90d++;
      }
    }
  });

  return {
    savedAt: new Date().toISOString(),
    kpis,
    items,
    suppliers,
    consumos: consumos.sort((a, b) => b.vlCustoPeriodo - a.vlCustoPeriodo),
    validades: validades.sort((a, b) => a.diasParaVencer - b.diasParaVencer),
    kpisValidade: { itensVencendo30d, itensVencendo90d }
  };
}
