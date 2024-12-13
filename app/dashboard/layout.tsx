'use client';

import Link from "next/link";
import {FiHome, FiBell, FiSettings, FiUser, FiLogOut, FiCalendar, FiUpload, FiFolder, FiMessageSquare, FiPieChart} from 'react-icons/fi';
import {useEffect, useState} from "react";
import ThemeToggle from "@/components/ThemeToggle";
import {signOutAction} from "@/app/actions";
import {createClient} from "@/utils/supabase/client";
import {redirect} from "next/navigation";


export default function RootLayout({children,}: { children: React.ReactNode; }) {
    const supabase = createClient();

    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user }, error } = await supabase.auth.getUser();
            if (!user) {
                redirect("/sign-in");
                return;
            }

            setUser(user);

            const { data: userProfile, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (profileError) {
                console.error('Failed to fetch user profile:', profileError);
            } else {
                setProfile(userProfile);
            }
        };

        fetchUser();
    }, [supabase]);

    if (!user) {
        return null; // Or a loading spinner
    }

    return (
        <div className="">
            <div className="min-h-screen bg-gray-50 dark:bg-zinc-900">
                {/* Header */}
                <header className="fixed top-0 left-0 right-0 bg-white dark:bg-zinc-800 shadow-sm z-50">
                    <div className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center space-x-4">
                            <button
                                // onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                          d="M4 6h16M4 12h16M4 18h16"/>
                                </svg>
                            </button>
                        </div>

                        <div className="flex items-center space-x-4">
                            <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700 relative">
                                {/*<FiBell className="w-6 h-6"/>*/}
                                <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
                            </button>
                            <div className="flex items-center space-x-2">
                                <img
                                    src='/default-avatar.png'
                                    alt="Profile"
                                    width={32}
                                    height={32}
                                    className="rounded-full"
                                />
                                {/*<span className="font-medium">{user?.name}</span>*/}
                            </div>
                            <ThemeToggle />
                        </div>
                    </div>
                </header>

                {/* Sidebar */}
                <aside
                    className={`fixed left-0 top-16 bottom-0 w-64 bg-white dark:bg-zinc-800 shadow-lg transform transition-transform duration-200 ease-in-out ${
                        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
                >
                    <nav className="p-4 flex flex-col h-full">
                        <div className="space-y-2">
                            <Link href="/dashboard"
                                  className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700">
                                <FiHome className="w-5 h-5"/>
                                <span>Dashboard</span>
                            </Link>
                            <Link href="/dashboard/upload"
                                  className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700">
                                <FiUpload className="w-5 h-5"/>
                                <span>Upload</span>
                            </Link>
                            <Link href="/dashboard/calendar"
                                  className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700">
                                <FiCalendar className="w-5 h-5"/>
                                <span>Calendar</span>
                            </Link>
                            <Link href="/dashboard/workspaces"
                                  className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700">
                                <FiFolder className="w-5 h-5"/>
                                <span>Workspaces</span>
                            </Link>
                            <Link href="/dashboard/chat-history"
                                  className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700">
                                <FiMessageSquare className="w-5 h-5"/>
                                <span>Chat History</span>
                            </Link>
                            <Link href="/dashboard/analytics"
                                  className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700">
                                <FiPieChart className="w-5 h-5"/>
                                <span>Analytics</span>
                            </Link>
                        </div>

                        {/* Settings section at the bottom */}
                        <div className="mt-auto">
                            <div className="relative">
                                <button
                                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700"
                                >
                                    <div className="flex items-center space-x-3">
                                        <FiSettings className="w-5 h-5"/>
                                        <span>Settings</span>
                                    </div>
                                    <svg
                                        className={`w-4 h-4 transition-transform duration-200 ${isSettingsOpen ? 'rotate-180' : ''}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                              d="M19 9l-7 7-7-7"/>
                                    </svg>
                                </button>

                                {isSettingsOpen && (
                                    <div
                                        className="absolute bottom-full left-0 w-full mb-1 bg-white dark:bg-zinc-800 rounded-lg shadow-lg overflow-hidden">
                                        <div className="py-1">
                                            <Link href="/dashboard/profile"
                                                  className="flex items-center space-x-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-zinc-700">
                                                <FiUser className="w-5 h-5"/>
                                                <span>Profile</span>
                                            </Link>
                                            <button
                                                onClick={() => signOutAction()}
                                                className="w-full flex items-center space-x-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-zinc-700 text-red-500"
                                            >
                                                <FiLogOut className="w-5 h-5"/>
                                                <span>Sign Out</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </nav>
                </aside>

                {/* Main Content */}
                <main
                    className={`pt-24 ${isSidebarOpen ? 'ml-64 px-12' : 'ml-0'} transition-margin duration-200 ease-in-out`}>
                    {children}
                </main>
            </div>
        </div>
    );
}
