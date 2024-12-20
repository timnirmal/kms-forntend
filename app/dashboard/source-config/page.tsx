'use client';

import {useState} from 'react';
import {motion} from 'framer-motion';
import {FiBook, FiGitlab, FiGrid, FiClock} from 'react-icons/fi';

export default function SourceConfig() {
    const [activeTab, setActiveTab] = useState<'figma' | 'notion' | 'gitlab'>('figma');
    const [figmaUrl, setFigmaUrl] = useState(
        'https://www.figma.com/design/A6d9kZ7z0wnaNdxw3M6eNp/Spectrify---Veracity?node-id=0-1&p=f&t=3C318BXmmXs1WMdE-0'
    );

    return (
        <div className="p-6">
            <motion.div
                initial={{opacity: 0, y: 20}}
                animate={{opacity: 1, y: 0}}
                className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl p-8 mb-6"
            >
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    Source Integration
                </h1>
                <p className="text-gray-600 dark:text-gray-300">
                    Configure your external data sources
                </p>
            </motion.div>

            {/* Tabs */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl p-6">
                <div className="flex space-x-4 border-b border-gray-200 dark:border-gray-700 mb-6">
                    <button
                        onClick={() => setActiveTab('figma')}
                        className={`flex items-center space-x-2 pb-4 px-4 ${
                            activeTab === 'figma'
                                ? 'border-b-2 border-blue-500 text-blue-500'
                                : 'text-gray-500 dark:text-gray-400'
                        }`}
                    >
                        <FiGrid className="w-5 h-5"/>
                        <span>Figma Integration</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('notion')}
                        className={`flex items-center space-x-2 pb-4 px-4 ${
                            activeTab === 'notion'
                                ? 'border-b-2 border-blue-500 text-blue-500'
                                : 'text-gray-500 dark:text-gray-400'
                        }`}
                    >
                        <FiBook className="w-5 h-5"/>
                        <span>Notion Integration</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('gitlab')}
                        className={`flex items-center space-x-2 pb-4 px-4 opacity-60 cursor-not-allowed ${
                            activeTab === 'gitlab'
                                ? 'border-b-2 border-gray-400 text-gray-400'
                                : 'text-gray-400'
                        }`}
                    >
                        <FiGitlab className="w-5 h-5"/>
                        <span className="flex items-center space-x-2">
              <span>GitLab Integration</span>
              <span
                  className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-gray-300 rounded-full">
                <FiClock className="w-3 h-3 mr-1"/>
                Coming Soon
              </span>
            </span>
                    </button>
                </div>

                {/* Figma Config Content */}
                {activeTab === 'figma' && (
                    <motion.div
                        initial={{opacity: 0}}
                        animate={{opacity: 1}}
                        className="space-y-6"
                    >
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                File URL
                            </label>
                            <input
                                type="text"
                                placeholder="Enter the figma file link"
                                className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                API Token
                            </label>
                            <input
                                type="password"
                                placeholder="Enter your Figma API token"
                                className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Figma File Type
                            </label>
                            <select
                                className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="design">Design File</option>
                                <option value="board">Board</option>
                            </select>
                        </div>
                        <button
                            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                            Save and Connect
                        </button>
                    </motion.div>
                )}

                {/* Notion Integration Content */}
                {activeTab === 'notion' && (
                    <motion.div
                        initial={{opacity: 0}}
                        animate={{opacity: 1}}
                        className="space-y-6"
                    >
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Source Name
                            </label>
                            <input
                                type="text"
                                placeholder="Enter Notion source name"
                                className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Notion Access Token
                            </label>
                            <input
                                type="password"
                                placeholder="Enter your Notion access token"
                                className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <button
                            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                            Save and Connect
                        </button>
                    </motion.div>
                )}

                {/* Coming Soon Content */}
                {activeTab === 'gitlab' && (
                    <motion.div
                        initial={{opacity: 0}}
                        animate={{opacity: 1}}
                        className="text-center py-12"
                    >
                        <div
                            className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-zinc-700 mb-4">
                            <FiClock className="w-8 h-8 text-gray-500 dark:text-gray-400"/>
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                            Coming Soon
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                            We're working hard to bring you GitLab integration.
                            Stay tuned for updates!
                        </p>
                    </motion.div>
                )}
            </div>
        </div>
    );
} 