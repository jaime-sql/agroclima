import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgroClima",
  description:
    "Un pequeño caficultor en El Salvador toma una foto de una hoja y, en español, escucha si es roya, por qué esta semana es riesgosa y exactamente qué paso de bajo costo tomar y cuándo.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
