import Papa from 'papaparse';

// Based on the original types in PainelTVAbastecimento.tsx
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

export interface AbastecimentoTVData {
  savedAt: string;
  kpis: TVKpis;
  items: TVItem[];
  suppliers: TVSupplier[];
  abcSummary?: ABCSummary;
}

// parser removed

export async function processCSVToTVData(): Promise<AbastecimentoTVData> {
  const resultData = await fetch('./data/result%20(17).csv').then(res => res.text());
  
  // Use papaparse
  const parsed = Papa.parse<{ [key: string]: string }>(resultData, {
    header: true,
    delimiter: ';',
    skipEmptyLines: true,
  });
  
  const data = parsed.data;

  let emFalta = 0;
  let atrasados = 0;
  let altoCusto = 0;
  let coberturaCritica = 0;
  let comDependencia = 0;

  let coverageSum = 0, coverageCount = 0, conformes = 0;

  data.forEach((item: any) => {
    const isFalta = item['Em Falta'] === 'Sim' || item['Ruptura'] === 'Sim' || item['Status'] === 'Em Falta';
    if (isFalta) emFalta++;

    const diasAtraso = parseInt(item['Dias Atraso'] || '0') || 0;
    if (diasAtraso > 0 || item['Atrasado'] === 'Sim') atrasados++;

    if (item['Item de Alto Custo (R$)'] === 'Sim') altoCusto++;

    let cobertura = item['Cobertura'] ? parseFloat(item['Cobertura'].replace(',', '.')) : 999;
    if (cobertura < 7 && cobertura >= 0 && !isFalta) coberturaCritica++;

    if (item['Dependência'] && item['Dependência'] !== 'Sem dependência' && item['Dependência'] !== '#') comDependencia++;

    const isAtrasado = diasAtraso > 0 || item['Atrasado'] === 'Sim';
    if (!isFalta && cobertura < 999) { coverageSum += cobertura; coverageCount++; }
    if (!isFalta && cobertura >= 7 && !isAtrasado) conformes++;
  });

  const coberturaMedia = coverageCount > 0 ? Math.round(coverageSum / coverageCount) : 0;
  const taxaRuptura = data.length > 0 ? parseFloat(((emFalta / data.length) * 100).toFixed(1)) : 0;
  const taxaConformidade = data.length > 0 ? parseFloat(((conformes / data.length) * 100).toFixed(1)) : 0;

  const kpis: TVKpis = {
    total: data.length, emFalta, atrasados, altoCusto, coberturaCritica, comDependencia,
    coberturaMedia, taxaRuptura, taxaConformidade
  };

  const fornecedorMap = new Map<string, { total: number; atrasados: number; emFalta: number; diasAtrasoSum: number; coberturaSum: number; coberturaCount: number }>();
  data.forEach((item: any) => {
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
    const cobF = item['Cobertura'] ? parseFloat(item['Cobertura'].replace(',', '.')) : 999;
    if (!isFaltaF && cobF < 999) { f.coberturaSum += cobF; f.coberturaCount++; }
  });

  const suppliers: TVSupplier[] = Array.from(fornecedorMap.entries()).map(([nome, s]) => ({
    nome,
    total: s.total,
    atrasados: s.atrasados,
    emFalta: s.emFalta,
    diasAtrasoMedio: s.atrasados > 0 ? Math.round(s.diasAtrasoSum / s.atrasados) : 0,
    coberturaMedia: s.coberturaCount > 0 ? Math.round(s.coberturaSum / s.coberturaCount) : 0,
    pontualidade: s.total > 0 ? parseFloat((((s.total - s.atrasados) / s.total) * 100).toFixed(1)) : 100,
  })).sort((a, b) => (b.emFalta * 3 + b.atrasados) - (a.emFalta * 3 + a.atrasados));

  const items: TVItem[] = data.map((item: Record<string, string>) => ({
    codItem: item['Cod Item'] || '',
    descItem: item['Desc Item'] || '',
    fornec: item['Fornec'] || '',
    emFalta: item['Em Falta'] === 'Sim' || item['Ruptura'] === 'Sim' || item['Status'] === 'Em Falta',
    ruptura: item['Ruptura'] === 'Sim',
    diasAtraso: parseInt(item['Dias Atraso'] || '0') || 0,
    cobertura: item['Cobertura'] ? parseFloat(item['Cobertura'].replace(',', '.')) : 999,
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

  // We can add ABC logic later if needed, based on either result or another CSV
  const abcSummary: ABCSummary = { A: 0, B: 0, C: 0, valA: 0, valB: 0, valC: 0 };
  
  return {
    savedAt: new Date().toISOString(),
    kpis,
    items,
    suppliers,
    abcSummary
  };
}
