import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Bar = { date: string; close: number; high: number; low: number };
type Result = { tp: number; reentry: number; cycles: number; returnPct: number; avgDays: number; score: number };

const allowed: Record<string, string> = { ASELS: 'ASELS.IS', THYAO: 'THYAO.IS' };

function simulate(bars: Bar[], tp: number, reentry: number): Result {
  if (bars.length < 2) return { tp, reentry, cycles: 0, returnPct: 0, avgDays: 0, score: -999 };
  let state: 'holding' | 'cash' = 'holding';
  let entry = bars[0].close, lastSale = 0, equity = 1, cycles = 0, entryIndex = 0, totalDays = 0;

  for (let i = 1; i < bars.length; i++) {
    const b = bars[i];
    if (state === 'holding') {
      const target = entry * (1 + tp / 100);
      if (b.high >= target) {
        equity *= 1 + tp / 100;
        lastSale = target; state = 'cash'; cycles++; totalDays += i - entryIndex;
      }
    } else {
      const buy = lastSale * (1 - reentry / 100);
      if (b.low <= buy) { entry = buy; entryIndex = i; state = 'holding'; }
    }
  }

  const returnPct = (equity - 1) * 100;
  const avgDays = cycles ? totalDays / cycles : 0;
  // Amaç yalnız geçmiş maksimum getiriyi kovalamak değil, tekrar edilebilir swing bulmak.
  const activityPenalty = cycles < 2 ? (2 - cycles) * 4 : 0;
  const wideReentryPenalty = Math.max(0, reentry - 5) * 1.2;
  const wideTpPenalty = Math.max(0, tp - 6) * 0.6;
  const imbalancePenalty = Math.max(0, Math.abs(tp - reentry) - 2.5) * 0.5;
  const score = returnPct + Math.min(cycles, 8) * 0.4 - activityPenalty - wideReentryPenalty - wideTpPenalty - imbalancePenalty;
  return { tp, reentry, cycles, returnPct, avgDays, score };
}

function optimize(bars: Bar[]) {
  const results: Result[] = [];
  // Pratik swing bölgesi: %1.5–%6.0. 0.25 puan çözünürlük.
  for (let tp = 1.5; tp <= 6.0001; tp += 0.25)
    for (let re = 1.5; re <= 6.0001; re += 0.25)
      results.push(simulate(bars, Number(tp.toFixed(2)), Number(re.toFixed(2))));
  results.sort((a, b) => b.score - a.score || b.cycles - a.cycles || b.returnPct - a.returnPct);
  return results[0];
}

async function getBars(symbol: string, tradingDays: number): Promise<Bar[]> {
  const ticker = allowed[symbol];
  if (!ticker) throw new Error('Desteklenmeyen hisse');
  const now = Math.floor(Date.now() / 1000);
  const from = now - Math.max(tradingDays * 2 + 30, 180) * 86400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${from}&period2=${now}&interval=1d&events=history&includeAdjustedClose=true`;
  const res = await fetch(url, { cache: 'no-store', headers: { 'User-Agent': 'Mozilla/5.0 SwingBacktest/1.0' } });
  if (!res.ok) throw new Error(`Piyasa verisi alınamadı (${res.status})`);
  const json = await res.json();
  const r = json?.chart?.result?.[0];
  if (!r?.timestamp?.length) throw new Error('Piyasa verisi boş döndü');
  const q = r.indicators?.quote?.[0];
  const bars: Bar[] = r.timestamp.map((t: number, i: number) => ({
    date: new Date(t * 1000).toISOString().slice(0, 10), close: q.close?.[i], high: q.high?.[i], low: q.low?.[i]
  })).filter((b: Bar) => Number.isFinite(b.close) && Number.isFinite(b.high) && Number.isFinite(b.low));
  return bars.slice(-tradingDays);
}

export async function GET(req: NextRequest) {
  const symbol = (req.nextUrl.searchParams.get('symbol') || 'ASELS').toUpperCase();
  // UI artık takvim ayı seçer: 1 ay≈21, 2≈42, 3≈63, 6≈126 işlem günü.
  const months = Math.min(6, Math.max(1, Number(req.nextUrl.searchParams.get('months') || 3)));
  const tradingDays = Math.round(months * 21);
  try {
    const bars = await getBars(symbol, tradingDays);
    const best = optimize(bars);
    const last = bars[bars.length - 1];
    return NextResponse.json({
      symbol, months, tradingDays, bars: bars.length, lastPrice: last.close, lastDate: last.date, best,
      targetFromLast: last.close * (1 + best.tp / 100),
      reentryAfterTarget: last.close * (1 + best.tp / 100) * (1 - best.reentry / 100),
      source: 'Yahoo Finance chart data',
      note: 'Backtest geçmiş performanstır; yatırım tavsiyesi değildir.'
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Bilinmeyen hata' }, { status: 500 });
  }
}
