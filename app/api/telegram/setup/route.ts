import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN tanımlı değil' }, { status: 500 });
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json({ error: `Telegram yanıt vermedi (${res.status})` }, { status: 502 });
    }

    const data = await res.json();
    const updates = Array.isArray(data?.result) ? data.result : [];
    const messages = updates
      .map((u: any) => u?.message || u?.edited_message || u?.channel_post || u?.callback_query?.message)
      .filter(Boolean)
      .filter((m: any) => m?.chat?.id);

    const last = messages[messages.length - 1];
    if (!last) {
      return NextResponse.json({
        error: 'Mesaj bulunamadı. Telegram botuna /start veya test yazıp tekrar deneyin.'
      }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      chatId: String(last.chat.id),
      chatType: last.chat.type,
      firstName: last.chat.first_name || null,
      username: last.chat.username || null,
      lastMessage: last.text || null,
      next: 'Bu chatId değerini Vercel Environment Variables bölümüne TELEGRAM_CHAT_ID adıyla Secret olarak ekleyin.'
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Bilinmeyen hata' }, { status: 500 });
  }
}
