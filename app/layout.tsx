import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'uno+ · Mi florería',description:'Las cuentas de tu florería, simples y siempre a mano.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="es"><body>{children}</body></html>;}
