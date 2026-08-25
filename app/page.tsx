'use client';

import { useEffect, useState } from 'react';

type Data = {
  symbol: string; months: number; tradingDays: number; bars: number; lastPrice: number; lastDate: string;
  best: { tp: number; reentry: number; cycles: number; returnPct: number; avgDays: number };
  targetFromLast: number; reentryAfterTarget: number; error?: string;
};
const money = (n: number) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

function StockCard({ symbol, months }: { symbol: string; months: number }) {
  const [data, setData] = useState<Data | null>(null); const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    try { const r = await fetch(`/api/backtest?symbol=${symbol}&months=${months}`, { cache: 'no-store' }); setData(await r.json()); }
    catch { setData({ error: 'Veri alınamadı' } as Data); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [symbol, months]);
  if (loading) return <section className="card loading"><div className="pulse" /><div className="pulse short" /></section>;
  if (!data || data.error) return <section className="card"><h2>{symbol}</h2><p className="error">{data?.error || 'Veri alınamadı'}</p><button onClick={load}>Tekrar dene</button></section>;
  return <section className="card">
    <div className="stockHead"><div><span className="ticker">{symbol}</span><span className="date">{data.lastDate} · {data.bars} seans</span></div><div className="price">₺{money(data.lastPrice)}</div></div>
    <div className="signal"><div><span>TP</span><strong>+%{data.best.tp.toFixed(2)}</strong></div><div><span>YENİDEN AL</span><strong>-%{data.best.reentry.toFixed(2)}</strong></div></div>
    <div className="levels"><div><span>Bugünkü fiyattan hedef</span><b>₺{money(data.targetFromLast)}</b></div><div><span>Hedef satış sonrası alış</span><b>₺{money(data.reentryAfterTarget)}</b></div></div>
    <div className="stats"><div><span>Tamamlanan swing</span><b>{data.best.cycles}</b></div><div><span>Backtest getirisi</span><b>%{data.best.returnPct.toFixed(1)}</b></div><div><span>Ort. hedef süresi</span><b>{data.best.avgDays.toFixed(1)} seans</b></div></div>
    <button className="refresh" onClick={load}>↻ Güncelle</button>
  </section>;
}

export default function Home() {
  const [months, setMonths] = useState(3);
  return <main><header><div><p className="eyebrow">BIST · SWING STRATEGY</p><h1>BackTest Stock</h1><p className="sub">Geçmiş fiyat hareketinden dinamik TP ve yeniden alış oranı.</p></div><div className="period"><span>BACKTEST</span><select value={months} onChange={e => setMonths(Number(e.target.value))}><option value={1}>1 ay · ~21 seans</option><option value={2}>2 ay · ~42 seans</option><option value={3}>3 ay · ~63 seans</option><option value={6}>6 ay · ~126 seans</option></select></div></header>
    <div className="grid"><StockCard symbol="ASELS" months={months} /><StockCard symbol="THYAO" months={months} /></div>
    <footer><span>TP / yeniden alış: %1,5–6,0 arası, 0,25 puan tarama.</span><span>Geçmiş performans · yatırım tavsiyesi değildir.</span></footer>
  </main>;
}
