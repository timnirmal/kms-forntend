import HeaderAuth from "@/components/header-auth";
import {GeistSans} from "geist/font/sans";
import {ThemeProvider} from "next-themes";
import "./globals.css";
import Image from "next/image";

const defaultUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

export const metadata = {
    metadataBase: new URL(defaultUrl),
    title: "KMS",
    description: "Veracity Knowledge Management System",
};

function Header() {
    return (
        <nav className="flex items-center justify-between px-20 py-4">
            {/* Left side: Logo */}
            <div>
                <Image
                    src="/rb_1741.png" // Replace with your logo's path
                    alt="Company Logo"
                    width={70} // Set the width of the logo
                    height={70} // Set the height of the logo
                />
            </div>

            {/* Right side: Auth component */}
            <div className="ml-auto">
                <HeaderAuth/>
            </div>
        </nav>
    )
}

export default function RootLayout({children,}: { children: React.ReactNode; }) {
    return (
        <html lang="en" className={GeistSans.className} suppressHydrationWarning>
        <body>
        <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
        >
            <main className="">
                <div className="">
                    <Header/>
                    <div
                        // className="flex flex-col gap-20 max-w-7xl p-5"
                    >
                        {children}
                    </div>

                    <footer
                        className="w-full flex items-center justify-center border-t mx-auto text-center text-xs gap-8 py-16"
                    >
                        {/*<ThemeSwitcher/>*/}
                    </footer>
                </div>
            </main>
        </ThemeProvider>
        </body>
        </html>
    );
}
