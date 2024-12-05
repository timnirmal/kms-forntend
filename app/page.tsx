import { FaLightbulb, FaUsers, FaChartLine, FaUpload, FaLanguage, FaChartBar, FaSearch, FaLinkedin, FaTwitter } from 'react-icons/fa';
import Link from 'next/link';
import Image from 'next/image';
import AnimatedSection from '@/components/AnimatedSection';

export default function Home() {
    return (
        <main className="flex flex-col items-center">
            {/* Hero Section - UPDATED WITH NEW SIGN IN/UP BUTTONS */}
            <section className="w-full min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-zinc-200 to-white dark:from-zinc-900 dark:to-black px-4">
                <AnimatedSection className="max-w-6xl mx-auto text-center">
                    <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
                        Transform Knowledge into Action
                    </h1>
                    <p className="text-xl md:text-2xl mb-8 text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
                        Empower your teams, streamline workflows, and unlock your organization's full potential with AI-powered knowledge management.
                    </p>
                    {/* UPDATED BUTTONS */}
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link
                            href="/sign-in"
                            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                        >
                            Sign In
                        </Link>
                        <Link
                            href="/sign-up"
                            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-blue-600 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                        >
                            Sign Up
                        </Link>
                    </div>
                </AnimatedSection>
            </section>

            {/* Value Proposition */}
            <section className="w-full py-20 bg-white dark:bg-black px-4">
                <AnimatedSection className="max-w-6xl mx-auto">
                    <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">Why Choose Our Platform?</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            { icon: <FaLightbulb className="w-8 h-8" />, title: "Organize", desc: "Effortlessly structure and connect your knowledge." },
                            { icon: <FaUsers className="w-8 h-8" />, title: "Collaborate", desc: "Seamless collaboration across teams, in real-time." },
                            { icon: <FaChartLine className="w-8 h-8" />, title: "Visualize", desc: "Intuitive knowledge maps and dynamic dashboards for insights." }
                        ].map((item, i) => (
                            <div key={i} className="text-center p-6 rounded-xl bg-gray-50 dark:bg-zinc-800">
                                <div className="inline-block p-4 bg-blue-100 dark:bg-blue-900 rounded-full mb-4 text-blue-600 dark:text-blue-400">
                                    {item.icon}
                                </div>
                                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                                <p className="text-gray-600 dark:text-gray-300">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </AnimatedSection>
            </section>

            {/* Features */}
            <section id="features" className="w-full py-20 bg-gray-50 dark:bg-zinc-900 px-4">
                <AnimatedSection className="max-w-6xl mx-auto">
                    <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">AI-Powered Knowledge Management</h2>
                    <p className="text-center text-gray-600 dark:text-gray-300 mb-16 max-w-3xl mx-auto">
                        Experience the future of knowledge management with our cutting-edge AI integration.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {[
                            { icon: <FaUpload />, title: "Smart Upload", desc: "Drag-and-drop document uploads with intelligent tagging" },
                            { icon: <FaLanguage />, title: "Multi-language", desc: "Multi-language support for diverse global teams" },
                            { icon: <FaChartBar />, title: "Analytics", desc: "Real-time analytics to track knowledge utilization" },
                            { icon: <FaSearch />, title: "Smart Search", desc: "Search functionality for efficient knowledge retrieval" }
                        ].map((feature, i) => (
                            <div key={i} className="p-6 bg-white dark:bg-zinc-800 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
                                <div className="text-blue-600 dark:text-blue-400 mb-4 text-2xl">
                                    {feature.icon}
                                </div>
                                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                                <p className="text-gray-600 dark:text-gray-400">{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </AnimatedSection>
            </section>

            {/* Email Capture */}
            <section className="w-full py-20 bg-white dark:bg-black px-4">
                <AnimatedSection className="max-w-4xl mx-auto text-center">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">Join the Knowledge Revolution!</h2>
                    <p className="text-gray-600 dark:text-gray-300 mb-8">Get early access to our platform and transform your organization.</p>
                    <form className="max-w-md mx-auto mb-8">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <input
                                type="email"
                                placeholder="Enter your email"
                                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-blue-500"
                            />
                            <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                                Get Early Access
                            </button>
                        </div>
                    </form>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Cancel Anytime. No Credit Card Required.</p>
                </AnimatedSection>
            </section>

            {/* Testimonials */}
            <section className="w-full py-20 bg-gray-50 dark:bg-zinc-900 px-4">
                <AnimatedSection className="max-w-6xl mx-auto">
                    <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">What Our Users Say</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {[
                            {
                                quote: "Improved our document search efficiency by 70%. Game-changing platform!",
                                author: "Sarah Johnson",
                                role: "Knowledge Manager",
                                company: "Tech Corp"
                            },
                            {
                                quote: "The AI-powered features have transformed how we manage our knowledge base.",
                                author: "Michael Chen",
                                role: "CTO",
                                company: "Innovation Labs"
                            },
                            {
                                quote: "Seamless integration and intuitive interface. Exactly what we needed.",
                                author: "Emily Rodriguez",
                                role: "Team Lead",
                                company: "Global Solutions"
                            },
                            {
                                quote: "Outstanding support and continuous improvements. Highly recommended!",
                                author: "David Kim",
                                role: "Operations Director",
                                company: "Future Systems"
                            }
                        ].map((testimonial, i) => (
                            <div key={i} className="p-6 bg-white dark:bg-zinc-800 rounded-xl shadow-lg">
                                <p className="text-gray-600 dark:text-gray-300 mb-4">"{testimonial.quote}"</p>
                                <div>
                                    <p className="font-semibold">{testimonial.author}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{testimonial.role}, {testimonial.company}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </AnimatedSection>
            </section>

            {/* Contact */}
            <section className="w-full py-20 bg-white dark:bg-black px-4">
                <AnimatedSection className="max-w-4xl mx-auto">
                    <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">We're Here to Help!</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        <form className="space-y-6">
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                                <input
                                    type="text"
                                    id="name"
                                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                                <input
                                    type="email"
                                    id="email"
                                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label htmlFor="message" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Message</label>
                                <textarea
                                    id="message"
                                    rows={4}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-blue-500"
                                ></textarea>
                            </div>
                            <button className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                                Send Message
                            </button>
                        </form>
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-xl font-semibold mb-2">Contact Information</h3>
                                <p className="text-gray-600 dark:text-gray-300">Email: support@kmsplatform.com</p>
                                <p className="text-gray-600 dark:text-gray-300">Phone: +94 12345678</p>
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold mb-2">Follow Us</h3>
                                <div className="flex space-x-4">
                                    <a href="#" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
                                        <FaLinkedin className="w-6 h-6" />
                                    </a>
                                    <a href="#" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
                                        <FaTwitter className="w-6 h-6" />
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </AnimatedSection>
            </section>

            {/* Footer */}
            <footer className="w-full py-12 bg-gray-100 dark:bg-zinc-900 px-4">
                <div className="max-w-6xl mx-auto">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                        <div>
                            <h3 className="font-semibold mb-4">Product</h3>
                            <ul className="space-y-2">
                                <li><a href="#features" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">Features</a></li>
                                <li><a href="#" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">Pricing</a></li>
                                <li><a href="#" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">FAQ</a></li>
                            </ul>
                        </div>
                        <div>
                            <h3 className="font-semibold mb-4">Company</h3>
                            <ul className="space-y-2">
                                <li><a href="#" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">About</a></li>
                                <li><a href="#" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">Blog</a></li>
                                <li><a href="#" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">Careers</a></li>
                            </ul>
                        </div>
                        <div>
                            <h3 className="font-semibold mb-4">Legal</h3>
                            <ul className="space-y-2">
                                <li><a href="#" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">Privacy</a></li>
                                <li><a href="#" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">Terms</a></li>
                                <li><a href="#" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">Security</a></li>
                            </ul>
                        </div>
                        <div>
                            <h3 className="font-semibold mb-4">Support</h3>
                            <ul className="space-y-2">
                                <li><a href="#" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">Help Center</a></li>
                                <li><a href="#" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">Contact</a></li>
                                <li><a href="#" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">Status</a></li>
                            </ul>
                        </div>
                    </div>
                    <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-center text-gray-600 dark:text-gray-400">© 2024 Veracity Group. All rights reserved.</p>
                    </div>
                </div>
            </footer>
        </main>
    );
}