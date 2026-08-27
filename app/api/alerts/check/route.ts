import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const check = await fetch('https://rnnpfiwzhbimslduanlo.supabase.co/functions/v1/swing-alert-check', { cache: 'no-store' });
    const result = await check.json();
    if (!check.ok) return NextResponse.json(result, { status: 500 });

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return NextResponse.json({ error: 'Telegram ayarları eksik', ...result }, { status: 500 });

    const sent = [];
    for (const a of result.alerts || []) {
      const text = `🎯 ${a.symbol} TP HEDEFİNE ULAŞTI\n\nFiyat: ₺${Number(a.price).toFixed(2)}\nHedef: ₺${Number(a.target).toFixed(2)}\nPozisyon hedefi: +%${Number(a.gainPct).toFixed(2)}\n\nSwing Board`;
      const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
      if (r.ok) sent.push(a.symbol);
    }

    return NextResponse.json({ checked: result.checked, alerts: result.alerts?.length || 0, sent });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Kontrol hatası' }, { status: 500 });
  }
}
