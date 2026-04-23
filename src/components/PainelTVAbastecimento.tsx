import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Tv2, Play, Pause,
  Clock, PackageX, AlertCircle, ShieldCheck, Users,
  TrendingDown, ChevronLeft, ChevronRight, Activity, Monitor,
  ArrowLeft, AlertTriangle, DollarSign, BarChart2, Truck, CalendarClock, PieChart as PieChartIcon,
  Maximize2, Minimize2
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
  valorTotal: number;
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
    valorEmRisco90d: number;
    valorTotalEstoque: number;
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

type SlideType = 'dashboard' | 'rupturas' | 'cobertura_critica' | 'atrasados' | 'fornecedores' | 'curva_abc' | 'followup' | 'consumo' | 'estoque_validade' | 'prescricoes_hora' | 'dash_validade';

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
      color: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-200',
      iconBg: 'bg-red-100',
      glow: kpis.emFalta > 0,
    },
    {
      label: 'Cobertura Crítica',
      value: kpis.coberturaCritica,
      icon: TrendingDown,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      iconBg: 'bg-orange-100',
      glow: kpis.coberturaCritica > 0,
    },
    {
      label: 'Pedidos Atrasados',
      value: kpis.atrasados,
      icon: Clock,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      iconBg: 'bg-purple-100',
      glow: kpis.atrasados > 0,
    },
    {
      label: 'Valor Total',
      value: followUpKpis?.total || kpis.total,
      icon: DollarSign,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      iconBg: 'bg-emerald-100',
      glow: false,
    },
  ];

  const statusConfig = {
    'CRÍTICO': { color: 'text-red-700', bg: 'bg-red-100', border: 'border-red-300', label: 'SITUAÇÃO CRÍTICA' },
    'ALERTA':  { color: 'text-amber-700', bg: 'bg-amber-100', border: 'border-amber-300', label: 'EM ALERTA' },
    'OK':      { color: 'text-emerald-700', bg: 'bg-emerald-100', border: 'border-emerald-300', label: 'OPERANDO EM CONFORMIDADE' },
  };
  const sc = statusConfig[healthStatus];

  return (
    <div className="flex flex-col gap-6 h-full p-2">
      {/* Status global - Estilo Rede Américas */}
      <div className={`flex items-center justify-center gap-4 py-6 rounded-[3rem] border-4 shadow-xl ${sc.bg} ${sc.border}`}>
        {healthStatus === 'OK'
          ? <ShieldCheck className={`w-12 h-12 ${sc.color}`} />
          : <AlertCircle className={`w-12 h-12 ${sc.color} animate-pulse`} />
        }
        <span className={`text-6xl font-black tracking-tighter uppercase ${sc.color}`}>{sc.label}</span>
      </div>

      {/* KPI Cards Principal */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 flex-1">
        {kpiCards.map((card) => (
          <div
            key={card.label}
            className={`bg-white rounded-[2.5rem] border-2 ${card.border} p-8 flex flex-col items-center justify-center gap-6 relative shadow-2xl shadow-slate-200 transition-all`}
          >
            <div className={`p-5 rounded-2xl ${card.iconBg}`}>
               <card.icon className={`w-12 h-12 ${card.color}`} />
            </div>
            <div className="text-center">
              <div className={`text-7xl font-black ${card.color} tracking-tighter`}>
                <AnimatedCount target={card.value} />
              </div>
              <div className="text-slate-500 font-extrabold uppercase text-xs tracking-[0.2em] mt-3 whitespace-nowrap">{card.label}</div>
            </div>
            {card.glow && (
               <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full blur-[60px] opacity-20 ${card.color.replace('text', 'bg')}`} />
            )}
          </div>
        ))}
      </div>

      {/* Métricas complementares - Tema Claro */}
      <div className={`grid gap-4 ${followUpKpis ? 'grid-cols-3 lg:grid-cols-6' : 'grid-cols-3'}`}>
        <div className="bg-white rounded-2xl border-2 border-slate-100 p-4 text-center shadow-sm">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Taxa de Ruptura</div>
          <div className={`text-3xl font-black ${kpis.taxaRuptura > 2 ? 'text-red-500' : 'text-emerald-500'}`}>
            {kpis.taxaRuptura}<span className="text-lg">%</span>
          </div>
          <div className="text-[10px] text-slate-400 font-bold mt-1">Meta: &lt; 2%</div>
        </div>
        <div className="bg-white rounded-2xl border-2 border-slate-100 p-4 text-center shadow-sm">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Conformidade</div>
          <div className="text-3xl font-black text-purple-600">
            {kpis.taxaConformidade}<span className="text-lg">%</span>
          </div>
          <div className="text-[10px] text-slate-400 font-bold mt-1">Estoque Ideal</div>
        </div>
        <div className="bg-white rounded-2xl border-2 border-slate-100 p-4 text-center shadow-sm">
          <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Cobertura Média</div>
          <div className={`text-3xl font-black ${kpis.coberturaMedia < 7 ? 'text-red-400' : kpis.coberturaMedia <= 30 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {kpis.coberturaMedia}<span className="text-lg"> dias</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Meta: 15–30 dias</div>
        </div>
        <div className="bg-white rounded-2xl border-2 border-slate-100 p-4 text-center shadow-sm">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Total de Itens</div>
          <div className="text-3xl font-black text-slate-800">
            {kpis.total}
          </div>
          <div className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-tighter">Última Sincronização</div>
        </div>
        {followUpKpis && (
          <>
            <div className="bg-white rounded-2xl border-2 border-slate-100 p-4 text-center shadow-sm">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">OCs Follow Up</div>
              <div className="text-3xl font-black text-purple-600">{followUpKpis.total}</div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Em Monitoramento</div>
            </div>
            <div className="bg-white rounded-2xl border-2 border-slate-100 p-4 text-center shadow-sm">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">OCs Atrasadas</div>
              <div className={`text-3xl font-black ${followUpKpis.atrasados > 0 ? 'text-red-600 animate-pulse' : 'text-emerald-500'}`}>
                {followUpKpis.atrasados}
              </div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                {followUpKpis.total > 0 ? `${((followUpKpis.atrasados / followUpKpis.total) * 100).toFixed(0)}% atraso` : '—'}
              </div>
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
    red:    { border: 'border-l-red-600',    bg: 'bg-red-50/50',    badge: 'bg-red-50 text-red-600 border-red-100',    cov: 'text-red-600' },
    orange: { border: 'border-l-orange-500', bg: 'bg-orange-50/50', badge: 'bg-orange-50 text-orange-600 border-orange-100', cov: 'text-orange-600' },
    amber:  { border: 'border-l-amber-500',  bg: 'bg-amber-50/50',  badge: 'bg-amber-50 text-amber-600 border-amber-100',  cov: 'text-amber-600' },
  };
  const c = colors[theme];

  const covDisplay = item.emFalta
    ? <span className="text-red-600 font-black text-4xl animate-pulse tracking-tighter">FALTA</span>
    : item.cobertura >= 999
      ? <span className="text-slate-300 text-3xl font-black">—</span>
      : <span className={`${c.cov} font-black text-5xl tracking-tighter`}>{Math.round(item.cobertura)}<span className="text-sm font-bold uppercase ml-1">dias</span></span>;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`relative flex items-stretch bg-white rounded-[1.5rem] border-2 border-slate-50 border-l-[10px] ${c.border} overflow-hidden shadow-xl shadow-slate-100 hover:shadow-2xl transition-all`}
    >
      <div className="flex-1 p-4 relative z-10">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[9px] font-black text-slate-400 bg-slate-50 px-3 py-1 rounded-full uppercase tracking-widest">{item.codItem}</span>
              {item.curvABC && (
                <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${item.curvABC === 'A' ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-500'}`}>CURVA {item.curvABC}</span>
              )}
            </div>
            <p className="text-slate-900 font-black text-lg leading-tight uppercase line-clamp-2">{toTitleCase(item.descItem)}</p>
            <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest mt-1 truncate">{toTitleCase(item.fornec)}</p>
          </div>
          <div className="flex-shrink-0 text-right flex flex-col items-end">
            <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Cobertura</div>
            {covDisplay}
            {item.diasAtraso > 0 && (
              <div className={`text-[9px] font-black mt-1 border-2 rounded-full px-4 py-1 uppercase tracking-widest ${c.badge}`}>
                {item.diasAtraso} dias atraso
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between mt-4 text-[9px] font-black uppercase tracking-widest border-t-2 border-slate-50 pt-4">
          <div className="flex gap-6">
             <div className="flex flex-col">
               <span className="text-slate-400">Estoque</span>
               <span className="text-slate-800 text-base tracking-tighter">{item.estoqDisp} UN</span>
             </div>
             {item.ocNum && (
               <div className="flex flex-col">
                 <span className="text-slate-400">Pedido OC</span>
                 <span className="text-purple-600 text-base tracking-tighter">{item.ocNum}</span>
               </div>
             )}
             {item.ocEntrega && (
               <div className="flex flex-col">
                 <span className="text-slate-400">Previsão</span>
                 <span className="text-emerald-500 text-base tracking-tighter">{item.ocEntrega}</span>
               </div>
             )}
          </div>
          <div className="flex gap-2">
             {item.altoCusto && <span className="text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100">• ALTO CUSTO</span>}
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
    <div className="flex flex-col gap-4 h-full p-2">
      <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1">{subtitle}</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 overflow-hidden">
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
    <div className="flex flex-col gap-4 h-full p-2">
      <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-2">Ranking por Risco Assistencial — Principais Fornecedores</p>
      <div className="flex flex-col gap-3 flex-1 overflow-hidden">
        {sorted.map((sup, idx) => {
          const status = sup.emFalta > 0 ? 'CRÍTICO' : sup.atrasados > 0 ? 'ATENÇÃO' : 'OK';
          const statusClasses = {
            CRÍTICO: 'bg-red-50 border-red-100 text-red-600',
            ATENÇÃO: 'bg-amber-50 border-amber-100 text-amber-600',
            OK:      'bg-emerald-50 border-emerald-100 text-emerald-600',
          };
          const pontColor = sup.pontualidade >= 90 ? 'bg-emerald-500' : sup.pontualidade >= 70 ? 'bg-amber-500' : 'bg-red-500';

          return (
            <motion.div
              key={sup.nome}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05, duration: 0.3 }}
              className="flex items-center gap-6 bg-white rounded-[1.5rem] border-2 border-slate-50 px-6 py-4 shadow-sm hover:shadow-md transition-all"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-black flex-shrink-0 ${idx === 0 ? 'bg-red-600 text-white shadow-lg shadow-red-100' : idx === 1 ? 'bg-amber-500 text-white shadow-lg shadow-amber-100' : 'bg-slate-100 text-slate-400'}`}>
                {idx + 1}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-slate-900 font-black text-base truncate uppercase">{toTitleCase(sup.nome)}</p>
                <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">{sup.total} itens sob monitoramento</p>
              </div>

              <div className="w-48 flex-shrink-0">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pontualidade</span>
                  <span className={`text-xs font-black ${sup.pontualidade >= 70 ? 'text-emerald-600' : 'text-red-600'}`}>{sup.pontualidade.toFixed(0)}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${pontColor} transition-all`} style={{ width: `${sup.pontualidade}%` }} />
                </div>
              </div>

              <div className="flex items-center gap-3">
                {sup.emFalta > 0 && (
                  <div className="bg-red-600 text-white font-black px-4 py-1.5 rounded-full text-[10px] uppercase shadow-lg shadow-red-100">
                    {sup.emFalta} RUPTURA{sup.emFalta > 1 ? 'S' : ''}
                  </div>
                )}
                <div className={`px-4 py-1.5 rounded-full border-2 text-[10px] font-black tracking-[0.1em] ${statusClasses[status]}`}>
                  {status}
                </div>
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
            <div key={c.name} className="bg-white border-2 border-slate-100 rounded-[1.5rem] p-6 flex flex-col justify-between shadow-sm" style={{ borderLeftColor: c.fill, borderLeftWidth: 8 }}>
              <div className="flex justify-between items-center mb-4">
                <span className="text-xl font-black text-slate-800 uppercase">{c.name}</span>
                <span className="text-[10px] font-black px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                  {pctVal}% DO VALOR TOTAL
                </span>
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Custo Acumulado</p>
                  <p className="text-3xl font-black" style={{ color: c.fill }}>
                    R$ {c.value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-4xl font-black text-slate-800 tracking-tighter">{c.count}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">{pctCount}% ITENS</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-4 flex-1 min-h-0 mt-2">
        {/* Gráfico Rosca */}
        <div className="w-[30%] bg-white border-2 border-slate-100 rounded-[2.5rem] p-8 flex flex-col items-center shadow-2xl shadow-slate-200/50">
          <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Distribuição Financeira</p>
          <div className="flex-1 w-full min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={8} dataKey="value" stroke="none">
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(val: any) => `R$ ${Number(val || 0).toLocaleString('pt-BR')}`}
                  contentStyle={{ backgroundColor: '#fff', border: 'none', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lista Top A */}
        <div className="w-[70%] bg-white border-2 border-slate-100 rounded-[2.5rem] p-8 flex flex-col shadow-2xl shadow-slate-200/50">
          <p className="text-xs font-black text-red-500 uppercase tracking-[0.2em] mb-6 flex items-center justify-between">
            <span>Principais Ofensores - Classe A</span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Top 5 itens representam maior custo</span>
          </p>
          
          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            {topA.map((item, idx) => (
              <div key={item.cod} className="bg-slate-50/50 border border-slate-100 rounded-[1.5rem] flex justify-between p-5 transition-all hover:bg-white hover:shadow-md">
                <div className="flex items-center gap-4 overflow-hidden">
                  <div className="bg-red-600 text-white font-black text-xl w-12 h-12 rounded-2xl flex justify-center items-center flex-shrink-0 shadow-lg shadow-red-100">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-900 font-extrabold text-base truncate uppercase">{toTitleCase(item.produto)}</p>
                    <p className="text-[10px] text-slate-400 font-black mt-1 uppercase tracking-widest">
                      Cód: {item.cod} | {item.qtdConsumo} un consumidas
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 flex flex-col justify-center">
                  <p className="text-3xl font-black text-slate-800 tracking-tighter">R$ {item.vlCustoPeriodo.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{item.percAcum.toFixed(1)}% DO ACUMULADO</p>
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
    <div className="flex flex-col gap-6 h-full p-2">
      {/* KPIs no topo */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white border-2 border-purple-100 rounded-[2rem] p-8 shadow-xl shadow-purple-50">
          <p className="text-[10px] text-purple-400 font-bold uppercase tracking-widest mb-2">Total Prescrições (24h)</p>
          <p className="text-6xl font-black text-purple-600 tracking-tighter">{total}</p>
        </div>
        <div className="bg-white border-2 border-emerald-100 rounded-[2rem] p-8 shadow-xl shadow-emerald-50">
          <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest mb-2">Horário de Pico</p>
          <div className="flex items-end gap-2">
            <p className="text-6xl font-black text-emerald-600 tracking-tighter">11:00</p>
            <p className="text-xl font-bold text-emerald-400 mb-2">{peak} presc.</p>
          </div>
        </div>
        <div className="bg-white border-2 border-slate-100 rounded-[2rem] p-8 shadow-xl shadow-slate-50">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2">Média Hospitalar</p>
          <p className="text-6xl font-black text-slate-800 tracking-tighter">{(total / 24).toFixed(1)}</p>
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
    <div className="flex flex-col gap-4 h-full p-2">
      <div className="flex justify-between items-center mb-2">
        <p className="text-red-600 text-xs font-black uppercase tracking-[0.2em]">
          {items.length} Ordens de Compra em Atraso — Acompanhamento Follow Up
        </p>
        {totalPages > 1 && <span className="bg-slate-100 text-slate-500 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Pág. {pageIndex + 1}/{totalPages}</span>}
      </div>
      <div className="flex flex-col gap-3 flex-1 overflow-hidden">
        {page.map((item, idx) => {
          const isCritical = item.delayDays > 7;
          return (
            <motion.div
              key={`${item.ocNumber}-${item.itemCode}-${idx}`}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.3, delay: idx * 0.04, ease: 'easeOut' }}
              className={`flex items-center gap-6 bg-white rounded-[1.5rem] border-2 px-6 py-4 shadow-sm hover:shadow-md transition-all ${
                isCritical ? 'border-red-100' : 'border-amber-100'
              }`}
            >
              <div className={`flex-shrink-0 w-20 text-center flex flex-col items-center justify-center`}>
                <div className={`text-4xl font-black tracking-tighter ${isCritical ? 'text-red-600 animate-pulse' : 'text-amber-500'}`}>{item.delayDays}</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dias</div>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-slate-900 font-black text-base truncate uppercase">{item.itemName}</p>
                <div className="flex gap-4 mt-1">
                   <p className="text-purple-600 text-[10px] font-black uppercase tracking-widest">OC {item.ocNumber}</p>
                   <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest truncate max-w-[200px]">Fornecedor: {item.supplier}</p>
                </div>
              </div>

              <div className="flex-shrink-0 text-right px-6 border-l-2 border-slate-50">
                <div className="text-slate-800 text-2xl font-black tracking-tighter">{item.pendingQty}</div>
                <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Pendentes</div>
              </div>

              {item.deliveryDate && (
                <div className="flex-shrink-0 text-right px-6 border-l-2 border-slate-50">
                  <div className="text-slate-800 text-lg font-black tracking-tighter">{item.deliveryDate}</div>
                  <div className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">Previsão</div>
                </div>
              )}

              <div className={`flex-shrink-0 px-4 py-1.5 rounded-full border-2 text-[10px] font-black tracking-widest ${
                isCritical ? 'bg-red-50 border-red-100 text-red-600' : 'bg-amber-50 border-amber-100 text-amber-600'
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

// ── Sub-componente: Dashboard de Validade ──────────────────────────────────

function SlideDashValidade({ validades, kpis }: { validades: TVValidadeItem[], kpis: any }) {
  // 1. Agrupar Risco Financeiro por Estoque
  const estoqueRiskData = useMemo(() => {
    const map = new Map<string, number>();
    validades.forEach(v => {
      // Consideramos risco tudo que vence em < 120 dias
      if (v.diasParaVencer <= 120 && v.diasParaVencer >= 0) {
        map.set(v.estoqueNum, (map.get(v.estoqueNum) || 0) + v.valorTotal);
      }
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name: `Est. ${name}`, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [validades]);

  // 2. Top 5 Itens Ofensores (Valor em Risco)
  const topExpiringItems = useMemo(() => {
    return [...validades]
      .filter(v => v.diasParaVencer <= 120 && v.diasParaVencer >= 0)
      .sort((a, b) => b.valorTotal - a.valorTotal)
      .slice(0, 5);
  }, [validades]);

  return (
    <div className="flex flex-col gap-6 h-full p-2">
      {/* ── SEÇÃO SUPERIOR: KPIs FINANCEIROS ── */}
      <div className="grid grid-cols-4 gap-6">
        <div className="bg-white border-2 border-red-100 rounded-[2rem] p-8 shadow-xl shadow-red-50">
           <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-3">Valor em Risco (90 dias)</p>
           <p className="text-5xl font-black text-red-600 tracking-tighter">
             R$ {kpis.valorEmRisco90d.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
           </p>
           <div className="mt-4 h-2 w-full bg-slate-100 rounded-full overflow-hidden">
             <div 
               className="h-full bg-red-500" 
               style={{ width: `${(kpis.valorEmRisco90d / kpis.valorTotalEstoque * 100) || 0}%` }} 
             />
           </div>
        </div>
        <div className="bg-white border-2 border-purple-100 rounded-[2rem] p-8 shadow-xl shadow-purple-50">
           <p className="text-[10px] font-black text-purple-500 uppercase tracking-widest mb-3">Valor Total Monitorado</p>
           <p className="text-5xl font-black text-purple-600 tracking-tighter">
             R$ {kpis.valorTotalEstoque.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
           </p>
        </div>
        <div className="bg-white border-2 border-slate-100 rounded-[2rem] p-8 shadow-xl shadow-slate-50">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Lotes Analisados</p>
           <p className="text-5xl font-black text-slate-800 tracking-tighter">{kpis.totalLotes}</p>
        </div>
        <div className="bg-white border-2 border-emerald-100 rounded-[2rem] p-8 shadow-xl shadow-emerald-50">
           <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-3">Estoque Crítico</p>
           <p className="text-5xl font-black text-emerald-600 tracking-tighter">{estoqueRiskData[0]?.name?.split(' ')[1] || 'N/A'}</p>
        </div>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        {/* ── COLUNA ESQUERDA: RANKING DE ESTOQUES ── */}
        <div className="w-[40%] bg-white border-2 border-slate-50 rounded-[2.5rem] p-8 flex flex-col shadow-2xl shadow-slate-100">
          <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-purple-500" />
            Risco por Localização
          </p>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={estoqueRiskData} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={14} fontWeight="black" axisLine={false} tickLine={false} />
                <Tooltip 
                  formatter={(val: any) => `R$ ${Number(val).toLocaleString('pt-BR')}`}
                  contentStyle={{ backgroundColor: '#fff', border: '2px solid #f1f5f9', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" fill="#7c3aed" radius={[0, 10, 10, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── COLUNA DIREITA: TOP ITENS EM RISCO ── */}
        <div className="flex-1 bg-white border-2 border-slate-50 rounded-[2.5rem] p-8 flex flex-col shadow-2xl shadow-slate-100">
          <p className="text-xs font-black text-red-500 uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            Top 5 Lotes (Perda Potencial)
          </p>
          <div className="flex flex-col gap-4 flex-1">
            {topExpiringItems.map((item, idx) => (
              <div key={`${item.produto}-${idx}`} className="bg-slate-50/50 border border-slate-100 rounded-[1.5rem] p-5 flex justify-between items-center transition-all hover:bg-white hover:shadow-md">
                <div className="flex items-center gap-5 min-w-0">
                  <div className="bg-red-600 text-white font-black text-xl w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-red-100">
                    {idx + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="text-slate-900 font-extrabold text-base truncate uppercase">{toTitleCase(item.produto)}</p>
                    <div className="flex gap-4 text-[10px] text-slate-400 mt-1 uppercase font-black tracking-widest">
                      <span className="text-red-500">Expira: {item.validadeStr}</span>
                      <span>Lote: {item.lote}</span>
                      <span className="text-purple-600">Estoq: {item.estoqueNome} ({item.estoqueNum})</span>
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-4">
                  <p className="text-3xl font-black text-slate-800 tracking-tighter">
                    R$ {item.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{item.quantidade} UNIDADES</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-componente: Consumo Financeiro ──────────────────────────────────────

function SlideConsumoABC({ consumos, abc }: { consumos: TVConsumoItem[], abc?: ABCSummary }) {
  const top10 = consumos.slice(0, 10);
  const totalValor = consumos.reduce((s, c) => s + c.vlCustoPeriodo, 0);
  const totalPecas = consumos.reduce((s, c) => s + c.qtdConsumo, 0);
  
  const pieColors = ['#7c3aed', '#f59e0b', '#64748b'];
  const pieData = abc ? [
    { name: 'Classe A', value: abc.valA || 0 },
    { name: 'Classe B', value: abc.valB || 0 },
    { name: 'Classe C', value: abc.valC || 0 }
  ] : [];

  return (
    <div className="flex flex-col gap-6 h-full p-2">
      {/* KPIs Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Custo Total Período', val: `R$ ${totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, color: 'text-purple-600', bg: 'border-purple-100 shadow-purple-50' },
          { label: 'Itens Distintos', val: consumos.length, color: 'text-indigo-600', bg: 'border-indigo-100 shadow-indigo-50' },
          { label: 'Peças Consumidas', val: totalPecas.toLocaleString('pt-BR'), color: 'text-emerald-600', bg: 'border-emerald-100 shadow-emerald-50' },
          { label: 'Custo Médio/Item', val: `R$ ${consumos.length > 0 ? (totalValor / consumos.length).toFixed(0) : '0'}`, color: 'text-amber-600', bg: 'border-amber-100 shadow-amber-50' },
          { label: 'Ticket Médio/Peça', val: `R$ ${totalPecas > 0 ? (totalValor / totalPecas).toFixed(2) : '0'}`, color: 'text-rose-600', bg: 'border-rose-100 shadow-rose-50' }
        ].map(k => (
          <div key={k.label} className={`bg-white border-2 rounded-[1.5rem] p-6 text-center shadow-xl ${k.bg}`}>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">{k.label}</p>
            <p className={`text-3xl font-black ${k.color} tracking-tighter`}>{k.val}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="flex gap-6 flex-1 min-h-0">
        <div className="flex-1 flex flex-col gap-4 bg-white border-2 border-slate-50 rounded-[2.5rem] p-8 shadow-2xl shadow-slate-100">
          <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Top 10 Maior Custo do Período</p>
          <div className="flex-1 min-h-0 p-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top10} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="produto" type="category" width={320} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                <Tooltip 
                   formatter={(val: any) => `R$ ${Number(val || 0).toLocaleString('pt-BR')}`}
                   contentStyle={{ backgroundColor: '#fff', border: 'none', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="vlCustoPeriodo" fill="#7c3aed" radius={[0, 10, 10, 0]}>
                  {top10.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={index < 3 ? '#ef4444' : '#7c3aed'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        {abc && (abc.A + abc.B + abc.C) > 0 && (
          <div className="w-[350px] flex flex-col bg-white border-2 border-slate-50 p-8 rounded-[2.5rem] shadow-2xl shadow-slate-100">
             <p className="text-slate-400 text-xs font-black text-center mb-8 uppercase tracking-[0.2em]">Distribuição Curva ABC</p>
             <div className="flex-1 w-full min-h-[250px]">
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                   <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={8} dataKey="value" stroke="none">
                     {pieData.map((_, index) => (
                       <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                     ))}
                   </Pie>
                   <Tooltip formatter={(val: any) => `R$ ${Number(val || 0).toLocaleString('pt-BR')}`} contentStyle={{ backgroundColor: '#fff', border: 'none', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                   <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ paddingTop: '20px', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }} />
                 </PieChart>
               </ResponsiveContainer>
             </div>
             <div className="grid grid-cols-3 gap-3 mt-6 border-t-2 border-slate-50 pt-6">
               <div className="text-center"><span className="text-red-500 font-black text-2xl tracking-tighter">{abc.A}</span><br/><span className="text-[10px] font-black text-slate-400 uppercase">Itens A</span></div>
               <div className="text-center"><span className="text-amber-500 font-black text-2xl tracking-tighter">{abc.B}</span><br/><span className="text-[10px] font-black text-slate-400 uppercase">Itens B</span></div>
               <div className="text-center"><span className="text-slate-900 font-black text-2xl tracking-tighter">{abc.C}</span><br/><span className="text-[10px] font-black text-slate-400 uppercase">Itens C</span></div>
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
    <div className="flex flex-col gap-6 h-full p-2">
      {/* KPIs Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Lotes em Análise', val: kpis?.totalLotes || 0, color: 'text-slate-900', bg: 'border-slate-100 shadow-slate-50' },
          { label: 'Vencendo em 30 Dias', val: kpis?.itensVencendo30d || 0, color: 'text-red-600', bg: 'border-red-100 shadow-red-50' },
          { label: 'Vencendo em 90 Dias', val: kpis?.itensVencendo90d || 0, color: 'text-amber-500', bg: 'border-amber-100 shadow-amber-50' },
          { label: 'Total Itens Est.', val: kpis?.totalProdutosEstoque || 0, color: 'text-emerald-600', bg: 'border-emerald-100 shadow-emerald-50' }
        ].map(k => (
          <div key={k.label} className={`bg-white border-2 rounded-[2rem] p-8 text-center shadow-2xl ${k.bg}`}>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">{k.label}</p>
            <p className={`text-4xl font-black ${k.color} tracking-tighter`}>{k.val}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 overflow-hidden">
        {page.map((item, idx) => (
          <motion.div
            key={`${item.produto}-${idx}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.05 }}
            className={`bg-white border-2 border-slate-50 rounded-[2.5rem] p-8 flex items-center gap-8 shadow-2xl shadow-slate-200/50 transition-all hover:scale-[1.02]`}
          >
            {/* Countdown Badge */}
            <div className={`w-24 h-24 rounded-[2rem] flex flex-col items-center justify-center p-4 shadow-xl ${item.diasParaVencer <= 30 ? 'bg-red-600 shadow-red-100' : item.diasParaVencer <= 90 ? 'bg-amber-500 shadow-amber-100' : 'bg-emerald-500 shadow-emerald-100'}`}>
               <span className="text-4xl font-black text-white leading-none tracking-tighter">{item.diasParaVencer}</span>
               <span className="text-[10px] font-black text-white/80 uppercase mt-1">Dias</span>
            </div>

            <div className="flex-1 min-w-0">
               <p className="text-slate-900 font-black text-xl leading-tight uppercase truncate">{toTitleCase(item.produto)}</p>
               <div className="flex flex-wrap gap-4 mt-3">
                  <div className="bg-slate-50 px-4 py-2 rounded-xl flex flex-col">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Lote</span>
                    <span className="text-slate-700 font-black text-sm">{item.lote}</span>
                  </div>
                  <div className="bg-slate-50 px-4 py-2 rounded-xl flex flex-col">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Validade</span>
                    <span className="text-slate-700 font-black text-sm">{item.validadeStr}</span>
                  </div>
                  <div className="bg-purple-50 px-4 py-2 rounded-xl flex flex-col border border-purple-100">
                    <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest">Almoxarifado</span>
                    <span className="text-purple-600 font-black text-sm uppercase">{item.estoqueNome || 'ALMOXARIFADO'} ({item.estoqueNum})</span>
                  </div>
               </div>
            </div>

            <div className="text-right flex flex-col items-end gap-2 pr-4 border-l-2 border-slate-50 pl-8">
               <div className="flex flex-col">
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Qtd Est.</span>
                 <span className="text-3xl font-black text-slate-800 tracking-tighter">{item.quantidade}</span>
               </div>
               <div className="bg-slate-900 text-white font-black px-4 py-2 rounded-xl text-sm shadow-xl shadow-slate-200">
                  R$ {item.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
               </div>
            </div>
          </motion.div>
        ))}
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
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handleFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFs);
    return () => document.removeEventListener('fullscreenchange', handleFs);
  }, []);
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

    // Slide Validade Estoque (REATIVADO)
    if (tvData.validades && tvData.validades.length > 0) {
      // Lista de itens
      const expiring = tvData.validades.filter(v => v.diasParaVencer <= 120).slice(0, 30);
      if (expiring.length > 0) {
        const pages = Math.ceil(expiring.length / ITEMS_PER_SLIDE);
        for (let p = 0; p < pages; p++) result.push({ type: 'estoque_validade', pageIndex: p, totalPages: pages });
      }
      // Dashboard Gráfico
      result.push({ type: 'dash_validade', pageIndex: 0, totalPages: 1 });
    }

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
      dash_validade: {
        title: 'DASHBOARD — CONTROLE DE VALIDADES',
        icon: CalendarClock,
        iconColor: 'text-amber-400',
        iconPulse: true,
        progressColor: 'from-amber-600 to-red-400',
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
      <div ref={containerRef} className="min-h-screen bg-[#f8fafc] flex items-center justify-center font-sans">
        <div className="max-w-md w-full mx-auto p-8 text-center bg-white rounded-[2rem] shadow-xl border border-slate-100">
          <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Tv2 className="w-10 h-10 text-slate-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Nenhum dado disponível</h2>
          <p className="text-slate-500 text-sm mb-6 leading-relaxed">
            Para usar o Painel TV, acesse primeiro a aba{' '}
            <strong className="text-purple-600">Visão de Abastecimento</strong> e importe
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
      { label: 'rupturas', value: tvData.kpis.emFalta, color: 'bg-red-50 border-red-100 text-red-600' },
      { label: 'cob. crítica', value: tvData.kpis.coberturaCritica, color: 'bg-orange-50 border-orange-100 text-orange-600' },
      { label: 'atrasados', value: tvData.kpis.atrasados, color: 'bg-amber-50 border-amber-100 text-amber-600' },
      { label: 'total itens', value: tvData.kpis.total, color: 'bg-purple-50 border-purple-100 text-purple-600' },
      ...(followUpKpis ? [{ label: 'OCs atrasadas', value: followUpKpis.atrasados, color: 'bg-red-50 border-red-100 text-red-600' }] : []),
    ];

    return (
      <div ref={containerRef} className="fixed inset-0 z-50 bg-[#f8fafc] flex items-center justify-center font-sans p-4">
        <button 
          onClick={toggleFullscreen} 
          className="absolute top-8 right-8 p-4 rounded-2xl bg-white shadow-xl border border-slate-100 text-slate-400 hover:text-purple-600 transition-all z-10"
        >
          {isFullscreen ? <Minimize2 className="w-8 h-8" /> : <Maximize2 className="w-8 h-8" />}
        </button>
        <div className="w-full h-full bg-white rounded-[3rem] shadow-2xl border-2 border-purple-100 p-24 text-center relative overflow-hidden flex flex-col items-center justify-center">
          {/* Decorações Américas */}
          <div className="absolute top-0 left-0 w-48 h-48 bg-purple-600/5 rounded-br-[100%] transition-all" />
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-tl-[100%] transition-all" />
          
          <div className="bg-gradient-to-br from-purple-600 to-indigo-700 w-28 h-28 rounded-[2rem] flex items-center justify-center mx-auto mb-10 shadow-2xl shadow-purple-200">
            <Tv2 className="w-14 h-14 text-white" />
          </div>
          
          <h1 className="text-6xl font-black text-slate-900 mb-4 tracking-tighter">Portal de Abastecimento</h1>
          <p className="text-2xl font-black text-purple-600 mb-2 uppercase tracking-[0.3em]">Rede Américas</p>
          <div className="h-2 w-32 bg-gradient-to-r from-purple-600 to-emerald-500 mx-auto mb-12 rounded-full" />
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 mb-16 w-full max-w-7xl">
            {alertBadges.slice(0, 4).map(b => (
              <div key={b.label} className={`rounded-[3rem] border-2 p-12 flex flex-col items-center justify-center transition-all hover:scale-105 shadow-sm ${b.color}`}>
                <div className="text-8xl font-black tracking-tighter mb-4">{b.value}</div>
                <div className="text-sm font-black uppercase tracking-[0.3em] opacity-80">{b.label}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-6 w-full max-w-2xl">
            <button
              onClick={handleStart}
              className="group relative w-full inline-flex items-center justify-center gap-6 bg-slate-900 hover:bg-black text-white font-black text-3xl py-10 rounded-[3rem] shadow-2xl transition-all active:scale-95"
            >
              <Play className="w-10 h-10 fill-current text-emerald-400 group-hover:scale-110 transition-transform" /> 
              INICIAR MONITORAMENTO
            </button>
            
            <button
              onClick={onBack}
              className="mt-6 text-slate-400 hover:text-purple-600 font-bold text-sm flex items-center gap-2 mx-auto transition-all"
            >
              <ArrowLeft className="w-5 h-5" /> Retornar à Tela Principal
            </button>
          </div>

          <p className="mt-12 text-slate-300 text-[10px] font-bold uppercase tracking-widest">
            Última Sincronização: {savedDate}
          </p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STATE 3: Tudo OK (apenas dashboard + fornecedores, sem alertas)
  // ─────────────────────────────────────────────────────────────────────────

  if (isPlaying && healthStatus === 'OK' && slides.length <= 2) {
    return (
      <div ref={containerRef} className="min-h-screen w-full bg-[#f8fafc] flex flex-col items-center justify-center font-sans gap-12 p-24 text-center relative overflow-hidden">
        <button 
          onClick={toggleFullscreen} 
          className="absolute top-8 right-8 p-4 rounded-2xl bg-white shadow-xl border border-slate-100 text-slate-400 hover:text-purple-600 transition-all"
        >
          {isFullscreen ? <Minimize2 className="w-6 h-6" /> : <Maximize2 className="w-6 h-6" />}
        </button>
        <div className="bg-emerald-50 p-16 rounded-[4rem] border-4 border-emerald-500 shadow-2xl shadow-emerald-100 animate-bounce">
           <ShieldCheck className="w-32 h-32 text-emerald-600 animate-pulse" />
        </div>
        <div>
          <h2 className="text-6xl font-black text-slate-900 tracking-tighter mb-4">Estoque em Conformidade</h2>
          <p className="text-3xl font-black text-emerald-600 uppercase tracking-[0.2em]">Sem Alertas Críticos</p>
        </div>
        <p className="text-slate-500 text-lg max-w-xl">
          Todos os {tvData.kpis.total} itens analisados estão dentro dos parâmetros de segurança. 
          Cobertura média do hospital: <span className="font-black text-slate-900">{tvData.kpis.coberturaMedia} dias</span>.
        </p>
        <button
          onClick={() => setIsPlaying(false)}
          className="mt-8 flex items-center gap-3 text-slate-400 hover:text-purple-600 border-2 border-slate-200 hover:border-purple-200 px-8 py-4 rounded-2xl transition-all font-bold"
        >
          <Pause className="w-6 h-6" /> Pausar Monitoramento
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
    CRÍTICO: 'bg-red-50 border-red-200 text-red-600 shadow-red-100',
    ALERTA:  'bg-amber-50 border-amber-200 text-amber-600 shadow-amber-100',
    OK:      'bg-emerald-50 border-emerald-200 text-emerald-600 shadow-emerald-100',
  };

  return (
    <div
      ref={containerRef}
      className="h-screen w-screen bg-[#f3f4f6] flex flex-col font-sans select-none text-slate-900 overflow-hidden"
    >
      {/* ── HEADER LIGHT ── */}
      <header className="bg-white border-b-2 border-purple-100 px-6 py-3 flex-shrink-0 shadow-sm relative z-10">
        {/* Linha superior: info geral */}
        <div className="flex items-center justify-between mb-3 text-slate-400 font-bold uppercase tracking-widest text-[9px]">
          <div className="flex items-center gap-2">
            <Monitor className="w-3.5 h-3.5 text-purple-500" />
            <span>Rede Américas · Inteligência de Abastecimento</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
            <Clock className="w-4 h-4 text-purple-600" />
            <span className="text-slate-600 tabular-nums">{currentTime.toLocaleTimeString('pt-BR')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span>SLIDE {slideIndex + 1} / {slides.length}</span>
          </div>
        </div>

        {/* Linha principal */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`p-4 rounded-[1.25rem] bg-gradient-to-br ${cfg.progressColor} shadow-lg shadow-purple-100 ${cfg.iconPulse ? 'animate-pulse' : ''}`}>
              <cfg.icon className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-slate-900 font-black text-2xl tracking-tighter leading-none uppercase">{cfg.title}</h2>
              {currentSlide.totalPages > 1 && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="h-1.5 w-24 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-600 transition-all duration-1000" style={{ width: `${((currentSlide.pageIndex + 1) / currentSlide.totalPages) * 100}%` }} />
                  </div>
                  <p className="text-slate-400 text-[10px] font-black uppercase">
                    Página {currentSlide.pageIndex + 1} de {currentSlide.totalPages}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className={`px-6 py-2.5 rounded-2xl border-2 text-xs font-black tracking-widest flex items-center gap-2 shadow-sm ${statusBadgeColors[healthStatus]}`}>
            {healthStatus === 'OK' ? <ShieldCheck className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {healthStatus}
          </div>

          <div className="flex items-center gap-3">
             <button title="Tela Cheia" onClick={toggleFullscreen} className="p-3 rounded-xl bg-slate-50 text-slate-400 hover:text-purple-600 border border-slate-100 transition-all shadow-sm">
                {isFullscreen ? <Minimize2 className="w-6 h-6" /> : <Maximize2 className="w-6 h-6" />}
             </button>
             <button onClick={() => setSlideIndex(prev => (prev - 1 + slides.length) % slides.length)} className="p-3 rounded-xl bg-slate-50 text-slate-400 hover:text-purple-600 border border-slate-100 transition-all shadow-sm"><ChevronLeft className="w-6 h-6" /></button>
             <button title={isPlaying ? "Pausar" : "Iniciar"} onClick={() => setIsPlaying(!isPlaying)} className="w-14 h-14 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-xl shadow-purple-100">{isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}</button>
             <button onClick={() => setSlideIndex(prev => (prev + 1) % slides.length)} className="p-3 rounded-xl bg-slate-50 text-slate-400 hover:text-purple-600 border border-slate-100 transition-all shadow-sm"><ChevronRight className="w-6 h-6" /></button>
          </div>
        </div>
      </header>

      {/* ── CONTEÚDO DO SLIDE ── */}
      <main className="flex-1 px-4 pb-4 pt-2 overflow-hidden flex flex-col">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={`${slideIndex}-${currentSlide.type}-${currentSlide.pageIndex}`}
            initial={{ opacity: 0, scale: 0.98, filter: 'blur(8px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 1.02, filter: 'blur(8px)', transition: { duration: 0.2 } }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="flex-1 w-full"
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
            {currentSlide.type === 'dash_validade' && tvData!.validades && (
              <SlideDashValidade validades={tvData!.validades} kpis={tvData!.kpisValidade} />
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
