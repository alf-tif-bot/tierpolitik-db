import type { ReactNode } from 'react'

export const metadata = {
  title: 'Cockpit',
  icons: {
    icon: '/favicon-brain-bold.svg',
    shortcut: '/favicon-brain-bold.svg',
    apple: '/favicon-brain-bold.svg',
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body suppressHydrationWarning style={{ margin: 0, fontFamily: 'Inter, system-ui, sans-serif', background: '#111111', color: '#f5f5f5' }}>
        {children}
      </body>
    </html>
  )
}
