import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Bar = { close: number; high: number; low: number; volume: number };
type RadarItem = {
  symbol: string; price: number; score: number; verdict: 'Fırsat' | 'İzle' | 'Bekle';
  drawdown20: number; rsi14: number; avgSwing20: number; maxMove20: number; lowPrice: boolean; reason: string;
};

// Büyük/likit ve swing davranışı izlemeye değer çekirdek havuz. Aşırı spekülatif küçük hisseler bilerek yok.
const UNIVERSE = ['AKBNK','YKBNK','ISCTR','TSKB','PETKM','SISE','EREGL','KRDMD','EKGYO','SAHOL','TUPRS','KCHOL','BIMAS','TCELL','TAVHL','FROTO'];

function rsi(values: number[], period = 14) {
  if (values.length <= period) return 50;
  let gains = 0, losses = 0;
  for (let i = values.length - period; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gains += d; else losses -= d;
  }
  if (!losses) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

async function fetchBars(symbol: string): Promise<Bar[]> {
  const now = Math.floor(Date.now() / 1000);
  const from = now - 120 * 86400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.IS?period1=${from}&period2=${now}&interval=1d&events=history`;
  const res = await fetch(url, { cache: 'no-store', headers: { 'User-Agent': 'Mozilla/5.0 SwingRadar/1.0' } });
  if (!res.ok) throw new Error('data');
  const json = await res.json();
  const r = json?.chart?.result?.[0];
  const q = r?.indicators?.quote?.[0];
  if (!r?.timestamp?.length || !q) throw new Error('data');
  return r.timestamp.map((_: number, i: number) => ({ close: q.close?.[i], high: q.high?.[i], low: q.low?.[i], volume: q.volume?.[i] || 0 }))
    .filter((b: Bar) => Number.isFinite(b.close) && Number.isFinite(b.high) && Number.isFinite(b.low));
}

function analyze(symbol: string, bars: Bar[]): RadarItem {
  const recent = bars.slice(-20);
  const closes = bars.map(b => b.close);
  const price = closes.at(-1)!;
  const high20 = Math.max(...recent.map(b => b.high));
  const drawdown20 = (price / high20 - 1) * 100;
  const rsi14 = rsi(closes, 14);
  const moves = recent.slice(1).map((b, i) => Math.abs((b.close / recent[i].close - 1) * 100));
  const avgSwing20 = moves.reduce((a,b) => a+b, 0) / Math.max(1, moves.length);
  const maxMove20 = Math.max(...moves, 0);
  const lowPrice = price <= 100;

  let score = 0;
  // Geri çekilmiş ama çökmemiş bölgeyi tercih et.
  if (drawdown20 <= -4 && drawdown20 >= -12) score += 4;
  else if (drawdown20 < -2 && drawdown20 > -16) score += 2;
  else if (drawdown20 < -16) score -= 2;
  // Aşırı satıma yakın ama momentum tamamen bozulmamış.
  if (rsi14 >= 35 && rsi14 <= 52) score += 3;
  else if (rsi14 > 52 && rsi14 <= 62) score += 1;
  else if (rsi14 < 28 || rsi14 > 75) score -= 2;
  // Swing üretmeli ama pump/dump olmamalı.
  if (avgSwing20 >= 1.2 && avgSwing20 <= 3.5) score += 2;
  else if (avgSwing20 < 0.7) score -= 1;
  if (maxMove20 > 8.5) score -= 3;
  else if (maxMove20 <= 6) score += 1;
  if (lowPrice) score += 1;

  const verdict: RadarItem['verdict'] = score >= 7 ? 'Fırsat' : score >= 4 ? 'İzle' : 'Bekle';
  const parts = [];
  if (drawdown20 <= -4) parts.push(`20g zirveden %${Math.abs(drawdown20).toFixed(1)} aşağıda`);
  if (rsi14 <= 52) parts.push(`RSI ${rsi14.toFixed(0)}`);
  if (lowPrice) parts.push('100 TL altı');
  if (maxMove20 <= 6) parts.push('hareket kontrollü');
  return { symbol, price, score, verdict, drawdown20, rsi14, avgSwing20, maxMove20, lowPrice, reason: parts.slice(0,3).join(' · ') || 'Takipte' };
}

export async function GET() {
  const settled = await Promise.allSettled(UNIVERSE.map(async symbol => analyze(symbol, await fetchBars(symbol))));
  const items = settled.filter((x): x is PromiseFulfilledResult<RadarItem> => x.status === 'fulfilled').map(x => x.value)
    .sort((a,b) => b.score - a.score || a.price - b.price);
  return NextResponse.json({ updatedAt: new Date().toISOString(), items, note: 'Radar fiyat ucuzluğu değil; geri çekilme, RSI ve kontrollü volatiliteyi tarar.' });
}
