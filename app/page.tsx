'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type Data = {
  symbol: string; months: number; tradingDays: number; bars: number; lastPrice: number; lastDate: string;
  best: { tp: number; reentry: number; cycles: number; returnPct: number; avgDays: number };
  technical: { label: string; score: number; rsi14: number; macd: number; macdSignal: number; sma20: number; sma50: number; ema20: number };
  targetFromLast: number; reentryAfterTarget: number; error?: string;
};
type StockState = { symbol: string; data?: Data; loading: boolean; entry?: number | null; entryInput: string };
type RadarItem = { symbol: string; price: number; score: number; verdict: 'Fırsat'|'İzle'|'Bekle'; drawdown20: number; rsi14: number; avgSwing20: number; maxMove20: number; lowPrice: boolean; reason: string };

const money = (n: number) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const pct = (n: number) => `${n >= 0 ? '+' : ''}%${n.toFixed(2)}`;
const DEFAULT_SYMBOLS = ['ASELS', 'THYAO'];

export default function Home() {
  const [months, setMonths] = useState(3);
  const [symbols, setSymbols] = useState<string[]>(DEFAULT_SYMBOLS);
  const [stocks, setStocks] = useState<Record<string, StockState>>({});
  const [newSymbol, setNewSymbol] = useState('');
  const [radar, setRadar] = useState<RadarItem[]>([]);
  const [radarLoading, setRadarLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('swing-symbols');
    if (saved) { try { const arr = JSON.parse(saved); if (Array.isArray(arr) && arr.length) setSymbols(arr); } catch {} }
    loadRadar();
  }, []);

  useEffect(() => { localStorage.setItem('swing-symbols', JSON.stringify(symbols)); }, [symbols]);
  useEffect(() => { symbols.forEach(symbol => loadStock(symbol)); }, [months, symbols.join('|')]);

  async function loadRadar() {
    setRadarLoading(true);
    try { const r = await fetch('/api/radar', { cache: 'no-store' }); const j = await r.json(); setRadar(j.items || []); } catch { setRadar([]); }
    setRadarLoading(false);
  }

  async function loadStock(symbol: string) {
    setStocks(prev => ({ ...prev, [symbol]: { ...(prev[symbol] || { symbol, entryInput: '' }), loading: true } }));
    try {
      const r = await fetch(`/api/backtest?symbol=${symbol}&months=${months}`, { cache: 'no-store' });
      const data = await r.json();
      const saved = localStorage.getItem(`position-entry-${symbol}`);
      const entry = saved && Number(saved) > 0 ? Number(saved) : null;
      setStocks(prev => ({ ...prev, [symbol]: { symbol, data, loading: false, entry, entryInput: entry ? String(entry) : prev[symbol]?.entryInput || '' } }));
    } catch { setStocks(prev => ({ ...prev, [symbol]: { symbol, data: { error: 'Veri alınamadı' } as Data, loading: false, entry: null, entryInput: '' } })); }
  }

  function saveEntry(symbol: string, e: FormEvent) {
    e.preventDefault(); const raw = stocks[symbol]?.entryInput || ''; const n = Number(raw.replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) return;
    localStorage.setItem(`position-entry-${symbol}`, String(n));
    setStocks(prev => ({ ...prev, [symbol]: { ...prev[symbol], entry: n } }));
  }
  function clearEntry(symbol: string) {
    localStorage.removeItem(`position-entry-${symbol}`);
    setStocks(prev => ({ ...prev, [symbol]: { ...prev[symbol], entry: null, entryInput: '' } }));
  }
  function addSymbol(e: FormEvent) {
    e.preventDefault(); const s = newSymbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!s || symbols.includes(s)) return; setSymbols(prev => [...prev, s]); setNewSymbol('');
  }
  function addRadarSymbol(symbol: string) { if (!symbols.includes(symbol)) setSymbols(prev => [...prev, symbol]); }
  function removeSymbol(symbol: string) {
    if (DEFAULT_SYMBOLS.includes(symbol)) return;
    setSymbols(prev => prev.filter(s => s !== symbol)); localStorage.removeItem(`position-entry-${symbol}`);
  }

  const active = useMemo(() => symbols.filter(s => stocks[s]?.entry), [symbols, stocks]);
  const waiting = useMemo(() => symbols.filter(s => !stocks[s]?.entry), [symbols, stocks]);
  const topRadar = radar.filter(r => !symbols.includes(r.symbol)).slice(0, 6);

  return <main>
    <header className="hero"><div><p className="eyebrow">BIST · SWING DESK</p><h1>Swing Board</h1><p className="sub">Pozisyonlar, alım bekleyenler ve otomatik fırsat radarı.</p></div><div className="period"><span>BACKTEST</span><select value={months} onChange={e => setMonths(Number(e.target.value))}><option value={1}>1 ay · ~21 seans</option><option value={2}>2 ay · ~42 seans</option><option value={3}>3 ay · ~63 seans</option><option value={6}>6 ay · ~126 seans</option></select></div></header>

    <section className="overview"><div><span>Aktif pozisyon</span><strong>{active.length}</strong></div><div><span>Alım bekleyen</span><strong>{waiting.length}</strong></div><div><span>Takip edilen</span><strong>{symbols.length}</strong></div><div><span>Bildirim</span><strong className="statusOk">Telegram</strong></div></section>

    <section className="sectionBlock">
      <div className="sectionHead"><div><span className="sectionKicker">FIRSAT TARAMASI</span><h2>Radar</h2></div><button className="radarRefresh" onClick={loadRadar}>↻ Yenile</button></div>
      <p className="radarNote">Düşük nominal fiyat, son 20 günlük geri çekilme, RSI ve kontrollü volatilite birlikte değerlendirilir. Düşük fiyat tek başına “ucuz” demek değildir.</p>
      {radarLoading ? <div className="radarGrid"><div className="radarCard pulse"/><div className="radarCard pulse"/><div className="radarCard pulse"/></div> : <div className="radarGrid">{topRadar.map(r => <article className="radarCard" key={r.symbol}>
        <div className="radarTop"><div><strong>{r.symbol}</strong><span className={`radarVerdict ${r.verdict === 'Fırsat' ? 'opportunity' : ''}`}>{r.verdict}</span></div><b>₺{money(r.price)}</b></div>
        <div className="radarReason">{r.reason}</div>
        <div className="radarStats"><span>Zirveden <b>%{Math.abs(r.drawdown20).toFixed(1)}</b></span><span>RSI <b>{r.rsi14.toFixed(0)}</b></span><span>Skor <b>{r.score}/11</b></span></div>
        <button onClick={() => addRadarSymbol(r.symbol)}>Takibe ekle</button>
      </article>)}</div>}
    </section>

    <section className="sectionBlock"><div className="sectionHead"><div><span className="sectionKicker">PORTFÖY</span><h2>Aktif pozisyonlar</h2></div><span className="muted">TP takibi</span></div>{active.length ? <div className="list">{active.map(symbol => <StockRow key={symbol} state={stocks[symbol]} onReload={() => loadStock(symbol)} onSave={e => saveEntry(symbol, e)} onClear={() => clearEntry(symbol)} onInput={v => setStocks(p => ({ ...p, [symbol]: { ...p[symbol], entryInput: v } }))} />)}</div> : <div className="empty">Henüz aktif pozisyon yok.</div>}</section>

    <section className="sectionBlock"><div className="sectionHead"><div><span className="sectionKicker">TAKİP</span><h2>Alım bekleyenler</h2></div><form className="addTicker" onSubmit={addSymbol}><input value={newSymbol} onChange={e => setNewSymbol(e.target.value)} placeholder="Hisse kodu" /><button>Ekle</button></form></div><div className="list">{waiting.map(symbol => <StockRow key={symbol} state={stocks[symbol] || { symbol, loading: true, entryInput: '' }} onReload={() => loadStock(symbol)} onSave={e => saveEntry(symbol, e)} onClear={() => clearEntry(symbol)} onInput={v => setStocks(p => ({ ...p, [symbol]: { ...p[symbol], symbol, loading: p[symbol]?.loading ?? true, entryInput: v } }))} onRemove={!DEFAULT_SYMBOLS.includes(symbol) ? () => removeSymbol(symbol) : undefined} />)}</div></section>

    <footer><span>Radar aşırı spekülatif küçük hisseleri havuza almaz.</span><span>Backtest ve radar geçmiş veriye dayanır · yatırım tavsiyesi değildir.</span></footer>
  </main>;
}

