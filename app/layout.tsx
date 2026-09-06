import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Close — Confirmed Stock Scanner',description:'US stock breakout and breakdown scanner. Completed daily closes, market cap above $5B, and above-average volume.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
