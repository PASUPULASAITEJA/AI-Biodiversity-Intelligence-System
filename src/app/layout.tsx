import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Darukaa.Earth — AI Biodiversity Intelligence System",
  description: "Enterprise-grade AI Environmental Scientist platform powered by multi-metric RAG retrieval, 2-hop causal relationship graphs, and peer-reviewed agro-ecological research.",
  keywords: ["biodiversity", "environmental intelligence", "RAG", "agroforestry", "soil health", "IPCC", "FAO"],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`dark scroll-smooth ${plusJakarta.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-[#070e0c] text-slate-100 font-sans antialiased selection:bg-emerald-500 selection:text-black min-h-screen">
        {children}
      </body>
    </html>
  );
}
