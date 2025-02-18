import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import { Lexend } from "next/font/google";
import "./globals.css";

const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tạo Scenes & Schedules - VIS",
  description: "Ứng dụng web tự động tạo mã C cho ngữ cảnh & lịch trình RCU.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${lexend.variable} antialiased`}>
        <main>{children}</main>
        <Toaster />
      </body>
    </html>
  );
}
