import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Bar = { date: string; close: number; high: number; low: number };
type Result = {
  tp: number;
  reentry: number;
  cycles: number;
  returnPct: number;
  avgDays: number;
  score: number;
};

const allowed: Record<string, string> = {
  ASELS: 'ASELS.IS',
  THYAO: 'THYAO.IS',
};

function simulate(bars: Bar[], tp: number, reentry: number): Result {
  if (bars.length < 2) return { tp, reentry, cycles: 0, returnPct: 0, avgDays: 0, score: -999 };
  let state: 'holding' | 'cash' = 'holding';
  let entry = bars[0].close;
  let lastSale = 0;
  let equity = 1;
  let cycles = 0;
  let entryIndex = 0;
  let totalDays = 0;

  for (let i = 1; i < bars.length; i++) {
    const b = bars[i];
    if (state === 'holding') {
      const target = entry * (1 + tp / 100);
      if (b.high >= target) {
        equity *= 1 + tp / 100;
        lastSale = target;
        state = 'cash';
        cycles++;
        totalDays += i - entryIndex;
      }
    } else {
      const buy = lastSale * (1 - reentry / 100);
      if (b.low <= buy) {
        entry = buy;
        entryIndex = i;
        state = 'holding';
      }
    }
  }

  // Tamamlanmış çevrim getirisi. Açık pozisyonun gerçekleşmemiş kazancı skora katılmaz.
  const returnPct = (equity - 1) * 100;
  const avgDays = cycles ? totalDays / cycles : 0;
  // Tek şanslı büyük hareket yerine tekrarlanabilir çevrimleri tercih et.
  const activityPenalty = cycles < 2 ? (2 - cycles) * 3 : 0;
  const score = returnPct + Math.min(cycles, 8) * 0.35 - activityPenalty;
  return { tp, reentry, cycles, returnPct, avgDays, score };
}

function optimize(bars: Bar[]) {
  const results: Result[] = [];
  for (let tp = 1.5; tp <= 8.0001; tp += 0.25) {
    for (let re = 1.5; re <= 8.0001; re += 0.25) {
      results.push(simulate(bars, Number(tp.toFixed(2)), Number(re.toFixed(2))));
    }
  }
  results.sort((a, b) => b.score - a.score || b.returnPct - a.returnPct || b.cycles - a.cycles);
  return results[0];
}

async function getBars(symbol: string, days: number): Promise<Bar[]> {
  const ticker = allowed[symbol];
  if (!ticker) throw new Error('Desteklenmeyen hisse');
  const now = Math.floor(Date.now() / 1000);
  const from = now - Math.max(days + 60, 180) * 86400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${from}&period2=${now}&interval=1d&events=history&includeAdjustedClose=true`;
  const res = await fetch(url, {
    cache: 'no-store',
    headers: { 'User-Agent': 'Mozilla/5.0 SwingBacktest/1.0' },
  });
  if (!res.ok) throw new Error(`Piyasa verisi alınamadı (${res.status})`);
  const json = await res.json();
  const r = json?.chart?.result?.[0];
  if (!r?.timestamp?.length) throw new Error('Piyasa verisi boş döndü');
  const q = r.indicators?.quote?.[0];
  const bars: Bar[] = r.timestamp.map((t: number, i: number) => ({
    date: new Date(t * 1000).toISOString().slice(0, 10),
    close: q.close?.[i],
    high: q.high?.[i],
    low: q.low?.[i],
  })).filter((b: Bar) => Number.isFinite(b.close) && Number.isFinite(b.high) && Number.isFinite(b.low));
  return bars.slice(-days);
}

export async function GET(req: NextRequest) {
  const symbol = (req.nextUrl.searchParams.get('symbol') || 'ASELS').toUpperCase();
  const days = Math.min(180, Math.max(45, Number(req.nextUrl.searchParams.get('days') || 90)));
  try {
    const bars = await getBars(symbol, days);
    const best = optimize(bars);
    const last = bars[bars.length - 1];
    return NextResponse.json({
      symbol,
      days,
      bars: bars.length,
      lastPrice: last.close,
      lastDate: last.date,
      best,
      targetFromLast: last.close * (1 + best.tp / 100),
      reentryAfterTarget: last.close * (1 + best.tp / 100) * (1 - best.reentry / 100),
      source: 'Yahoo Finance chart data',
      note: 'Eğitim/analiz amaçlıdır; yatırım tavsiyesi değildir.',
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Bilinmeyen hata' }, { status: 500 });
  }
}
