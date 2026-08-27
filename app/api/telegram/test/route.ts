import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return NextResponse.json({ ok: false, error: 'Telegram ayarları eksik' }, { status: 500 });
  }

  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: '✅ Swing Board Telegram testi başarılı.\nASELS / THYAO hedef bildirimleri bu kanaldan gelecek.'
    }),
  });

  const body = await r.json();
  if (!r.ok) return NextResponse.json({ ok: false, telegram: body }, { status: 500 });
  return NextResponse.json({ ok: true, message_id: body?.result?.message_id });
}
