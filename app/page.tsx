'use client';

import { FormEvent, useEffect, useState } from 'react';

type Data = {
  symbol: string; months: number; tradingDays: number; bars: number; lastPrice: number; lastDate: string;
  best: { tp: number; reentry: number; cycles: number; returnPct: number; avgDays: number };
  technical: { label: string; score: number; rsi14: number; macd: number; macdSignal: number; sma20: number; sma50: number; ema20: number };
  targetFromLast: number; reentryAfterTarget: number; error?: string;
};

const money = (n: number) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const pct = (n: number) => `${n >= 0 ? '+' : ''}%${n.toFixed(2)}`;

function StockCard({ symbol, months }: { symbol: string; months: number }) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [entryPrice, setEntryPrice] = useState<number | null>(null);
  const [entryInput, setEntryInput] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/backtest?symbol=${symbol}&months=${months}`, { cache: 'no-store' });
      setData(await r.json());
    } catch {
      setData({ error: 'Veri alınamadı' } as Data);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [symbol, months]);
  useEffect(() => {
    const saved = window.localStorage.getItem(`position-entry-${symbol}`);
    const n = saved ? Number(saved) : NaN;
    if (Number.isFinite(n) && n > 0) { setEntryPrice(n); setEntryInput(String(n)); }
  }, [symbol]);

  const saveEntry = (e: FormEvent) => {
    e.preventDefault();
    const n = Number(entryInput.replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) return;
    setEntryPrice(n);
    window.localStorage.setItem(`position-entry-${symbol}`, String(n));
  };

  const clearEntry = () => {
    setEntryPrice(null); setEntryInput('');
    window.localStorage.removeItem(`position-entry-${symbol}`);
  };

  if (loading) return <section className="card loading"><div className="pulse" /><div className="pulse short" /></section>;
  if (!data || data.error) return <section className="card"><h2>{symbol}</h2><p className="error">{data?.error || 'Veri alınamadı'}</p><button onClick={load}>Tekrar dene</button></section>;

  const positionReturn = entryPrice ? (data.lastPrice / entryPrice - 1) * 100 : 0;
  const positionTarget = entryPrice ? entryPrice * (1 + data.best.tp / 100) : 0;
  const remaining = entryPrice ? (positionTarget / data.lastPrice - 1) * 100 : 0;
  const progress = entryPrice ? Math.max(0, Math.min(100, (positionReturn / data.best.tp) * 100)) : 0;
  const reached = entryPrice ? data.lastPrice >= positionTarget : false;

  return <section className="card">
    <div className="stockHead"><div><span className="ticker">{symbol}</span><span className="date">{data.lastDate} · {data.bars} seans</span></div><div className="price">₺{money(data.lastPrice)}</div></div>

    <div className="positionBox">
      <div className="positionTitle"><span>POZİSYONUM</span>{entryPrice && <button type="button" className="miniBtn" onClick={clearEntry}>Sıfırla</button>}</div>
      {!entryPrice ? <form className="entryForm" onSubmit={saveEntry}>
        <label htmlFor={`entry-${symbol}`}>Alış fiyatı</label>
        <div><input id={`entry-${symbol}`} inputMode="decimal" placeholder="Örn. 400,00" value={entryInput} onChange={e => setEntryInput(e.target.value)} /><button type="submit">Kaydet</button></div>
      </form> : <>
        <div className="positionNumbers">
          <div><span>Getiri</span><strong className={positionReturn >= 0 ? 'positive' : 'negative'}>{pct(positionReturn)}</strong></div>
          <div><span>TP fiyatı</span><strong>₺{money(positionTarget)}</strong></div>
          <div><span>{reached ? 'Durum' : 'TP’ye kalan'}</span><strong className={reached ? 'hit' : ''}>{reached ? 'HEDEFE ULAŞTI' : `%${Math.max(0, remaining).toFixed(2)}`}</strong></div>
        </div>
        <div className="progress"><i style={{ width: `${progress}%` }} /></div>
        <small>Alış ₺{money(entryPrice)} · Backtest TP +%{data.best.tp.toFixed(2)}</small>
      </>}
    </div>

    <div className="tech"><span>TEKNİK GÖRÜNÜM</span><strong>{data.technical.label}</strong><small>RSI {data.technical.rsi14.toFixed(1)} · MACD {data.technical.macd > data.technical.macdSignal ? 'pozitif' : 'negatif'}</small></div>
    <div className="signal"><div><span>TP</span><strong>+%{data.best.tp.toFixed(2)}</strong></div><div><span>YENİDEN AL</span><strong>-%{data.best.reentry.toFixed(2)}</strong></div></div>
    <div className="levels"><div><span>Bugünkü fiyattan hedef</span><b>₺{money(data.targetFromLast)}</b></div><div><span>Hedef satış sonrası alış</span><b>₺{money(data.reentryAfterTarget)}</b></div></div>
    <div className="stats"><div><span>Tamamlanan swing</span><b>{data.best.cycles}</b></div><div><span>Backtest getirisi</span><b>%{data.best.returnPct.toFixed(1)}</b></div><div><span>Ort. hedef süresi</span><b>{data.best.avgDays.toFixed(1)} seans</b></div></div>
    <button className="refresh" onClick={load}>↻ Güncelle</button>
  </section>;
}

export default function Home() {
  const [months, setMonths] = useState(3);
  return <main><header><div><p className="eyebrow">BIST · SWING STRATEGY</p><h1>BackTest Stock</h1><p className="sub">Backtest oranı + pozisyon takibi + güncel teknik görünüm.</p></div><div className="period"><span>BACKTEST</span><select value={months} onChange={e => setMonths(Number(e.target.value))}><option value={1}>1 ay · ~21 seans</option><option value={2}>2 ay · ~42 seans</option><option value={3}>3 ay · ~63 seans</option><option value={6}>6 ay · ~126 seans</option></select></div></header>
    <div className="grid"><StockCard symbol="ASELS" months={months} /><StockCard symbol="THYAO" months={months} /></div>
    <footer><span>Alış fiyatı bu cihazda saklanır. Günlük değişimleri toplamana gerek yok.</span><span>Geçmiş performans · yatırım tavsiyesi değildir.</span></footer>
  </main>;
}
