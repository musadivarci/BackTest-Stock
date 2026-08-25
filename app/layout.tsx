import './globals.css';

export const metadata = {
  title: 'Swing Backtest',
  description: 'ASELS ve THYAO için dinamik swing backtest aracı',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
