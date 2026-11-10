import type { AppProps } from 'next/app';
import { Inter } from 'next/font/google';
import '../styles/globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className={`${inter.variable} ${inter.className} font-sans antialiased text-[#1C1917] bg-[#F9F8F5] min-h-screen`}>
      <Component {...pageProps} />
    </div>
  );
}
