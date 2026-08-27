import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Bar = { date: string; close: number; high: number; low: number };
type Result = { tp: number; reentry: number; cycles: number; returnPct: number; avgDays: number; score: number };
type Technical = {
  label: 'Güçlü Al' | 'Al' | 'Nötr' | 'Sat' | 'Güçlü Sat';
  score: number; rsi14: number; macd: number; macdSignal: number; sma20: number; sma50: number; ema20: number;
};

function sma(values: number[], period: number) {
  if (values.length < period) return NaN;
  const xs = values.slice(-period);
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function emaSeries(values: number[], period: number) {
  if (!values.length) return [] as number[];
  const k = 2 / (period + 1); const out: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) out.push(values[i] * k + out[i - 1] * (1 - k));
  return out;
}
function rsi(values: number[], period = 14) {
  if (values.length <= period) return NaN;
  let gains = 0, losses = 0;
  for (let i = values.length - period; i < values.length; i++) {
    const d = values[i] - values[i - 1]; if (d >= 0) gains += d; else losses -= d;
  }
  if (losses === 0) return 100;
  const rs = (gains / period) / (losses / period); return 100 - 100 / (1 + rs);
}
function technicalSignal(bars: Bar[]): Technical {
  const c = bars.map(b => b.close), last = c[c.length - 1];
  const sma20 = sma(c, 20), sma50 = sma(c, 50);
  const ema20s = emaSeries(c, 20), ema12 = emaSeries(c, 12), ema26 = emaSeries(c, 26);
  const ema20 = ema20s.at(-1) ?? NaN;
  const macdSeries = ema12.map((v, i) => v - (ema26[i] ?? v));
  const signalSeries = emaSeries(macdSeries, 9);
  const macd = macdSeries.at(-1) ?? 0, macdSignal = signalSeries.at(-1) ?? 0, rsi14 = rsi(c, 14);
  let score = 0;
  if (Number.isFinite(sma20)) score += last > sma20 ? 1 : -1;
  if (Number.isFinite(sma50)) score += last > sma50 ? 1 : -1;
  if (Number.isFinite(ema20)) score += last > ema20 ? 1 : -1;
  score += macd > macdSignal ? 1 : -1;
  if (Number.isFinite(rsi14)) {
    if (rsi14 >= 55 && rsi14 <= 70) score += 1;
    else if ((rsi14 < 45 && rsi14 >= 30) || rsi14 > 75) score -= 1;
  }
  const label: Technical['label'] = score >= 4 ? 'Güçlü Al' : score >= 2 ? 'Al' : score <= -4 ? 'Güçlü Sat' : score <= -2 ? 'Sat' : 'Nötr';
  return { label, score, rsi14, macd, macdSignal, sma20, sma50, ema20 };
}
function simulate(bars: Bar[], tp: number, reentry: number): Result {
  if (bars.length < 2) return { tp, reentry, cycles: 0, returnPct: 0, avgDays: 0, score: -999 };
  let state: 'holding' | 'cash' = 'holding', entry = bars[0].close, lastSale = 0, equity = 1, cycles = 0, entryIndex = 0, totalDays = 0;
  for (let i = 1; i < bars.length; i++) {
    const b = bars[i];
    if (state === 'holding') {
      const target = entry * (1 + tp / 100);
      if (b.high >= target) { equity *= 1 + tp / 100; lastSale = target; state = 'cash'; cycles++; totalDays += i - entryIndex; }
    } else {
      const buy = lastSale * (1 - reentry / 100);
      if (b.low <= buy) { entry = buy; entryIndex = i; state = 'holding'; }
    }
  }
  const returnPct = (equity - 1) * 100, avgDays = cycles ? totalDays / cycles : 0;
  const activityPenalty = cycles < 2 ? (2 - cycles) * 4 : 0;
  const wideReentryPenalty = Math.max(0, reentry - 5) * 1.2;
  const imbalancePenalty = Math.max(0, Math.abs(tp - reentry) - 2.5) * 0.5;
  const score = returnPct + Math.min(cycles, 8) * 0.4 - activityPenalty - wideReentryPenalty - imbalancePenalty;
  return { tp, reentry, cycles, returnPct, avgDays, score };
}
function optimize(bars: Bar[]) {
  const results: Result[] = [];
  for (let tp = 1.5; tp <= 6.0001; tp += 0.25)
    for (let re = 1.5; re <= 6.0001; re += 0.25)
      results.push(simulate(bars, Number(tp.toFixed(2)), Number(re.toFixed(2))));
  results.sort((a, b) => b.score - a.score || b.cycles - a.cycles || b.returnPct - a.returnPct);
  return results[0];
}
async function getBars(symbol: string): Promise<Bar[]> {
  if (!/^[A-Z0-9]{2,8}$/.test(symbol)) throw new Error('Geçersiz hisse kodu');
  const ticker = `${symbol}.IS`;
  const now = Math.floor(Date.now() / 1000), from = now - 420 * 86400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${from}&period2=${now}&interval=1d&events=history&includeAdjustedClose=true`;
  const res = await fetch(url, { cache: 'no-store', headers: { 'User-Agent': 'Mozilla/5.0 SwingBacktest/1.0' } });
  if (!res.ok) throw new Error(`Piyasa verisi alınamadı (${res.status})`);
  const json = await res.json(), r = json?.chart?.result?.[0];
  if (!r?.timestamp?.length) throw new Error('Hisse bulunamadı veya veri yok');
  const q = r.indicators?.quote?.[0];
  return r.timestamp.map((t: number, i: number) => ({ date: new Date(t * 1000).toISOString().slice(0, 10), close: q.close?.[i], high: q.high?.[i], low: q.low?.[i] }))
    .filter((b: Bar) => Number.isFinite(b.close) && Number.isFinite(b.high) && Number.isFinite(b.low));
}
export async function GET(req: NextRequest) {
  const symbol = (req.nextUrl.searchParams.get('symbol') || 'ASELS').toUpperCase();
  const months = Math.min(6, Math.max(1, Number(req.nextUrl.searchParams.get('months') || 3)));
  const tradingDays = Math.round(months * 21);
  try {
    const allBars = await getBars(symbol), bars = allBars.slice(-tradingDays), best = optimize(bars), technical = technicalSignal(allBars.slice(-100)), last = bars[bars.length - 1];
    return NextResponse.json({ symbol, months, tradingDays, bars: bars.length, lastPrice: last.close, lastDate: last.date, best, technical,
      targetFromLast: last.close * (1 + best.tp / 100), reentryAfterTarget: last.close * (1 + best.tp / 100) * (1 - best.reentry / 100),
      source: 'Yahoo Finance chart data', note: 'Teknik görünüm uygulama içinde hesaplanır.' });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Bilinmeyen hata' }, { status: 500 });
  }
}
