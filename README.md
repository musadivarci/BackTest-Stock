# BackTest Stock

ASELS ve THYAO için son 60/90/120/180 günlük fiyat hareketlerini kullanarak TP ve satış sonrası yeniden alış yüzdesini optimize eden sade swing backtest uygulaması.

## Mantık
- Günlük OHLC verisi sunucu tarafında alınır.
- TP ve yeniden alış oranları %1,50–%8,00 arasında 0,25 puan adımlarla taranır.
- Sadece tamamlanmış satış çevrimleri gerçekleşmiş getiriye eklenir.
- Skor, tek bir şanslı harekete aşırı uyumu azaltmak için çevrim sayısını da dikkate alır.

## Çalıştırma
```bash
npm install
npm run dev
```

> Analiz/eğitim amaçlıdır; yatırım tavsiyesi değildir.
