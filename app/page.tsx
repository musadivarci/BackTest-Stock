'use client';

import { useEffect, useState } from 'react';

type Data = {
  symbol: string; days: number; bars: number; lastPrice: number; lastDate: string;
  best: { tp: number; reentry: number; cycles: number; returnPct: number; avgDays: number };
  targetFromLast: number; reentryAfterTarget: number; error?: string;
};

const money = (n: number) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

function StockCard({ symbol, days }: { symbol: string; days: number }) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/backtest?symbol=${symbol}&days=${days}`, { cache: 'no-store' });
      const j = await r.json();
      setData(j);
    } catch { setData({ error: 'Veri alınamadı' } as Data); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [symbol, days]);

  if (loading) return <section className="card loading"><div className="pulse" /><div className="pulse short" /></section>;
  if (!data || data.error) return <section className="card"><h2>{symbol}</h2><p className="error">{data?.error || 'Veri alınamadı'}</p><button onClick={load}>Tekrar dene</button></section>;

  return (
    <section className="card">
      <div className="stockHead">
        <div><span className="ticker">{symbol}</span><span className="date">{data.lastDate}</span></div>
        <div className="price">₺{money(data.lastPrice)}</div>
      </div>
      <div className="signal">
        <div><span>TP</span><strong>+%{data.best.tp.toFixed(2)}</strong></div>
        <div><span>YENİDEN AL</span><strong>-%{data.best.reentry.toFixed(2)}</strong></div>
      </div>
      <div className="levels">
        <div><span>Bugünkü fiyattan hedef</span><b>₺{money(data.targetFromLast)}</b></div>
        <div><span>Hedef satış sonrası alış</span><b>₺{money(data.reentryAfterTarget)}</b></div>
      </div>
      <div className="stats">
        <div><span>Tamamlanan swing</span><b>{data.best.cycles}</b></div>
        <div><span>Backtest getirisi</span><b>%{data.best.returnPct.toFixed(1)}</b></div>
        <div><span>Ort. hedef süresi</span><b>{data.best.avgDays.toFixed(1)} gün</b></div>
      </div>
      <button className="refresh" onClick={load}>↻ Güncelle</button>
    </section>
  );
}

export default function Home() {
  const [days, setDays] = useState(90);
  return (
    <main>
      <header>
        <div><p className="eyebrow">BIST · SWING STRATEGY</p><h1>BackTest Stock</h1><p className="sub">Geçmiş fiyat hareketinden dinamik TP ve yeniden alış oranı.</p></div>
        <div className="period"><span>BACKTEST</span><select value={days} onChange={e => setDays(Number(e.target.value))}><option value={60}>60 gün</option><option value={90}>90 gün</option><option value={120}>120 gün</option><option value={180}>180 gün</option></select></div>
      </header>
      <div className="grid"><StockCard symbol="ASELS" days={days} /><StockCard symbol="THYAO" days={days} /></div>
      <footer><span>0,25 puan aralıklarla TP / yeniden alış kombinasyonları taranır.</span><span>Yatırım tavsiyesi değildir.</span></footer>
    </main>
  );
}
