import { useEffect, useState } from 'react';
import { PainelTVAbastecimento } from './components/PainelTVAbastecimento';
import { processCSVToTVData } from './dataParser';

function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await processCSVToTVData();
        localStorage.setItem('abastecimento_tv_data', JSON.stringify(data));
        setLoading(false);
      } catch (err: any) {
        console.error(err);
        setError('Erro ao carregar dados do CSV. Verifique a aba Console e se os arquivos estão na pasta correta.');
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-xl text-slate-300 font-bold animate-pulse">
          Processando dados dos CSVs...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col gap-4 items-center justify-center text-red-400">
        <h2 className="text-2xl font-bold">Erro no processamento</h2>
        <p>{error}</p>
      </div>
    );
  }

  // A tela de TV requer que ocupemos o fullscreen
  return (
    <div className="w-screen h-screen">
      <PainelTVAbastecimento />
    </div>
  );
}

export default App;
