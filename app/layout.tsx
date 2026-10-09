import type { Metadata } from "next";
import "./globals.css";
import { AntdRegistry } from "@ant-design/nextjs-registry";
export const metadata:Metadata={title:"TRE Tracker · Preparation workspace",description:"Your focused BPSC TRE 4 preparation tracker."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><AntdRegistry>{children}</AntdRegistry></body></html>;}
