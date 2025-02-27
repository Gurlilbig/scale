import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import localFont from 'next/font/local'
import Script from 'next/script'

const iosevka = localFont({
  src: [
    {
      path: '../fonts/Iosevka-Regular.ttf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../fonts/Iosevka-Medium.ttf',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../fonts/Iosevka-Bold.ttf',
      weight: '700',
      style: 'normal',
    }
  ],
  variable: '--font-iosevka'
})

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Scale",
  description: "A webflow extension app for image scaling.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${iosevka.variable}`}>
      <head>
        <Script src="/webflow-extension-setup.js" strategy="beforeInteractive" />
      </head>
      <body>{children}</body>
    </html>
  );
}
