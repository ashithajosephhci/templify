import React from "react"
import type { Metadata } from "next"
import localFont from "next/font/local"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const geist = localFont({
  src: [
    { path: "../public/fonts/gyByhwUxId8gMEwYGFWfOw.woff2", weight: "100 900", style: "normal" },
    { path: "../public/fonts/gyByhwUxId8gMEwSGFWfOw.woff2", weight: "100 900", style: "normal" },
    { path: "../public/fonts/gyByhwUxId8gMEwcGFU.woff2", weight: "100 900", style: "normal" },
  ],
  variable: "--font-geist",
})

const geistMono = localFont({
  src: [
    { path: "../public/fonts/or3nQ6H-1_WfwkMZI_qYFrMdmgPn.woff2", weight: "100 900", style: "normal" },
    { path: "../public/fonts/or3nQ6H-1_WfwkMZI_qYFrkdmgPn.woff2", weight: "100 900", style: "normal" },
    { path: "../public/fonts/or3nQ6H-1_WfwkMZI_qYFrcdmg.woff2", weight: "100 900", style: "normal" },
  ],
  variable: "--font-geist-mono",
})

const karla = localFont({
  src: [
    { path: "../public/fonts/qkBbXvYC6trAT7RbLtyG5Q.woff2", weight: "200 800", style: "normal" },
    { path: "../public/fonts/qkBbXvYC6trAT7RVLtw.woff2", weight: "200 800", style: "normal" },
  ],
  variable: "--font-karla",
})

export const metadata: Metadata = {
  title: 'Templify | IHM & IHNA Document Templates',
  description: 'Create professional documents using official IHM and IHNA templates. Simply add your content and download formatted Word documents.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${geist.variable} ${geistMono.variable} ${karla.variable} font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
