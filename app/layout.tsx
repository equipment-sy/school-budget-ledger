export const metadata = { title: "教務處經費台帳" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <head>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@500;700&family=Noto+Sans+TC:wght@400;500;700&display=swap');
          * { box-sizing: border-box; }
          body { margin: 0; background: #F7F5EC; color: #24312B; font-family: "Noto Sans TC", sans-serif; }
          .lg-num { font-variant-numeric: tabular-nums; }
          input, button { font-family: inherit; }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
