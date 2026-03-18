import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DocuMind AI - Intelligent RAG Chatbot",
  description: "A full-stack RAG chatbot built with FastAPI, Next.js, and Google Gemini.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased custom-scrollbar">
        {children}
      </body>
    </html>
  );
}
