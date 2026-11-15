import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "ParkPilot | Parking, in perfect order", description: "Smart parking operations for modern businesses" };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
