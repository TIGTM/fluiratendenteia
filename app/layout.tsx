import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fluir Atendente IA",
  description: "Atendente IA para WhatsApp com WAHA, n8n e automação comercial."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
