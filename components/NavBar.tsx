import Image from "next/image";
import HeaderAuth from "@/components/header-auth";
import ThemeToggle from "@/components/ThemeToggle";

function NavBar() {
    return (
        <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-gray-200 dark:border-zinc-800">
            {/* Left side: Logo */}
            <div className="flex items-center gap-4">
                {/*<Image*/}
                {/*    src="/rb_1741.png" // Replace with your logo's path*/}
                {/*    alt="Company Logo"*/}
                {/*    width={50} // Adjusted width for styling*/}
                {/*    height={50} // Adjusted height for styling*/}
                {/*    className="rounded-md"*/}
                {/*/>*/}
                <a href="/">
                <span className="text-xl font-semibold text-gray-700 dark:text-white">
                    Company Name
                </span>
                </a>
            </div>

            {/* Right side: Auth component and Theme Toggle */}
            <div className="flex items-center gap-6 ml-auto">
                <ThemeToggle />
                <HeaderAuth />
            </div>
        </nav>
    );
}

export default NavBar;
