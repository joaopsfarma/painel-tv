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

export interface TVAbcItem {
  seq: number;
  cod: string;
  produto: string;
  unidade: string;
  custoUnit: number;
  qtdConsumo: number;
  vlCustoPeriodo: number;
  custoAcumulado: number;
  classe: 'A' | 'B' | 'C';
  percAcum: number;
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
  estoqueAtual: number;
  estoqueNum: string; // Código do estoque (332, 336, 501...)
}

export interface AbastecimentoTVData {
  savedAt: string;
  kpis: TVKpis;
  items: TVItem[];
  suppliers: TVSupplier[];
  abcSummary?: ABCSummary;
  abcItems?: TVAbcItem[];
  // Campos Novos
  consumos: TVConsumoItem[];
  validades: TVValidadeItem[];
  kpisValidade?: {
    itensVencendo30d: number;
    itensVencendo90d: number;
    totalLotes: number;
    totalProdutosEstoque: number;
  };
  kpisConsumo?: {
    custoTotal: number;
    totalItens: number;
    totalPecasConsumidas: number;
    custoMedioPorItem: number;
    ticketMedio: number;
    top1Produto: string;
    top1Valor: number;
  };
}

// Utilitários de Parse
const parseBrNumber = (s: string) => parseFloat((s || '0').trim().replace(/\./g, '').replace(',', '.')) || 0;

