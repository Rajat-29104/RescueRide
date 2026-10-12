import './globals.css';
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

export const metadata = {
  title: {
    default: 'RescueRide | Roadside assistance, connected',
    template: '%s | RescueRide',
  },
  description: 'A coordinated roadside assistance experience for drivers and mechanics.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={inter.variable}>{children}</body>
    </html>
  );
}
