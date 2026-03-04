import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "GPSLOB.DK - Stjerneløb for hele klassen",
  description: "Byg, del og følg med live.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="da">
      <body className={`${poppins.variable} font-sans antialiased bg-[#0a1128]`}>
        {children}
      </body>
    </html>
  );
}