export async function processCSVToTVData(): Promise<AbastecimentoTVData> {
  // Dispara os fetches em paralelo
  const [resultCsv, consumoCsv, validadeCsv, abcCsv] = await Promise.all([
    fetch('./data/result%20(17).csv').then(res => res.text()).catch(() => ''),
    fetch('./data/consumo%20insingt.csv').then(res => res.text()).catch(() => ''),
    fetch('./data/conf%20insgith.csv').then(res => res.text()).catch(() => ''),
    fetch('./data/R_C_ABC_CONSUMO_CONSO%20(3).csv').then(res => res.text()).catch(() => '')
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


  const consumosOrdenados = consumos.sort((a, b) => b.vlCustoPeriodo - a.vlCustoPeriodo);
  
  // ── Cálculo Matemático da Curva ABC ──
  const custoTotalEmpresa = consumosOrdenados.reduce((acc, curr) => acc + curr.vlCustoPeriodo, 0);
  let somaCumulativa = 0;
  
  let classeA = { count: 0, val: 0 };
  let classeB = { count: 0, val: 0 };
  let classeC = { count: 0, val: 0 };

  consumosOrdenados.forEach(c => {
    somaCumulativa += c.vlCustoPeriodo;
    const porcentagemAcumulada = somaCumulativa / custoTotalEmpresa;
    
    if (porcentagemAcumulada <= 0.70) {
      classeA.count++;
      classeA.val += c.vlCustoPeriodo;
    } else if (porcentagemAcumulada <= 0.90) {
      classeB.count++;
      classeB.val += c.vlCustoPeriodo;
    } else {
      classeC.count++;
      classeC.val += c.vlCustoPeriodo;
    }
  });

  const abcSummary: ABCSummary = {
    A: classeA.count,
    B: classeB.count,
    C: classeC.count,
    valA: classeA.val,
    valB: classeB.val,
    valC: classeC.val
  };

  // 3️⃣ PARSE: CONFIG INSGITH (VALIDADE)
  // Estrutura das colunas RAW do CSV (separ. vírgula):
  // cols[0]=vazio | cols[1]=CodProd | cols[2]=NomeProd | cols[3]=vazio | cols[4]=Unidade
  // cols[5]=vazio | cols[6]=EstoqueAtual | cols[7]=vazio | cols[8]=Lote
  // cols[9]=vazio | cols[10]=Validade(DD/MM/YYYY) | cols[11]=vazio | cols[12]=Est.(num estoque: 332,501...)
  // cols[13]=vazio | cols[14]=QtKit | cols[15..17]=vazio | cols[18]=Quantidade
  const valParsed = Papa.parse<{ [key: string]: string }>(validadeCsv, { header: false, delimiter: ',', skipEmptyLines: true }).data;

  const validades: TVValidadeItem[] = [];
  let currentProduct = "Desconhecido";
  let currentEstoque = 0;
  const hoje = new Date();
  hoje.setHours(0,0,0,0);

  let itensVencendo30d = 0;
  let itensVencendo90d = 0;

  valParsed.forEach((row: any) => {
    const cols = Object.values(row) as string[];
    if (cols.length < 11) return;
    
    const raw = cols.map(c => (c || '').trim());
    
    // Detecta linha de produto (contém código numérico no índice 1 e nome no índice 2)
    if (raw[1] && /^\d+$/.test(raw[1]) && raw[2] && raw[2].length > 3) {
      currentProduct = raw[2];
      // Captura Estoque Atual (coluna 6)
      if (raw[6]) {
        currentEstoque = parseBrNumber(raw[6]);
      }
    }

    // Detecta linha com validade (coluna 10 = DD/MM/YYYY)
    const dataStr = raw[10];
    if (dataStr && /^\d{2}\/\d{2}\/\d{4}$/.test(dataStr)) {
      const [dd, mm, yyyy] = dataStr.split('/');
      const dateObj = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
      const diffTime = dateObj.getTime() - hoje.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Lote (coluna 8)
      const lote = raw[8] || 'S/L';
      // Número do estoque/almoxarifado (coluna 12) - ex: 332, 336, 501
      const estoqueNum = raw[12] || '';
      // Quantidade no lote (coluna 18)
      const quantidade = raw[18] ? parseBrNumber(raw[18]) : 0;

      validades.push({
        produto: currentProduct,
        lote,
        validadeStr: dataStr,
        validadeData: dateObj,
        diasParaVencer: diffDays,
        quantidade,
        estoqueAtual: currentEstoque,
        estoqueNum
      });

      if (diffDays >= 0) {
        if (diffDays <= 30) itensVencendo30d++;
        if (diffDays <= 90) itensVencendo90d++;
      }
    }
  });

  // KPIs de consumo
  const totalPecasConsumidas = consumosOrdenados.reduce((s, c) => s + c.qtdConsumo, 0);
  const kpisConsumo = consumosOrdenados.length > 0 ? {
    custoTotal: custoTotalEmpresa,
    totalItens: consumosOrdenados.length,
    totalPecasConsumidas,
    custoMedioPorItem: custoTotalEmpresa / consumosOrdenados.length,
    ticketMedio: totalPecasConsumidas > 0 ? custoTotalEmpresa / totalPecasConsumidas : 0,
    top1Produto: consumosOrdenados[0]?.produto || '',
    top1Valor: consumosOrdenados[0]?.vlCustoPeriodo || 0,
  } : undefined;

  // Contar produtos distintos no estoque (validade)
  const produtosDistintos = new Set(validades.map(v => v.produto)).size;

  // 4️⃣ PARSE: R_C_ABC_CONSUMO_CONSO (3) — Curva ABC oficial
  const abcItems: TVAbcItem[] = [];
  let abcSummaryOfficial: ABCSummary | undefined;

  if (abcCsv && abcCsv.length > 100) {
    const abcParsed = Papa.parse<{ [key: string]: string }>(abcCsv, { header: false, delimiter: ',', skipEmptyLines: true }).data;
    
    let lastProduto = '';

    abcParsed.forEach((row: any) => {
      const cols = Object.values(row) as string[];
      const raw = cols.map(c => (c || '').trim());
      
      // Detecta linha de produto: raw[1] é o Seq (número), raw[3] é o Código, raw[4] é o Nome
      const seq = parseInt(raw[1]);
      if (!isNaN(seq) && seq > 0 && raw[4] && raw[4].length > 3) {
        const cod = raw[3] || '';
        let produto = raw[4] || '';
        const unidade = raw[6] || '';
        const custoUnit = parseBrNumber(raw[8]);
        const qtdConsumo = parseBrNumber(raw[9]);
        const vlCustoPeriodo = parseBrNumber(raw[10]);
        const classeRaw = (raw[12] || '').trim();
        const classe = classeRaw === 'A' ? 'A' : classeRaw === 'B' ? 'B' : 'C';
        const custoAcumulado = parseBrNumber(raw[14]);
        const percAcum = parseBrNumber(raw[16]);

        lastProduto = produto;

        if (vlCustoPeriodo > 0) {
          abcItems.push({
            seq, cod, produto, unidade, custoUnit, qtdConsumo,
            vlCustoPeriodo, custoAcumulado, classe, percAcum
          });
        }
      }
      
      // Detecta o resumo oficial do sistema
      if (raw[0] === 'Resumo das Classificações:' || raw.join(',').includes('Resumo das Classifica')) {
        // As próximas linhas têm os totais
      }
      if (raw[1] && raw[1].includes('N. de Valores(A)') && raw[5]) {
        const countA = parseInt(raw[5]) || 0;
        // Vamos construir o summary após ter percorrido tudo
      }
    });

    // Calcula summary direto dos itens
    if (abcItems.length > 0) {
      const itemsA = abcItems.filter(i => i.classe === 'A');
      const itemsB = abcItems.filter(i => i.classe === 'B');
      const itemsC = abcItems.filter(i => i.classe === 'C');

      abcSummaryOfficial = {
        A: itemsA.length,
        B: itemsB.length,
        C: itemsC.length,
        valA: itemsA.reduce((s, i) => s + i.vlCustoPeriodo, 0),
        valB: itemsB.reduce((s, i) => s + i.vlCustoPeriodo, 0),
        valC: itemsC.reduce((s, i) => s + i.vlCustoPeriodo, 0),
      };
    }
  }

  // Usa o ABC oficial se disponível, senão cai no calculado
  const finalAbcSummary = abcSummaryOfficial || abcSummary;

  return {
    savedAt: new Date().toISOString(),
    kpis,
    items,
    suppliers,
    abcSummary: finalAbcSummary,
    abcItems: abcItems.length > 0 ? abcItems : undefined,
    consumos: consumosOrdenados,
    validades: validades.sort((a, b) => a.diasParaVencer - b.diasParaVencer),
    kpisValidade: { itensVencendo30d, itensVencendo90d, totalLotes: validades.length, totalProdutosEstoque: produtosDistintos },
    kpisConsumo,
  };
}
