import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import SplashScreen from "@/components/SplashScreen";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rakshak - Women's Safety App",
  description: "Proactive safety assistant application with AI-powered route checking and SOS capabilities.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" async></script>
      </head>
      <body className={`${inter.variable} font-sans min-h-screen bg-zinc-950 text-foreground antialiased flex flex-col md:items-center md:justify-center md:p-8`}>
        <SplashScreen />
        <div className="w-full min-h-screen md:min-h-[850px] md:max-h-[900px] md:max-w-[420px] bg-background md:rounded-[2.5rem] md:shadow-[0_0_40px_rgba(225,29,72,0.15)] md:overflow-hidden md:border md:border-white/10 relative flex flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