function StockRow({ state, onReload, onSave, onClear, onInput, onRemove }: { state: StockState; onReload: () => void; onSave: (e: FormEvent) => void; onClear: () => void; onInput: (v: string) => void; onRemove?: () => void }) {
  const { symbol, data, loading, entry, entryInput } = state;
  if (loading) return <article className="stockRow loadingRow"><div className="pulse" /></article>;
  if (!data || data.error) return <article className="stockRow"><div className="rowMain"><strong>{symbol}</strong><span className="error">{data?.error || 'Veri alınamadı'}</span></div><button className="rowBtn" onClick={onReload}>Tekrar dene</button>{onRemove && <button className="iconBtn" onClick={onRemove}>×</button>}</article>;
  const posReturn = entry ? (data.lastPrice / entry - 1) * 100 : 0;
  const target = entry ? entry * (1 + data.best.tp / 100) : data.targetFromLast;
  const remaining = entry ? Math.max(0, (target / data.lastPrice - 1) * 100) : null;
  const reached = !!entry && data.lastPrice >= target;
  const progress = entry ? Math.max(0, Math.min(100, (posReturn / data.best.tp) * 100)) : 0;
  return <article className="stockRow"><div className="rowMain"><div className="tickerLine"><strong>{symbol}</strong><span className={`badge ${data.technical.label.includes('Al') ? 'buy' : data.technical.label.includes('Sat') ? 'sell' : ''}`}>{data.technical.label}</span></div><div className="lastPrice">₺{money(data.lastPrice)}</div><small>{data.lastDate} · RSI {data.technical.rsi14.toFixed(0)}</small></div><div className="rowMetric"><span>TP</span><strong>+%{data.best.tp.toFixed(2)}</strong></div><div className="rowMetric"><span>Yeniden al</span><strong>-%{data.best.reentry.toFixed(2)}</strong></div>{entry ? <div className="positionStrip"><div><span>Getiri</span><b className={posReturn >= 0 ? 'positive' : 'negative'}>{pct(posReturn)}</b></div><div><span>Hedef</span><b>₺{money(target)}</b></div><div><span>{reached ? 'Durum' : 'Kalan'}</span><b className={reached ? 'hit' : ''}>{reached ? 'HEDEF' : `%${remaining?.toFixed(2)}`}</b></div><div className="thinProgress"><i style={{ width: `${progress}%` }} /></div><button className="ghostBtn" onClick={onClear}>Pozisyonu kapat</button></div> : <form className="quickEntry" onSubmit={onSave}><input inputMode="decimal" value={entryInput} onChange={e => onInput(e.target.value)} placeholder="Alış fiyatı" /><button>Pozisyon aç</button></form>}<button className="iconBtn refreshIcon" onClick={onReload}>↻</button>{onRemove && <button className="iconBtn removeIcon" onClick={onRemove}>×</button>}</article>;
}
