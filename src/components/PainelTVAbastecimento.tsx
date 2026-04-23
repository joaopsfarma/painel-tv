import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Tv2, Play, Pause, Volume2, VolumeX, Maximize2, Minimize2,
  Clock, PackageX, AlertCircle, ShieldCheck, Users,
  TrendingDown, ChevronLeft, ChevronRight, Activity, Monitor,
  ArrowLeft, Zap, AlertTriangle, DollarSign, BarChart2, Truck, CalendarClock, PieChart as PieChartIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line, LabelList, CartesianGrid } from 'recharts';
import { type FollowUpItem } from '../types';

// ── Tipos ──────────────────────────────────────────────────────────────────

interface TVKpis {
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

interface TVItem {
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

interface TVSupplier {
  nome: string;
  total: number;
  atrasados: number;
  emFalta: number;
  diasAtrasoMedio: number;
  coberturaMedia: number;
  pontualidade: number;
}

interface ABCSummary {
  A: number; B: number; C: number;
  valA: number; valB: number; valC: number;
}

interface TVAbcItem {
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
  validadeData: string | Date;
  diasParaVencer: number;
  quantidade: number;
  estoqueAtual: number;
  estoqueNum: string;
}

interface AbastecimentoTVData {
  savedAt: string;
  kpis: TVKpis;
  items: TVItem[];
  suppliers: TVSupplier[];
  abcSummary?: ABCSummary;
  abcItems?: TVAbcItem[];
  consumos?: TVConsumoItem[];
  validades?: TVValidadeItem[];
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

type SlideType = 'dashboard' | 'rupturas' | 'cobertura_critica' | 'atrasados' | 'fornecedores' | 'curva_abc' | 'followup' | 'consumo' | 'estoque_validade' | 'prescricoes_hora';

interface Slide {
  type: SlideType;
  pageIndex: number;
  totalPages: number;
}

// ── Constantes ─────────────────────────────────────────────────────────────

const ITEMS_PER_SLIDE = 6;
const ROTATION_INTERVAL_MS = 10000;
const TV_DATA_KEY = 'abastecimento_tv_data';

// ── Utilitário ─────────────────────────────────────────────────────────────

const toTitleCase = (str: string) =>
  str.replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"')
    .replace(/\w\S*/g, (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

// ── Props ──────────────────────────────────────────────────────────────────

interface PainelTVAbastecimentoProps {
  onBack?: () => void;
  followUpData?: FollowUpItem[];
}

// ── Sub-componente: Contador animado ───────────────────────────────────────

function AnimatedCount({ target, duration = 800 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (target === 0) { setCount(0); return; }
    const steps = 40;
    const step = target / steps;
    const interval = duration / steps;
    let current = 0;
    const timer = setInterval(() => {
      current = Math.min(current + step, target);
      setCount(Math.round(current));
      if (current >= target) clearInterval(timer);
    }, interval);
    return () => clearInterval(timer);
  }, [target, duration]);
  return <>{count}</>;
}

// ── Sub-componente: Dashboard ──────────────────────────────────────────────

interface FollowUpKpis {
  total: number;
  atrasados: number;
  atrasoMedio: number;
  topAtrasados: FollowUpItem[];
}

function DashboardSlide({ kpis, healthStatus, savedAt, followUpKpis }: {
  kpis: TVKpis;
  healthStatus: 'CRÍTICO' | 'ALERTA' | 'OK';
  savedAt: string;
  followUpKpis?: FollowUpKpis | null;
}) {
  const savedDate = new Date(savedAt).toLocaleString('pt-BR');

  const kpiCards = [
    {
      label: 'Rupturas / Em Falta',
      value: kpis.emFalta,
      icon: PackageX,
      color: 'text-red-400',
      bg: 'bg-red-500/20',
      border: 'border-red-500/40',
      glow: kpis.emFalta > 0,
    },
    {
      label: 'Cobertura Crítica',
      value: kpis.coberturaCritica,
      icon: TrendingDown,
      color: 'text-orange-400',
      bg: 'bg-orange-500/20',
      border: 'border-orange-500/40',
      glow: kpis.coberturaCritica > 0,
    },
    {
      label: 'Pedidos Atrasados',
      value: kpis.atrasados,
      icon: Clock,
      color: 'text-amber-400',
      bg: 'bg-amber-500/20',
      border: 'border-amber-500/40',
      glow: kpis.atrasados > 0,
    },
    {
      label: 'Alto Custo',
      value: kpis.altoCusto,
      icon: DollarSign,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/20',
      border: 'border-indigo-500/40',
      glow: false,
    },
  ];

  const statusConfig = {
    'CRÍTICO': { color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/50', label: 'SITUAÇÃO CRÍTICA' },
    'ALERTA':  { color: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/50', label: 'EM ALERTA' },
    'OK':      { color: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/50', label: 'TUDO SOB CONTROLE' },
  };
  const sc = statusConfig[healthStatus];

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Status global */}
      <div className={`flex items-center justify-center gap-3 py-3 rounded-2xl border ${sc.bg} ${sc.border}`}>
        {healthStatus === 'OK'
          ? <ShieldCheck className={`w-7 h-7 ${sc.color}`} />
          : <AlertCircle className={`w-7 h-7 ${sc.color} animate-pulse`} />
        }
        <span className={`text-2xl font-black tracking-widest uppercase ${sc.color}`}>{sc.label}</span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 flex-1">
        {kpiCards.map((card) => (
          <div
            key={card.label}
            className={`rounded-2xl border ${card.bg} ${card.border} p-5 flex flex-col items-center justify-center gap-3 relative overflow-hidden ${card.glow ? 'shadow-lg' : ''}`}
          >
            {card.glow && (
              <div className={`absolute inset-0 ${card.bg} animate-pulse opacity-40`} />
            )}
            <div className={`p-3 rounded-xl ${card.bg} relative z-10`}>
              <card.icon className={`w-8 h-8 ${card.color}`} />
            </div>
            <div className={`text-6xl font-black ${card.color} relative z-10`}>
              <AnimatedCount target={card.value} />
            </div>
            <div className="text-slate-400 text-sm font-semibold text-center relative z-10">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Métricas complementares */}
      <div className={`grid gap-4 ${followUpKpis ? 'grid-cols-3 lg:grid-cols-6' : 'grid-cols-3'}`}>
        <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4 text-center">
          <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Taxa de Ruptura</div>
          <div className={`text-3xl font-black ${kpis.taxaRuptura > 2 ? 'text-red-400' : 'text-emerald-400'}`}>
            {kpis.taxaRuptura}<span className="text-lg">%</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Meta: &lt; 2%</div>
        </div>
        <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4 text-center">
          <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Cobertura Média</div>
          <div className={`text-3xl font-black ${kpis.coberturaMedia < 7 ? 'text-red-400' : kpis.coberturaMedia <= 30 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {kpis.coberturaMedia}<span className="text-lg"> dias</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Meta: 15–30 dias</div>
        </div>
        <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4 text-center">
          <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total de Itens</div>
          <div className="text-3xl font-black text-purple-400">
            {kpis.total}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Atualizado: {savedDate}</div>
        </div>
        {followUpKpis && (
          <>
            <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4 text-center">
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">OCs Follow Up</div>
              <div className="text-3xl font-black text-violet-400">{followUpKpis.total}</div>
              <div className="text-[10px] text-slate-500 mt-1">Ordens em acompanhamento</div>
            </div>
            <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4 text-center">
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">OCs Atrasadas</div>
              <div className={`text-3xl font-black ${followUpKpis.atrasados > 0 ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
                {followUpKpis.atrasados}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                {followUpKpis.total > 0 ? `${((followUpKpis.atrasados / followUpKpis.total) * 100).toFixed(0)}% do total` : '—'}
              </div>
            </div>
            <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4 text-center">
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Atraso Médio</div>
              <div className={`text-3xl font-black ${followUpKpis.atrasoMedio > 7 ? 'text-red-400' : followUpKpis.atrasoMedio > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {followUpKpis.atrasoMedio}<span className="text-lg"> d</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Dias de atraso médio</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Sub-componente: Lista de Itens ─────────────────────────────────────────

function ItemCard({ item, theme }: { item: TVItem; theme: 'red' | 'orange' | 'amber' }) {
  const colors = {
    red:    { border: 'border-l-red-500',    bg: 'bg-red-500/5',    badge: 'bg-red-500/20 text-red-300 border-red-500/40',    cov: 'text-red-400' },
    orange: { border: 'border-l-orange-500', bg: 'bg-orange-500/5', badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40', cov: 'text-orange-400' },
    amber:  { border: 'border-l-amber-500',  bg: 'bg-amber-500/5',  badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',  cov: 'text-amber-400' },
  };
  const c = colors[theme];

  const covDisplay = item.emFalta
    ? <span className="text-red-400 font-black text-2xl animate-pulse">RUPTURA</span>
    : item.cobertura >= 999
      ? <span className="text-slate-400 text-2xl">—</span>
      : <span className={`${c.cov} font-black text-3xl`}>{Math.round(item.cobertura)}<span className="text-base font-medium"> dias</span></span>;

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={`relative flex items-stretch bg-slate-800/70 rounded-xl border border-slate-700/50 border-l-4 ${c.border} overflow-hidden`}
    >
      {item.emFalta && <div className={`absolute inset-0 ${c.bg} animate-pulse pointer-events-none`} />}
      <div className="flex-1 p-4 relative z-10">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-xs font-mono text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded">{item.codItem}</span>
              {item.curvABC && (
                <span className="text-xs font-bold text-slate-400">Curva {item.curvABC}</span>
              )}
            </div>
            <p className="text-white font-black text-xl leading-snug line-clamp-2 mt-1">{toTitleCase(item.descItem)}</p>
            <p className="text-slate-400 text-sm mt-1 truncate">{toTitleCase(item.fornec)}</p>
          </div>
          <div className="flex-shrink-0 text-right">
            {covDisplay}
            {item.diasAtraso > 0 && (
              <div className={`text-base font-semibold mt-1 border rounded px-2 py-1 ${c.badge}`}>
                {item.diasAtraso} dias atraso
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between mt-4 text-sm text-slate-500 border-t border-slate-700/50 pt-3">
          <div className="flex gap-4">
             <span>Estoque: <strong className="text-slate-300 text-base">{item.estoqDisp}</strong></span>
             {item.ocNum && <span>OC: <strong className="text-slate-300 text-base">{item.ocNum}</strong></span>}
             {item.ocEntrega && <span>Entrega: <strong className="text-slate-300 text-base">{item.ocEntrega}</strong></span>}
          </div>
          <div className="flex gap-2">
             {item.altoCusto && <span className="text-indigo-400 font-bold tracking-wide uppercase px-2 py-0.5 bg-indigo-500/10 rounded">• ALTO CUSTO</span>}
             {item.importado && <span className="text-blue-400 font-bold tracking-wide uppercase px-2 py-0.5 bg-blue-500/10 rounded">• IMPORTADO</span>}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ItemListSlide({ items, theme, subtitle }: {
  items: TVItem[];
  theme: 'red' | 'orange' | 'amber';
  subtitle: string;
}) {
  return (
    <div className="flex flex-col gap-3 h-full">
      <p className="text-slate-400 text-sm font-medium">{subtitle}</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1">
        {items.map((item, idx) => (
          <ItemCard key={`${item.codItem}-${idx}`} item={item} theme={theme} />
        ))}
      </div>
    </div>
  );
}

// ── Sub-componente: Fornecedores ───────────────────────────────────────────

function SupplierSlide({ suppliers }: { suppliers: TVSupplier[] }) {
  const sorted = [...suppliers]
    .sort((a, b) => (b.emFalta * 3 + b.atrasados) - (a.emFalta * 3 + a.atrasados))
    .slice(0, 8);

  return (
    <div className="flex flex-col gap-3 h-full">
      <p className="text-slate-400 text-sm font-medium">Ranking por risco assistencial — top {sorted.length} fornecedores</p>
      <div className="flex flex-col gap-2 flex-1">
        {sorted.map((sup, idx) => {
          const status = sup.emFalta > 0 ? 'CRÍTICO' : sup.atrasados > 0 ? 'ATENÇÃO' : 'OK';
          const statusColors = {
            CRÍTICO: 'bg-red-500/20 text-red-300 border-red-500/40',
            ATENÇÃO: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
            OK:      'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          };
          const pontColor = sup.pontualidade >= 90 ? 'bg-emerald-500' : sup.pontualidade >= 70 ? 'bg-amber-500' : 'bg-red-500';

          return (
            <motion.div
              key={sup.nome}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05, duration: 0.3 }}
              className="flex items-center gap-4 bg-slate-800/70 rounded-xl border border-slate-700/50 px-4 py-3"
            >
              {/* Rank */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0 ${idx === 0 ? 'bg-red-500/30 text-red-300' : idx === 1 ? 'bg-orange-500/30 text-orange-300' : 'bg-slate-700 text-slate-400'}`}>
                {idx + 1}
              </div>

              {/* Nome */}
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm truncate">{toTitleCase(sup.nome)}</p>
                <p className="text-slate-500 text-[11px]">{sup.total} itens · {sup.diasAtrasoMedio.toFixed(0)}d atraso médio</p>
              </div>

              {/* Pontualidade */}
              <div className="w-24 flex-shrink-0">
                <div className="text-[10px] text-slate-500 mb-1">Pontualidade</div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${pontColor} transition-all`} style={{ width: `${sup.pontualidade}%` }} />
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">{sup.pontualidade.toFixed(0)}%</div>
              </div>

              {/* Rupturas */}
              {sup.emFalta > 0 && (
                <div className="bg-red-500/20 text-red-300 border border-red-500/40 rounded-lg px-2 py-1 text-xs font-bold flex-shrink-0">
                  {sup.emFalta} ruptura{sup.emFalta > 1 ? 's' : ''}
                </div>
              )}

              {/* Status */}
              <div className={`px-2.5 py-1 rounded-lg border text-xs font-bold flex-shrink-0 ${statusColors[status]}`}>
                {status}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ── Sub-componente: Curva ABC ──────────────────────────────────────────────

function SlideAbcOficial({ abcItems, abc }: { abcItems: TVAbcItem[]; abc: ABCSummary }) {
  const total = abc.A + abc.B + abc.C;
  const valTotal = abc.valA + abc.valB + abc.valC;

  // Pie chart data
  const pieData = [
    { name: 'Classe A', value: abc.valA, count: abc.A, fill: '#ef4444' },
    { name: 'Classe B', value: abc.valB, count: abc.B, fill: '#f59e0b' },
    { name: 'Classe C', value: abc.valC, count: abc.C, fill: '#64748b' }
  ];

  // Top 5 items classe A
  const topA = abcItems.filter(i => i.classe === 'A').slice(0, 5);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {pieData.map((c) => {
          const pctCount = total > 0 ? ((c.count / total) * 100).toFixed(1) : '0';
          const pctVal = valTotal > 0 ? ((c.value / valTotal) * 100).toFixed(1) : '0';
          return (
            <div key={c.name} className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 flex flex-col justify-between" style={{ borderLeftColor: c.fill, borderLeftWidth: 4 }}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-lg font-black text-white">{c.name}</span>
                <span className="text-xs font-bold px-2 py-1 rounded" style={{ backgroundColor: `${c.fill}20`, color: c.fill }}>
                  {pctVal}% VALOR
                </span>
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-sm text-slate-400 font-semibold mb-1">Custo Acumulado</p>
                  <p className="text-2xl font-black" style={{ color: c.fill }}>
                    R$ {c.value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black text-white">{c.count}</p>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase">{pctCount}% itens</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-4 flex-1 min-h-0 mt-2">
        {/* Gráfico Rosca */}
        <div className="w-[30%] bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 flex flex-col items-center">
          <p className="text-sm font-bold text-slate-300 uppercase mb-2">Distribuição Financeira</p>
          <div className="flex-1 w-full min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" stroke="none">
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(val: any) => `R$ ${Number(val || 0).toLocaleString('pt-BR')}`}
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lista Top A */}
        <div className="w-[70%] bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 flex flex-col">
          <p className="text-sm font-bold text-red-400 uppercase mb-3 flex items-center justify-between">
            <span>Principais Ofensores - Classe A</span>
            <span className="text-xs text-slate-400 font-normal">Top 5 itens representam maior custo do hospital</span>
          </p>
          
          <div className="flex-1 overflow-hidden flex flex-col justify-between">
            {topA.map((item, idx) => (
              <div key={item.cod} className="bg-slate-900/50 border border-slate-700/30 rounded flex justify-between p-3">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="bg-red-500/10 text-red-400 font-black text-lg w-8 h-8 rounded flex justify-center items-center flex-shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="text-white font-bold text-sm truncate">{toTitleCase(item.produto)}</p>
                    <p className="text-xs text-slate-400 mt-1">Cód: {item.cod} | {item.qtdConsumo} un consumidas</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 flex flex-col justify-center">
                  <p className="text-red-400 font-black text-lg">R$ {item.vlCustoPeriodo.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                  <p className="text-xs text-slate-500 font-semibold">{item.percAcum.toFixed(1)}% do acumulado</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-componente: Prescrições por Hora ─────────────────────────────────

const PRESC_DATA = [
  { hour: '00h', val: 8 }, { hour: '01h', val: 9 }, { hour: '02h', val: 1 }, { hour: '03h', val: 3 },
  { hour: '04h', val: 2 }, { hour: '05h', val: 1 }, { hour: '06h', val: 2 }, { hour: '07h', val: 1 },
  { hour: '08h', val: 6 }, { hour: '09h', val: 21 }, { hour: '10h', val: 32 }, { hour: '11h', val: 56 },
  { hour: '12h', val: 37 }, { hour: '13h', val: 25 }, { hour: '14h', val: 6 }, { hour: '15h', val: 11 },
  { hour: '16h', val: 9 }, { hour: '17h', val: 8 }, { hour: '18h', val: 6 }, { hour: '19h', val: 2 },
  { hour: '20h', val: 2 }, { hour: '21h', val: 6 }, { hour: '22h', val: 2 }, { hour: '23h', val: 10 },
];

function SlidePrescricoesHora() {
  const peak = Math.max(...PRESC_DATA.map(d => d.val));
  const total = PRESC_DATA.reduce((acc, d) => acc + d.val, 0);

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* KPIs no topo */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-purple-500/15 border border-purple-500/40 rounded-xl p-6">
          <p className="text-sm text-purple-300 font-bold uppercase mb-1">Total Prescrições (24h)</p>
          <p className="text-5xl font-black text-purple-400">{total}</p>
        </div>
        <div className="bg-lime-500/15 border border-lime-500/40 rounded-xl p-6">
          <p className="text-sm text-lime-300 font-bold uppercase mb-1">Horário de Pico</p>
          <div className="flex items-baseline gap-3">
            <span className="text-5xl font-black text-lime-400">11:00</span>
            <span className="text-xl font-bold text-lime-500/70">{peak} presc.</span>
          </div>
        </div>
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-6">
          <p className="text-sm text-slate-400 font-bold uppercase mb-1">Média Hospitalar</p>
          <p className="text-5xl font-black text-white">{(total / 24).toFixed(1)}</p>
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-tighter">prescrições por hora</p>
        </div>
      </div>

      {/* Gráfico Principal */}
      <div className="h-[550px] w-full bg-[#fdfdfd] border border-slate-200 rounded-2xl p-4 shadow-sm">
        <ResponsiveContainer width="99%" height={500}>
          <LineChart data={PRESC_DATA} margin={{ top: 40, right: 40, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis 
              dataKey="hour" 
              stroke="#64748b" 
              fontSize={14} 
              fontWeight="bold"
              dy={10}
            />
            <YAxis 
              stroke="#64748b" 
              fontSize={14} 
              fontWeight="bold"
              domain={[0, 65]}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
            />
            <Line 
              type="monotone" 
              dataKey="val" 
              stroke="#2563eb" 
              strokeWidth={3}
              dot={{ r: 7, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 9 }}
              isAnimationActive={false}
            >
              <LabelList 
                dataKey="val" 
                position="top" 
                offset={15} 
                style={{ fill: '#1e293b', fontSize: '16px', fontWeight: '900' }} 
              />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Sub-componente: Follow Up ─────────────────────────────────────────────

function FollowUpSlide({ items, pageIndex, totalPages }: {
  items: FollowUpItem[];
  pageIndex: number;
  totalPages: number;
}) {
  const page = items.slice(pageIndex * ITEMS_PER_SLIDE, (pageIndex + 1) * ITEMS_PER_SLIDE);

  return (
    <div className="flex flex-col gap-3 h-full">
      <p className="text-slate-400 text-sm font-medium">
        {items.length} ordem{items.length !== 1 ? 'ns' : ''} de compra em atraso — Acompanhamento Follow Up
        {totalPages > 1 && <span className="ml-2 text-slate-600">· Pág. {pageIndex + 1}/{totalPages}</span>}
      </p>
      <div className="flex flex-col gap-2 flex-1">
        {page.map((item, idx) => {
          const isCritical = item.delayDays > 7;
          return (
            <motion.div
              key={`${item.ocNumber}-${item.itemCode}-${idx}`}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.3, delay: idx * 0.04, ease: 'easeOut' }}
              className={`flex items-center gap-4 rounded-xl border px-4 py-3 ${
                isCritical
                  ? 'bg-red-500/10 border-red-500/40 border-l-4 border-l-red-500'
                  : 'bg-amber-500/8 border-amber-500/30 border-l-4 border-l-amber-500'
              }`}
            >
              {/* Dias de atraso */}
              <div className={`flex-shrink-0 w-16 text-center ${isCritical ? 'text-red-400' : 'text-amber-400'}`}>
                <div className={`text-2xl font-black ${isCritical ? 'animate-pulse' : ''}`}>{item.delayDays}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wide opacity-80">dias</div>
              </div>

              {/* Informações do item */}
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm leading-snug truncate">{item.itemName}</p>
                <p className="text-slate-400 text-xs mt-0.5 truncate">
                  OC {item.ocNumber} · {item.supplier}
                </p>
              </div>

              {/* Qtd pendente */}
              <div className="flex-shrink-0 text-right">
                <div className="text-slate-300 text-sm font-semibold">{item.pendingQty}</div>
                <div className="text-[10px] text-slate-500">qtd pend.</div>
              </div>

              {/* Data de entrega */}
              {item.deliveryDate && (
                <div className="flex-shrink-0 text-right">
                  <div className="text-xs text-slate-500">Previsão</div>
                  <div className="text-xs text-slate-400 font-semibold">{item.deliveryDate}</div>
                </div>
              )}

              {/* Badge status */}
              <div className={`flex-shrink-0 px-2.5 py-1 rounded-lg border text-xs font-bold ${
                isCritical
                  ? 'bg-red-500/20 text-red-300 border-red-500/40'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              }`}>
                {isCritical ? 'CRÍTICO' : 'ATRASADO'}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ── Sub-componente: Consumo Financeiro ──────────────────────────────────────

function SlideConsumoABC({ consumos, abc }: { consumos: TVConsumoItem[], abc?: ABCSummary }) {
  const top10 = consumos.slice(0, 10);
  const totalValor = consumos.reduce((s, c) => s + c.vlCustoPeriodo, 0);
  const totalPecas = consumos.reduce((s, c) => s + c.qtdConsumo, 0);
  
  const pieColors = ['#ef4444', '#f59e0b', '#64748b'];
  const pieData = abc ? [
    { name: 'Classe A', value: abc.valA || 0 },
    { name: 'Classe B', value: abc.valB || 0 },
    { name: 'Classe C', value: abc.valC || 0 }
  ] : [];

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* KPIs Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-indigo-500/15 border border-indigo-500/40 rounded-xl p-3 text-center">
          <p className="text-xs text-indigo-300 font-bold uppercase">Custo Total Período</p>
          <p className="text-2xl font-black text-indigo-400">R$ {totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
        </div>
        <div className="bg-purple-500/15 border border-purple-500/40 rounded-xl p-3 text-center">
          <p className="text-xs text-purple-300 font-bold uppercase">Itens Distintos</p>
          <p className="text-2xl font-black text-purple-400">{consumos.length}</p>
        </div>
        <div className="bg-emerald-500/15 border border-emerald-500/40 rounded-xl p-3 text-center">
          <p className="text-xs text-emerald-300 font-bold uppercase">Peças Consumidas</p>
          <p className="text-2xl font-black text-emerald-400">{totalPecas.toLocaleString('pt-BR')}</p>
        </div>
        <div className="bg-amber-500/15 border border-amber-500/40 rounded-xl p-3 text-center">
          <p className="text-xs text-amber-300 font-bold uppercase">Custo Médio/Item</p>
          <p className="text-2xl font-black text-amber-400">R$ {consumos.length > 0 ? (totalValor / consumos.length).toFixed(2) : '0'}</p>
        </div>
        <div className="bg-rose-500/15 border border-rose-500/40 rounded-xl p-3 text-center">
          <p className="text-xs text-rose-300 font-bold uppercase">Ticket Médio/Peça</p>
          <p className="text-2xl font-black text-rose-400">R$ {totalPecas > 0 ? (totalValor / totalPecas).toFixed(2) : '0'}</p>
        </div>
      </div>
      {/* Charts */}
      <div className="flex gap-4 flex-1 min-h-0">
        <div className="flex-1 flex flex-col gap-2">
          <p className="text-slate-400 text-sm font-bold uppercase">Top 10 Maior Custo</p>
          <div className="flex-1 min-h-0 bg-slate-800/30 p-2 rounded-xl border border-slate-700/50">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top10} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="produto" type="category" width={280} tick={{ fontSize: 11, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
                <Tooltip 
                   formatter={(val: any) => `R$ ${Number(val || 0).toLocaleString('pt-BR')}`}
                   contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                />
                <Bar dataKey="vlCustoPeriodo" fill="#6366f1" radius={[0, 4, 4, 0]}>
                  {top10.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={index < 3 ? '#ef4444' : '#6366f1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        {abc && (abc.A + abc.B + abc.C) > 0 && (
          <div className="w-[300px] flex flex-col bg-slate-800/50 p-4 rounded-xl border border-slate-700">
             <p className="text-slate-400 text-sm font-bold text-center mb-2 uppercase">Curva ABC</p>
             <div className="flex-1 w-full min-h-[200px]">
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                   <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={5} dataKey="value" stroke="none">
                     {pieData.map((_, index) => (
                       <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                     ))}
                   </Pie>
                   <Tooltip formatter={(val: any) => `R$ ${Number(val || 0).toLocaleString('pt-BR')}`} contentStyle={{ backgroundColor: '#1e293b', border: 'none' }} />
                   <Legend verticalAlign="bottom" height={36} wrapperStyle={{ color: '#cbd5e1', fontSize: '12px' }} />
                 </PieChart>
               </ResponsiveContainer>
             </div>
             <div className="grid grid-cols-3 gap-2 mt-2">
               <div className="text-center"><span className="text-red-400 font-black text-lg">{abc.A}</span><br/><span className="text-[10px] text-slate-500">itens A</span></div>
               <div className="text-center"><span className="text-amber-400 font-black text-lg">{abc.B}</span><br/><span className="text-[10px] text-slate-500">itens B</span></div>
               <div className="text-center"><span className="text-slate-400 font-black text-lg">{abc.C}</span><br/><span className="text-[10px] text-slate-500">itens C</span></div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-componente: Validade e Estoque ────────────────────────────────────

function SlideValidadeEstoque({ validades, kpis, pageIndex, totalPages }: { validades: TVValidadeItem[], kpis: any, pageIndex: number, totalPages: number }) {
  const page = validades.slice(pageIndex * ITEMS_PER_SLIDE, (pageIndex + 1) * ITEMS_PER_SLIDE);

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-red-500/20 border border-red-500/40 rounded-xl p-3 flex justify-between items-center text-red-400">
           <div>
             <p className="text-xs font-bold uppercase tracking-wider">Vence &lt; 30 Dias</p>
             <p className="text-3xl font-black">{kpis?.itensVencendo30d || 0}</p>
           </div>
           <CalendarClock className="w-8 h-8 opacity-50" />
        </div>
        <div className="bg-amber-500/20 border border-amber-500/40 rounded-xl p-3 flex justify-between items-center text-amber-400">
           <div>
             <p className="text-xs font-bold uppercase tracking-wider">Vence &lt; 90 Dias</p>
             <p className="text-3xl font-black">{kpis?.itensVencendo90d || 0}</p>
           </div>
           <CalendarClock className="w-7 h-7 opacity-50" />
        </div>
        <div className="bg-purple-500/20 border border-purple-500/40 rounded-xl p-3 flex justify-between items-center text-purple-400">
           <div>
             <p className="text-xs font-bold uppercase tracking-wider">Total Lotes</p>
             <p className="text-3xl font-black">{kpis?.totalLotes || 0}</p>
           </div>
        </div>
        <div className="bg-violet-500/20 border border-violet-500/40 rounded-xl p-3 flex justify-between items-center text-violet-400">
           <div>
             <p className="text-xs font-bold uppercase tracking-wider">Produtos Distintos</p>
             <p className="text-3xl font-black">{kpis?.totalProdutosEstoque || 0}</p>
           </div>
        </div>
      </div>
      
      <p className="text-slate-400 text-sm font-bold uppercase">Lotes Mais Próximos de Expirar {totalPages > 1 && `(Pag ${pageIndex+1}/${totalPages})`}</p>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1">
        {page.map((v, idx) => {
          const isCritical = v.diasParaVencer <= 30;
          return (
            <motion.div key={`${v.produto}-${v.lote}-${idx}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }} className={`flex gap-3 p-3 rounded-lg border ${isCritical ? 'bg-red-500/10 border-red-500/40' : 'bg-amber-500/10 border-amber-500/40'}`}>
               <div className={`flex flex-col items-center justify-center p-2 rounded-md ${isCritical ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'} min-w-[70px]`}>
                 <span className="text-2xl font-black">{v.diasParaVencer}</span>
                 <span className="text-[10px] font-bold uppercase">Dias</span>
               </div>
               <div className="flex-1 min-w-0 flex flex-col justify-center">
                 <p className="text-white text-base font-black truncate">{toTitleCase(v.produto)}</p>
                 <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-slate-400">
                   <span>Lote: <strong className="text-slate-300">{v.lote}</strong></span>
                   <span>Vence: <strong className="text-slate-300">{v.validadeStr}</strong></span>
                   <span>Qtd: <strong className="text-slate-300">{v.quantidade}</strong></span>
                   {v.estoqueNum && <span>Est: <strong className="text-cyan-400 text-base">{v.estoqueNum}</strong></span>}
                   <span>Estoque Total: <strong className="text-emerald-400 text-base">{v.estoqueAtual.toLocaleString('pt-BR')}</strong></span>
                 </div>
               </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  );
}

// ── Componente Principal ───────────────────────────────────────────────────

export function PainelTVAbastecimento({ onBack, followUpData }: PainelTVAbastecimentoProps) {
  const [tvData, setTvData] = useState<AbastecimentoTVData | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSoundEnabled, setIsSoundEnabled] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const containerRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const prevSlideTypeRef = useRef<SlideType | null>(null);

  // ── Carregar dados do localStorage ──
  useEffect(() => {
    const raw = localStorage.getItem(TV_DATA_KEY);
    if (!raw) return;
    try {
      setTvData(JSON.parse(raw) as AbastecimentoTVData);
    } catch {
      console.warn('[PainelTVAbastecimento] Dados inválidos no localStorage');
    }
  }, []);

  // ── Relógio ──
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Fullscreen ──
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  // ── Audio Context (lazy init) ──
  const getOrCreateAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  const playCriticoAlert = useCallback(() => {
    const ctx = getOrCreateAudioCtx();
    const notes = [523, 659, 523];
    notes.forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.18;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.14);
    });
  }, [getOrCreateAudioCtx]);

  const playAlertaChime = useCallback(() => {
    const ctx = getOrCreateAudioCtx();
    const notes = [392, 330];
    notes.forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.45;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  }, [getOrCreateAudioCtx]);

  const playSoftPulse = useCallback(() => {
    const ctx = getOrCreateAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(261, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  }, [getOrCreateAudioCtx]);

  // ── Follow Up KPIs ──
  const followUpKpis = useMemo<FollowUpKpis | null>(() => {
    if (!followUpData?.length) return null;
    const atrasados = followUpData.filter(i => i.status === 'Atrasado');
    const totalAtraso = atrasados.reduce((s, i) => s + i.delayDays, 0);
    return {
      total: followUpData.length,
      atrasados: atrasados.length,
      atrasoMedio: atrasados.length ? Math.round(totalAtraso / atrasados.length) : 0,
      topAtrasados: [...atrasados].sort((a, b) => b.delayDays - a.delayDays),
    };
  }, [followUpData]);

  // ── Slides ──
  const slides = useMemo<Slide[]>(() => {
    if (!tvData) return [];
    const result: Slide[] = [];

    result.push({ type: 'dashboard', pageIndex: 0, totalPages: 1 });

    const rupturaItems = tvData.items.filter(i => i.emFalta);
    if (rupturaItems.length > 0) {
      const pages = Math.ceil(rupturaItems.length / ITEMS_PER_SLIDE);
      for (let p = 0; p < pages; p++) result.push({ type: 'rupturas', pageIndex: p, totalPages: pages });
    }

    const critItems = tvData.items.filter(i => !i.emFalta && i.cobertura < 7 && i.cobertura >= 0);
    if (critItems.length > 0) {
      const pages = Math.ceil(critItems.length / ITEMS_PER_SLIDE);
      for (let p = 0; p < pages; p++) result.push({ type: 'cobertura_critica', pageIndex: p, totalPages: pages });
    }

    const atrasadoItems = tvData.items.filter(i => i.atrasado && !i.emFalta);
    if (atrasadoItems.length > 0) {
      const pages = Math.ceil(atrasadoItems.length / ITEMS_PER_SLIDE);
      for (let p = 0; p < pages; p++) result.push({ type: 'atrasados', pageIndex: p, totalPages: pages });
    }

    if (tvData.suppliers.length > 0) {
      result.push({ type: 'fornecedores', pageIndex: 0, totalPages: 1 });
    }

    // Slide Curva ABC
    if (tvData.abcItems && tvData.abcItems.length > 0 && tvData.abcSummary) {
      result.push({ type: 'curva_abc', pageIndex: 0, totalPages: 1 });
    }

    // Slide Consumo Financeiro (DESATIVADO)
    // if (tvData.consumos && tvData.consumos.length > 0) {
    //   result.push({ type: 'consumo', pageIndex: 0, totalPages: 1 });
    // }

    // Slide Validade Estoque (DESATIVADO - reformulação pendente)
    // if (tvData.validades && tvData.validades.length > 0) {
    //   const expiring = tvData.validades.filter(v => v.diasParaVencer <= 90).slice(0, 30);
    //   if (expiring.length > 0) {
    //     const pages = Math.ceil(expiring.length / ITEMS_PER_SLIDE);
    //     for (let p = 0; p < pages; p++) result.push({ type: 'estoque_validade', pageIndex: p, totalPages: pages });
    //   }
    // }

    // Slides Follow Up
    if (followUpKpis && followUpKpis.atrasados > 0) {
      const pages = Math.ceil(followUpKpis.topAtrasados.length / ITEMS_PER_SLIDE);
      for (let p = 0; p < pages; p++) result.push({ type: 'followup', pageIndex: p, totalPages: pages });
    }

    // Slide Prescrições por Hora (Manual data from 7462)
    result.push({ type: 'prescricoes_hora', pageIndex: 0, totalPages: 1 });

    return result;
  }, [tvData, followUpKpis]);

  // ── Status de saúde global ──
  const healthStatus = useMemo<'CRÍTICO' | 'ALERTA' | 'OK'>(() => {
    if (!tvData) return 'OK';
    if (tvData.kpis.emFalta > 0 || tvData.kpis.taxaRuptura > 5) return 'CRÍTICO';
    if (tvData.kpis.coberturaCritica > 0 || tvData.kpis.atrasados > 0) return 'ALERTA';
    return 'OK';
  }, [tvData]);

  // ── Auto-rotação ──
  useEffect(() => {
    if (!isPlaying || slides.length === 0) return;
    const id = setInterval(() => {
      setSlideIndex(prev => (prev + 1) % slides.length);
    }, ROTATION_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isPlaying, slides.length]);

  // ── Áudio por transição de tipo de slide ──
  useEffect(() => {
    if (!isPlaying || !isSoundEnabled || slides.length === 0) return;
    const current = slides[slideIndex];
    if (!current) return;
    if (current.type === prevSlideTypeRef.current) return;
    prevSlideTypeRef.current = current.type;

    if (current.type === 'rupturas') playCriticoAlert();
    else if (current.type === 'cobertura_critica' || current.type === 'atrasados' || current.type === 'followup') playAlertaChime();
    else if (current.type === 'dashboard' && healthStatus !== 'OK') playSoftPulse();
  }, [slideIndex, isPlaying, isSoundEnabled, slides, healthStatus, playCriticoAlert, playAlertaChime, playSoftPulse]);

  // ── Dados filtrados por slide ──
  const currentSlideItems = useMemo(() => {
    if (!tvData || slides.length === 0) return [];
    const current = slides[slideIndex];
    if (!current) return [];

    let pool: TVItem[] = [];
    if (current.type === 'rupturas') pool = tvData.items.filter(i => i.emFalta);
    else if (current.type === 'cobertura_critica') pool = tvData.items.filter(i => !i.emFalta && i.cobertura < 7 && i.cobertura >= 0);
    else if (current.type === 'atrasados') pool = tvData.items.filter(i => i.atrasado && !i.emFalta);

    const start = current.pageIndex * ITEMS_PER_SLIDE;
    return pool.slice(start, start + ITEMS_PER_SLIDE);
  }, [tvData, slides, slideIndex]);

  // ── Config por tipo de slide ──
  const slideConfig = useMemo(() => {
    const current = slides[slideIndex];
    if (!current) return null;

    const configs = {
      dashboard: {
        title: 'PAINEL GERAL — REDE AMÉRICAS',
        icon: Activity,
        iconColor: 'text-purple-400',
        iconPulse: false,
        progressColor: 'from-purple-600 to-violet-400',
        theme: 'blue' as const,
      },
      rupturas: {
        title: 'RUPTURAS / EM FALTA',
        icon: PackageX,
        iconColor: 'text-red-400',
        iconPulse: true,
        progressColor: 'from-red-600 to-red-400',
        theme: 'red' as const,
      },
      cobertura_critica: {
        title: 'COBERTURA CRÍTICA',
        icon: TrendingDown,
        iconColor: 'text-orange-400',
        iconPulse: false,
        progressColor: 'from-orange-600 to-orange-400',
        theme: 'orange' as const,
      },
      atrasados: {
        title: 'PEDIDOS ATRASADOS',
        icon: Clock,
        iconColor: 'text-amber-400',
        iconPulse: false,
        progressColor: 'from-amber-600 to-amber-400',
        theme: 'amber' as const,
      },
      fornecedores: {
        title: 'AVALIAÇÃO DE FORNECEDORES',
        icon: Users,
        iconColor: 'text-purple-400',
        iconPulse: false,
        progressColor: 'from-purple-600 to-violet-400',
        theme: 'blue' as const,
      },
      curva_abc: {
        title: 'CURVA ABC — CLASSIFICAÇÃO',
        icon: BarChart2,
        iconColor: 'text-lime-400',
        iconPulse: false,
        progressColor: 'from-lime-600 to-green-400',
        theme: 'blue' as const,
      },
      followup: {
        title: 'FOLLOW UP — OCs ATRASADAS',
        icon: Truck,
        iconColor: 'text-rose-400',
        iconPulse: true,
        progressColor: 'from-rose-600 to-rose-400',
        theme: 'red' as const,
      },
      consumo: {
        title: 'CONSUMO FINANCEIRO NO PERÍODO',
        icon: PieChartIcon,
        iconColor: 'text-purple-400',
        iconPulse: false,
        progressColor: 'from-purple-600 to-violet-400',
        theme: 'blue' as const,
      },
      estoque_validade: {
        title: 'ALERTA DE VALIDADE (PRÓXIMOS 90 DIAS)',
        icon: CalendarClock,
        iconColor: 'text-red-400',
        iconPulse: true,
        progressColor: 'from-red-600 to-orange-400',
        theme: 'red' as const,
      },
      prescricoes_hora: {
        title: '7462 — PRESCRIÇÕES GERADAS POR HORA (BSB)',
        icon: Activity,
        iconColor: 'text-purple-400',
        iconPulse: true,
        progressColor: 'from-purple-600 to-lime-400',
        theme: 'blue' as const,
      },
    };

    return { ...configs[current.type], slide: current };
  }, [slides, slideIndex]);

  const handleStart = () => {
    getOrCreateAudioCtx();
    prevSlideTypeRef.current = null;
    setSlideIndex(0);
    setIsPlaying(true);
    setIsSoundEnabled(true);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // STATE 1: Sem dados
  // ─────────────────────────────────────────────────────────────────────────

  if (!tvData) {
    return (
      <div ref={containerRef} className="min-h-screen bg-slate-900 flex items-center justify-center font-sans">
        <div className="max-w-md w-full mx-auto p-8 text-center">
          <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-slate-700">
            <Tv2 className="w-10 h-10 text-slate-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Nenhum dado disponível</h2>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            Para usar o Painel TV, acesse primeiro a aba{' '}
            <strong className="text-purple-400">Visão de Abastecimento</strong> e importe
            um arquivo CSV. Os dados serão salvos automaticamente para exibição aqui.
          </p>
          <button
            onClick={onBack}
            className="flex items-center gap-2 mx-auto text-sm font-semibold text-white bg-purple-600 hover:bg-purple-500 px-5 py-2.5 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Ir para Visão de Abastecimento
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STATE 2: Splash
  // ─────────────────────────────────────────────────────────────────────────

  if (!isPlaying) {
    const savedDate = new Date(tvData.savedAt).toLocaleString('pt-BR');
    const alertBadges = [
      { label: 'rupturas', value: tvData.kpis.emFalta, color: 'bg-red-500/20 text-red-300 border-red-500/40' },
      { label: 'cob. crítica', value: tvData.kpis.coberturaCritica, color: 'bg-orange-500/20 text-orange-300 border-orange-500/40' },
      { label: 'atrasados', value: tvData.kpis.atrasados, color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
      { label: 'total itens', value: tvData.kpis.total, color: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
      ...(followUpKpis ? [{ label: 'OCs atrasadas', value: followUpKpis.atrasados, color: 'bg-rose-500/20 text-rose-300 border-rose-500/40' }] : []),
    ];

    return (
      <div ref={containerRef} className="min-h-screen bg-slate-900 flex items-center justify-center font-sans">
        <div className="max-w-lg w-full mx-auto p-8 text-center">
          <div className="w-24 h-24 bg-gradient-to-br from-purple-600 to-violet-800 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-purple-900/50">
            <Monitor className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-black text-white mb-1">Painel TV — Rede Américas</h1>
          <p className="text-purple-300 font-semibold mb-2">Abastecimento Farmacêutico & Follow Up</p>
          <p className="text-slate-500 text-xs mb-8">Dados salvos em: {savedDate}</p>

          <div className="grid grid-cols-2 gap-3 mb-8">
            {alertBadges.map(b => (
              <div key={b.label} className={`rounded-xl border px-4 py-3 ${b.color}`}>
                <div className="text-3xl font-black">{b.value}</div>
                <div className="text-xs font-semibold uppercase tracking-wider opacity-80 mt-0.5">{b.label}</div>
              </div>
            ))}
          </div>

          <button
            onClick={handleStart}
            className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-purple-600 to-violet-700 hover:from-purple-500 hover:to-violet-600 text-white font-black text-lg py-4 rounded-2xl shadow-xl shadow-purple-900/40 transition-all"
          >
            <Play className="w-6 h-6" /> INICIAR PAINEL E ÁUDIO
          </button>

          <button
            onClick={onBack}
            className="mt-4 text-slate-500 hover:text-slate-300 text-sm flex items-center gap-1.5 mx-auto transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar para Abastecimento
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STATE 3: Tudo OK (apenas dashboard + fornecedores, sem alertas)
  // ─────────────────────────────────────────────────────────────────────────

  if (isPlaying && healthStatus === 'OK' && slides.length <= 2) {
    return (
      <div ref={containerRef} className="min-h-screen bg-slate-900 flex flex-col items-center justify-center font-sans gap-6">
        <ShieldCheck className="w-24 h-24 text-lime-400" />
        <h2 className="text-4xl font-black text-white">Estoque Sob Controle</h2>
        <p className="text-lime-400 text-xl font-semibold">Sem rupturas ou alertas críticos</p>
        <p className="text-slate-500 text-sm">{tvData.kpis.total} itens analisados · Cobertura média: {tvData.kpis.coberturaMedia} dias</p>
        <button
          onClick={() => setIsPlaying(false)}
          className="mt-4 flex items-center gap-2 text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-4 py-2 rounded-xl transition-colors text-sm"
        >
          <Pause className="w-4 h-4" /> Pausar
        </button>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STATE 4: Painel Principal
  // ─────────────────────────────────────────────────────────────────────────

  const cfg = slideConfig!;
  const currentSlide = slides[slideIndex];

  const statusBadgeColors = {
    CRÍTICO: 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse',
    ALERTA:  'bg-amber-500/20 text-amber-400 border-amber-500/40',
    OK:      'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  };

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-slate-900 flex flex-col font-sans select-none"
    >
      {/* ── HEADER ── */}
      <header className="bg-slate-950/80 border-b border-slate-800/60 backdrop-blur-sm px-6 py-3 flex-shrink-0">
        {/* Linha superior: info geral */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-slate-500 text-xs">
            <Monitor className="w-3.5 h-3.5" />
            <span>Painel TV · Rede Américas · Abastecimento & Follow Up</span>
          </div>
          <div className="flex items-center gap-2 text-slate-400 text-sm font-mono">
            <Clock className="w-4 h-4" />
            {currentTime.toLocaleTimeString('pt-BR')}
          </div>
          <div className="text-slate-500 text-xs">
            Slide {slideIndex + 1} / {slides.length}
          </div>
        </div>

        {/* Linha principal */}
        <div className="flex items-center justify-between gap-4">
          {/* Título do slide */}
          <div className="flex items-center gap-3">
            <div className={cfg.iconPulse ? 'animate-pulse' : ''}>
              <cfg.icon className={`w-7 h-7 ${cfg.iconColor}`} />
            </div>
            <div>
              <h2 className="text-white font-black text-xl tracking-wide">{cfg.title}</h2>
              {currentSlide.totalPages > 1 && (
                <p className="text-slate-500 text-xs">
                  Página {currentSlide.pageIndex + 1} de {currentSlide.totalPages}
                </p>
              )}
            </div>
          </div>

          {/* Status badge */}
          <div className={`px-4 py-1.5 rounded-xl border text-sm font-black tracking-widest ${statusBadgeColors[healthStatus]}`}>
            {healthStatus === 'CRÍTICO' && <Zap className="w-4 h-4 inline mr-1.5" />}
            {healthStatus === 'ALERTA' && <AlertTriangle className="w-4 h-4 inline mr-1.5" />}
            {healthStatus === 'OK' && <ShieldCheck className="w-4 h-4 inline mr-1.5" />}
            {healthStatus}
          </div>

          {/* Controles */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSlideIndex(prev => (prev - 1 + slides.length) % slides.length)}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              title="Slide anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setSlideIndex(prev => (prev + 1) % slides.length)}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              title="Próximo slide"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsSoundEnabled(s => !s)}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isSoundEnabled ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-800 text-slate-500 hover:text-slate-300'}`}
              title={isSoundEnabled ? 'Desativar som' : 'Ativar som'}
            >
              {isSoundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              onClick={toggleFullscreen}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              title={isFullscreen ? 'Sair do fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setIsPlaying(false)}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              title="Pausar painel"
            >
              <Pause className="w-4 h-4" />
            </button>
            <button
              onClick={onBack}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              title="Voltar para Abastecimento"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── CONTEÚDO DO SLIDE ── */}
      <main className="flex-1 p-6 overflow-hidden">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={`${slideIndex}-${currentSlide.type}-${currentSlide.pageIndex}`}
            initial={{ opacity: 0, x: 60, filter: 'blur(8px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, x: -60, filter: 'blur(8px)', transition: { duration: 0.25 } }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="h-full"
          >
            {currentSlide.type === 'dashboard' && (
              <DashboardSlide kpis={tvData!.kpis} healthStatus={healthStatus} savedAt={tvData!.savedAt} followUpKpis={followUpKpis} />
            )}
            {currentSlide.type === 'rupturas' && (
              <ItemListSlide
                items={currentSlideItems}
                theme="red"
                subtitle={`${tvData!.items.filter(i => i.emFalta).length} itens em ruptura/falta — Risco Assistencial Máximo`}
              />
            )}
            {currentSlide.type === 'cobertura_critica' && (
              <ItemListSlide
                items={currentSlideItems}
                theme="orange"
                subtitle={`${tvData!.items.filter(i => !i.emFalta && i.cobertura < 7 && i.cobertura >= 0).length} itens com cobertura inferior a 7 dias`}
              />
            )}
            {currentSlide.type === 'atrasados' && (
              <ItemListSlide
                items={currentSlideItems}
                theme="amber"
                subtitle={`${tvData!.items.filter(i => i.atrasado && !i.emFalta).length} itens com pedido de compra em atraso`}
              />
            )}
            {currentSlide.type === 'fornecedores' && (
              <SupplierSlide suppliers={tvData!.suppliers} />
            )}
            {currentSlide.type === 'curva_abc' && tvData!.abcSummary && (
              <SlideAbcOficial abcItems={tvData!.abcItems || []} abc={tvData!.abcSummary} />
            )}
            {currentSlide.type === 'followup' && followUpKpis && (
              <FollowUpSlide
                items={followUpKpis.topAtrasados}
                pageIndex={currentSlide.pageIndex}
                totalPages={currentSlide.totalPages}
              />
            )}
            {currentSlide.type === 'consumo' && tvData!.consumos && (
              <SlideConsumoABC consumos={tvData!.consumos} abc={tvData!.abcSummary} />
            )}
            {currentSlide.type === 'estoque_validade' && tvData!.validades && (
              <SlideValidadeEstoque
                validades={tvData!.validades.filter(v => v.diasParaVencer <= 90)}
                kpis={tvData!.kpisValidade}
                pageIndex={currentSlide.pageIndex}
                totalPages={currentSlide.totalPages}
              />
            )}
            {currentSlide.type === 'prescricoes_hora' && (
              <SlidePrescricoesHora />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── BARRA DE PROGRESSO ── */}
      <div className="h-1 bg-slate-800/60 flex-shrink-0 relative overflow-hidden">
        <motion.div
          key={slideIndex}
          className={`absolute top-0 left-0 h-full bg-gradient-to-r ${cfg.progressColor}`}
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: ROTATION_INTERVAL_MS / 1000, ease: 'linear' }}
        />
      </div>
    </div>
  );
}
