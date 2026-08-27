import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Bar = { close: number; high: number; low: number; volume: number };
type RadarItem = {
  symbol: string;
  price: number;
  score: number;
  verdict: 'ALIM FIRSATI' | 'İZLE' | 'BEKLE' | 'UZAK DUR';
  drawdown20: number;
  noNewLow: boolean;
  rsi14: number;
  rsiRising: boolean;
  volumeVeto: boolean;
  lowPrice: boolean;
  reason: string;
};

const UNIVERSE = ['AKBNK','YKBNK','ISCTR','TSKB','PETKM','SISE','EREGL','KRDMD','EKGYO','SAHOL','TUPRS','KCHOL','BIMAS','TCELL','TAVHL','FROTO','ASELS','THYAO'];

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
  const from = now - 140 * 86400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.IS?period1=${from}&period2=${now}&interval=1d&events=history`;
  const res = await fetch(url, { cache: 'no-store', headers: { 'User-Agent': 'Mozilla/5.0 SwingRadar/2.0' } });
  if (!res.ok) throw new Error('data');
  const json = await res.json();
  const r = json?.chart?.result?.[0];
  const q = r?.indicators?.quote?.[0];
  if (!r?.timestamp?.length || !q) throw new Error('data');
  return r.timestamp.map((_: number, i: number) => ({
    close: q.close?.[i], high: q.high?.[i], low: q.low?.[i], volume: q.volume?.[i] || 0
  })).filter((b: Bar) => Number.isFinite(b.close) && Number.isFinite(b.high) && Number.isFinite(b.low));
}

function analyze(symbol: string, bars: Bar[]): RadarItem {
  const recent20 = bars.slice(-20);
  const closes = bars.map(b => b.close);
  const price = closes.at(-1)!;
  const high20 = Math.max(...recent20.map(b => b.high));
  const drawdown20 = (price / high20 - 1) * 100;
  const inDipZone = drawdown20 <= -5 && drawdown20 >= -15;

  // Son 3 seansın en düşük seviyesi, önceki 7 seansın dibini aşağı kırmıyorsa düşüş frenliyor kabul edilir.
  const last3 = bars.slice(-3);
  const prev7 = bars.slice(-10, -3);
  const last3Low = Math.min(...last3.map(b => b.low));
  const prev7Low = Math.min(...prev7.map(b => b.low));
  const noNewLow = last3Low >= prev7Low;

  const rsiNow = rsi(closes, 14);
  const rsi3Ago = rsi(closes.slice(0, -3), 14);
  const rsiRising = rsiNow > rsi3Ago + 1;

  const today = bars.at(-1)!;
  const yesterday = bars.at(-2)!;
  const prior10Low = Math.min(...bars.slice(-11, -1).map(b => b.low));
  const avgVol20 = recent20.slice(0, -1).reduce((a, b) => a + b.volume, 0) / Math.max(1, recent20.length - 1);
  const newLowToday = today.low < prior10Low;
  const sellingDay = today.close < yesterday.close;
  const volumeRising = today.volume > avgVol20 * 1.2;
  const volumeVeto = newLowToday && sellingDay && volumeRising;

  let score = 0;
  if (inDipZone) score++;
  if (noNewLow) score++;
  if (rsiRising) score++;

  let verdict: RadarItem['verdict'];
  if (volumeVeto) verdict = 'UZAK DUR';
  else if (inDipZone && noNewLow && rsiRising) verdict = 'ALIM FIRSATI';
  else if (score >= 2) verdict = 'İZLE';
  else verdict = 'BEKLE';

  const reason = volumeVeto
    ? 'Yeni dip + artan satış hacmi'
    : `${inDipZone ? '✓ düşüş bölgesi' : '· düşüş uygun değil'} · ${noNewLow ? '✓ dip durdu' : '· yeni dip var'} · ${rsiRising ? '✓ RSI dönüyor' : '· RSI dönmedi'}`;

  return { symbol, price, score, verdict, drawdown20, noNewLow, rsi14: rsiNow, rsiRising, volumeVeto, lowPrice: price <= 100, reason };
}

export async function GET() {
  const settled = await Promise.allSettled(UNIVERSE.map(async symbol => analyze(symbol, await fetchBars(symbol))));
  const rank: Record<RadarItem['verdict'], number> = { 'ALIM FIRSATI': 0, 'İZLE': 1, 'BEKLE': 2, 'UZAK DUR': 3 };
  const items = settled
    .filter((x): x is PromiseFulfilledResult<RadarItem> => x.status === 'fulfilled')
    .map(x => x.value)
    .sort((a, b) => rank[a.verdict] - rank[b.verdict] || b.score - a.score || Math.abs(b.drawdown20) - Math.abs(a.drawdown20));
  return NextResponse.json({
    updatedAt: new Date().toISOString(),
    formula: 'R = D + B + M; VETO => UZAK DUR',
    items,
    note: 'D: zirveden %5-15 düşüş, B: son 3 seansta yeni dip yok, M: RSI yükseliyor. Yeni dip + artan satış hacmi veto.'
  });
}
