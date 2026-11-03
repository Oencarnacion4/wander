import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { SiteHeader, MobileNav } from "@/components/SiteChrome";
import { WanderProvider } from "@/components/WanderProvider";

const body = Plus_Jakarta_Sans({ variable: "--font-body", subsets: ["latin"] });
const display = Fraunces({ variable: "--font-display", subsets: ["latin"], weight: ["500", "600", "700"], style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: { default: "WANDER — Less Planning. More Living.", template: "%s · WANDER" },
  description: "Discover real places, build realistic plans, and keep track of everywhere you've been.",
};

export const viewport: Viewport = {
  themeColor: "#2b1430",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <WanderProvider>
          <SiteHeader />
          <main className="flex-1 pb-20 md:pb-0">{children}</main>
          <footer className="hidden md:block border-t border-line mt-16 bg-card">
            <div className="mx-auto max-w-7xl px-6 py-8 flex flex-wrap gap-4 justify-between text-sm text-muted">
              <p>
                <span className="font-display font-bold text-ink">WANDER</span> · Less Planning. More Living.
              </p>
              <p>
                Place data © <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a> · Photos via Wikipedia
              </p>
            </div>
          </footer>
          <MobileNav />
        </WanderProvider>
      </body>
    </html>
  );
}
