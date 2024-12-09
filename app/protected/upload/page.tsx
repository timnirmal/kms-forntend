'use client';

import { useState, useEffect } from 'react';
import { FiUpload, FiLink, FiFileText, FiDownload, FiExternalLink, FiEye, FiTrash2 } from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import { HotTable } from '@handsontable/react';
import 'handsontable/dist/handsontable.full.css';
import {createClient} from "@/utils/supabase/client";

interface UploadedFile {
    content_type: string;
    id: number;
    file_name: string;
    file_path: string;
    file_type: string;
    file_size: number;
    created_at: string;
    user_email: string;
}

interface UploadedUrl {
    id: number;
    url: string;
    title: string | null;
    created_at: string;
}

interface UploadedText {
    id: number;
    title: string;
    content: string;
    created_at: string;
}

interface Uploads {
    files: UploadedFile[];
    urls: UploadedUrl[];
    texts: UploadedText[];
}

interface ViewerProps {
    file: UploadedFile;
    onClose: () => void;
}

const DocumentViewer = ({ file, onClose }: ViewerProps) => {
    const [excelData, setExcelData] = useState<any[] | null>(null);
    const [textContent, setTextContent] = useState<string | null>(null);

    useEffect(() => {
        const loadFileContent = async () => {
            try {
                if (file.file_type.includes('sheet') || file.file_type.includes('excel')) {
                    const response = await fetch(`/api/excel/preview?path=${encodeURIComponent(file.file_path)}`);
                    if (!response.ok) throw new Error('Failed to load Excel data');
                    const data = await response.json();
                    setExcelData(data);
                } else if (file.file_type.includes('text') || file.content_type === 'text') {
                    const response = await fetch(file.file_path);
                    if (!response.ok) throw new Error('Failed to load text content');
                    const content = await response.text();
                    setTextContent(content);
                }
            } catch (error) {
                console.error('Error loading file content:', error);
            }
        };

        loadFileContent();
    }, [file]);

    const getViewer = () => {
        const fileType = file.file_type.toLowerCase();
        const fileUrl = file.file_path;
        const fullUrl = window.location.origin + fileUrl;

        if (fileType.includes('pdf')) {
            return (
                <iframe
                    src={fullUrl}
                    className="w-full h-[80vh]"
                    title={file.file_name}
                />
            );
        }

        if (fileType.includes('sheet') || fileType.includes('excel')) {
            if (excelData) {
                return (
                    <div className="w-full h-[80vh] overflow-auto bg-white">
                        <HotTable
                            data={excelData}
                            rowHeaders={true}
                            colHeaders={true}
                            height="100%"
                            width="100%"
                            readOnly={true}
                            licenseKey="non-commercial-and-evaluation"
                            stretchH="all"
                            className="htDark"
                            settings={{
                                autoColumnSize: true,
                                autoRowSize: true,
                                manualColumnResize: true,
                                manualRowResize: true,
                            }}
                        />
                    </div>
                );
            }
            return <div className="text-center py-8">Loading spreadsheet...</div>;
        }

        if (fileType.includes('image')) {
            return (
                <div className="flex items-center justify-center h-[80vh] bg-gray-900">
                    <img
                        src={fileUrl}
                        alt={file.file_name}
                        className="max-h-full max-w-full object-contain"
                    />
                </div>
            );
        }

        if (fileType.includes('video')) {
            return (
                <div className="flex flex-col items-center justify-center h-[80vh] bg-gray-900">
                    <video
                        controls
                        className="max-h-[90%] max-w-full"
                        controlsList="nodownload"
                        style={{ boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}
                    >
                        <source src={fileUrl} type={file.file_type} />
                        Your browser does not support the video tag.
                    </video>
                    <div className="mt-4 text-sm text-gray-300">
                        {file.file_name}
                    </div>
                </div>
            );
        }

        if (fileType.includes('audio')) {
            return (
                <div className="flex flex-col items-center justify-center p-8 bg-gray-900 h-[80vh]">
                    <div className="w-full max-w-2xl p-6 bg-gray-800 rounded-lg shadow-lg">
                        <div className="mb-4 text-center text-white">
                            <h3 className="text-xl font-semibold mb-2">{file.file_name}</h3>
                        </div>
                        <audio
                            controls
                            className="w-full"
                            controlsList="nodownload"
                        >
                            <source src={fileUrl} type={file.file_type} />
                            Your browser does not support the audio tag.
                        </audio>
                    </div>
                </div>
            );
        }

        if (fileType.includes('text') || file.content_type === 'text') {
            if (textContent !== null) {
                return (
                    <div className="w-full h-[80vh] overflow-auto bg-gray-900 p-6">
            <pre className="text-gray-200 font-mono whitespace-pre-wrap">
              {textContent}
            </pre>
                    </div>
                );
            }
            return <div className="text-center py-8">Loading text content...</div>;
        }

        // For other document types (docx, pptx), still use Google Docs Viewer
        const googleDocsUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(fullUrl)}&embedded=true`;
        return (
            <iframe
                src={googleDocsUrl}
                className="w-full h-[80vh]"
                title={file.file_name}
            />
        );
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="max-w-7xl w-full bg-zinc-800 rounded-xl shadow-2xl overflow-hidden">
                <div className="flex justify-between items-center p-4 bg-zinc-700">
                    <h2 className="text-xl font-semibold text-white pr-8">{file.file_name}</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-300 hover:text-white text-xl"
                    >
                        ✕
                    </button>
                </div>
                <div>
                    {getViewer()}
                </div>
            </div>
        </div>
    );
};

const UploadPage = () => {
    const supabase = createClient();

    const router = useRouter();
    const [activeTab, setActiveTab] = useState('files');
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [files, setFiles] = useState<FileList | null>(null);
    const [urls, setUrls] = useState<string[]>(['']);
    const [textTitle, setTextTitle] = useState('');
    const [textContent, setTextContent] = useState('');
    const [uploads, setUploads] = useState<Uploads>({ files: [], urls: [], texts: [] });
    const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null);

    useEffect(() => {
        fetchUploads();
    }, []);

    const fetchUploads = async () => {
        try {
            const response = await fetch('/api/upload/list');
            if (!response.ok) {
                throw new Error('Failed to fetch uploads');
            }
            const data = await response.json();
            setUploads(data);
        } catch (err) {
            console.error('Error fetching uploads:', err);
        }
    };

    if (status === 'loading') {
        return (
            <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    const handleFileUpload = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!files || files.length === 0) {
            setError('Please select at least one file');
            return;
        }

        setError('');
        setSuccess('');
        setIsUploading(true);

        try {
            const formData = new FormData();
            Array.from(files).forEach(file => {
                formData.append('files[]', file); // Append each file to FormData
            });

            // Add department data if needed
            formData.append('department', 'AI');

            console.log('Files in FormData:', formData.getAll('files'));

            const response = await fetch('http://127.0.0.1:5000/upload', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to upload files');
            }

            const data = await response.json();
            console.log('Response data:', data);

            setSuccess(`Upload successful! Message: ${data.message || 'Files uploaded successfully.'}`);
            setFiles(null);

            // Reset file input
            const fileInput = document.getElementById('file-upload') as HTMLInputElement;
            if (fileInput) fileInput.value = '';
        } catch (err: any) {
            setError(err.message || 'Failed to upload files');
            console.error('Upload error:', err);
        } finally {
            setIsUploading(false);
        }
    };



    const handleUrlSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const validUrls = urls.filter(url => url.trim() !== ''); // Assuming 'urls' is an array of URL strings
        if (validUrls.length === 0) {
            setError('Please enter at least one valid URL');
            return;
        }

        setError('');
        setSuccess('');
        setIsUploading(true);

        try {
            const formData = new FormData();
            validUrls.forEach(url => {
                formData.append('urls[]', url);
            });
            formData.append('department', 'AI'); // Adding the department field as shown in Postman

            const response = await fetch('http://localhost:5000/upload', {
                method: 'POST',
                body: formData, // Sending formData instead of JSON
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to save URLs');
            }

            setSuccess('URLs saved successfully');
            setUrls(['']); // Reset the URL array
        } catch (err: any) {
            setError(err.message || 'Failed to save URLs');
            console.error('Upload error:', err);
        } finally {
            setIsUploading(false);
        }
    };


    const handleTextSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!textTitle.trim() || !textContent.trim()) {
            setError('Please enter both title and content');
            return;
        }

        setError('');
        setSuccess('');
        setIsUploading(true);

        try {
            const response = await fetch('/api/upload/text', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: textTitle,
                    content: textContent,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to save text');
            }

            setSuccess('Text saved successfully');
            setTextTitle('');
            setTextContent('');
        } catch (err: any) {
            setError(err.message || 'Failed to save text');
        } finally {
            setIsUploading(false);
        }
    };

    const addUrlField = () => {
        setUrls([...urls, '']);
    };

    const updateUrl = (index: number, value: string) => {
        const newUrls = [...urls];
        newUrls[index] = value;
        setUrls(newUrls);
    };

    const removeUrl = (index: number) => {
        const newUrls = urls.filter((_, i) => i !== index);
        setUrls(newUrls.length > 0 ? newUrls : ['']);
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getFileIcon = (fileType: string) => {
        if (fileType.includes('pdf')) return '📄';
        if (fileType.includes('image')) return '🖼️';
        if (fileType.includes('video')) return '🎥';
        if (fileType.includes('audio')) return '🎵';
        if (fileType.includes('word') || fileType.includes('document')) return '📝';
        if (fileType.includes('spreadsheet') || fileType.includes('excel')) return '📊';
        if (fileType.includes('presentation') || fileType.includes('powerpoint')) return '📽️';
        return '📁';
    };

    const handleRemove = async (fileId: number, type: 'file' | 'url' | 'text') => {
        try {
            const response = await fetch(`/api/upload/remove?id=${fileId}&type=${type}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error('Failed to remove item');
            }

            // Update UI by refetching the uploads
            fetchUploads();
        } catch (error) {
            console.error('Error removing item:', error);
            setError('Failed to remove item');
        }
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'files':
                return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {uploads.files.map((file) => (
                            <div
                                key={file.id}
                                className="bg-white dark:bg-zinc-800 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-200"
                            >
                                <div className="p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate" title={file.file_name}>
                                            {file.file_name}
                                        </h3>
                                    </div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                        {new Date(file.created_at).toLocaleDateString()}
                                    </p>
                                    <div className="flex justify-end items-center space-x-2">
                                        <button
                                            onClick={() => setSelectedFile(file)}
                                            className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/50 rounded-full transition-colors duration-200"
                                            title="View"
                                        >
                                            <FiEye size={18} />
                                        </button>
                                        <a
                                            href={file.file_path}
                                            download
                                            className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/50 rounded-full transition-colors duration-200"
                                            title="Download"
                                        >
                                            <FiDownload size={18} />
                                        </a>
                                        <button
                                            onClick={() => handleRemove(file.id, 'file')}
                                            className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50 rounded-full transition-colors duration-200"
                                            title="Remove"
                                        >
                                            <FiTrash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {uploads.files.length === 0 && (
                            <div className="col-span-full text-center py-8 text-gray-500 dark:text-gray-400">
                                No files uploaded yet
                            </div>
                        )}
                    </div>
                );

            case 'urls':
                return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {uploads.urls.map((url) => (
                            <div
                                key={url.id}
                                className="bg-white dark:bg-zinc-800 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-200"
                            >
                                <div className="p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate" title={url.url}>
                                            {url.url}
                                        </h3>
                                    </div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                        {new Date(url.created_at).toLocaleDateString()}
                                    </p>
                                    <div className="flex justify-end items-center space-x-2">
                                        <a
                                            href={url.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/50 rounded-full transition-colors duration-200"
                                            title="Open URL"
                                        >
                                            <FiExternalLink size={18} />
                                        </a>
                                        <button
                                            onClick={() => handleRemove(url.id, 'url')}
                                            className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50 rounded-full transition-colors duration-200"
                                            title="Remove"
                                        >
                                            <FiTrash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {uploads.urls.length === 0 && (
                            <div className="col-span-full text-center py-8 text-gray-500 dark:text-gray-400">
                                No URLs saved yet
                            </div>
                        )}
                    </div>
                );

            case 'text':
                return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {uploads.texts.map((text) => (
                            <div
                                key={text.id}
                                className="bg-white dark:bg-zinc-800 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-200"
                            >
                                <div className="p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate" title={text.title}>
                                            {text.title}
                                        </h3>
                                    </div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-4">
                                        {text.content}
                                    </p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                        {new Date(text.created_at).toLocaleDateString()}
                                    </p>
                                    <div className="flex justify-end items-center space-x-2">
                                        <button
                                            onClick={() => setSelectedFile({
                                                id: text.id,
                                                file_name: text.title,
                                                file_type: 'text/plain',
                                                file_path: '',
                                                file_size: text.content.length,
                                                created_at: text.created_at,
                                                user_id: 0,
                                                content_type: 'text',
                                                content: text.content
                                            })}
                                            className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/50 rounded-full transition-colors duration-200"
                                            title="View"
                                        >
                                            <FiEye size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleRemove(text.id, 'text')}
                                            className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50 rounded-full transition-colors duration-200"
                                            title="Remove"
                                        >
                                            <FiTrash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {uploads.texts.length === 0 && (
                            <div className="col-span-full text-center py-8 text-gray-500 dark:text-gray-400">
                                No text notes saved yet
                            </div>
                        )}
                    </div>
                );
        }
    };

    return (
        <div className="p-6">
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl p-6">
                <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">Upload Content</h1>

                {/* Tabs */}
                <div className="flex space-x-4 mb-6 border-b border-gray-200 dark:border-zinc-700">
                    <button
                        onClick={() => setActiveTab('files')}
                        className={`pb-2 px-4 ${
                            activeTab === 'files'
                                ? 'border-b-2 border-blue-500 text-blue-500'
                                : 'text-gray-500 dark:text-gray-400'
                        }`}
                    >
                        <div className="flex items-center space-x-2">
                            <FiUpload />
                            <span>Files</span>
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('urls')}
                        className={`pb-2 px-4 ${
                            activeTab === 'urls'
                                ? 'border-b-2 border-blue-500 text-blue-500'
                                : 'text-gray-500 dark:text-gray-400'
                        }`}
                    >
                        <div className="flex items-center space-x-2">
                            <FiLink />
                            <span>URLs</span>
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('text')}
                        className={`pb-2 px-4 ${
                            activeTab === 'text'
                                ? 'border-b-2 border-blue-500 text-blue-500'
                                : 'text-gray-500 dark:text-gray-400'
                        }`}
                    >
                        <div className="flex items-center space-x-2">
                            <FiFileText />
                            <span>Text</span>
                        </div>
                    </button>
                </div>

                {/* Error and Success Messages */}
                {error && (
                    <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">
                        {error}
                    </div>
                )}
                {success && (
                    <div className="mb-4 p-4 bg-green-100 text-green-700 rounded-lg">
                        {success}
                    </div>
                )}

                {/* File Upload Tab */}
                {activeTab === 'files' && (
                    <form onSubmit={handleFileUpload} className="space-y-4">
                        <div className="border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-lg p-8">
                            <input
                                type="file"
                                id="file-upload"
                                multiple
                                onChange={(e) => setFiles(e.target.files)}
                                className="hidden"
                                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.mp3,.mp4,.wav,.avi,.mov"
                            />
                            <label
                                htmlFor="file-upload"
                                className="flex flex-col items-center justify-center cursor-pointer"
                            >
                                <FiUpload className="w-12 h-12 text-gray-400 mb-4" />
                                <span className="text-gray-600 dark:text-gray-300">
                  Click to upload or drag and drop
                </span>
                                <span className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  Supported files: PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, MP3, MP4, etc.
                </span>
                            </label>
                        </div>
                        {files && files.length > 0 && (
                            <div className="mt-4">
                                <h3 className="font-medium mb-2">Selected Files:</h3>
                                <ul className="space-y-2">
                                    {Array.from(files).map((file, index) => (
                                        <li key={index} className="text-sm text-gray-600 dark:text-gray-300">
                                            {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={isUploading || !files}
                            className="w-full py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400"
                        >
                            {isUploading ? 'Uploading...' : 'Upload Files'}
                        </button>
                    </form>
                )}

                {/* URLs Tab */}
                {activeTab === 'urls' && (
                    <form onSubmit={handleUrlSubmit} className="space-y-4">
                        {urls.map((url, index) => (
                            <div key={index} className="flex space-x-2">
                                <input
                                    type="url"
                                    value={url}
                                    onChange={(e) => updateUrl(index, e.target.value)}
                                    placeholder="Enter URL"
                                    className="flex-1 p-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900"
                                />
                                <button
                                    type="button"
                                    onClick={() => removeUrl(index)}
                                    className="p-2 text-red-500 hover:text-red-700"
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={addUrlField}
                            className="text-blue-500 hover:text-blue-700"
                        >
                            + Add Another URL
                        </button>
                        <button
                            type="submit"
                            disabled={isUploading}
                            className="w-full py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400"
                        >
                            {isUploading ? 'Saving...' : 'Save URLs'}
                        </button>
                    </form>
                )}

                {/* Text Tab */}
                {activeTab === 'text' && (
                    <form onSubmit={handleTextSubmit} className="space-y-4">
                        <input
                            type="text"
                            value={textTitle}
                            onChange={(e) => setTextTitle(e.target.value)}
                            placeholder="Enter title"
                            className="w-full p-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900"
                        />
                        <textarea
                            value={textContent}
                            onChange={(e) => setTextContent(e.target.value)}
                            placeholder="Enter your text content"
                            rows={10}
                            className="w-full p-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900"
                        />
                        <button
                            type="submit"
                            disabled={isUploading}
                            className="w-full py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400"
                        >
                            {isUploading ? 'Saving...' : 'Save Text'}
                        </button>
                    </form>
                )}

                {/* Content Display */}
                <div className="mt-8">
                    <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                        {activeTab === 'files' && 'Uploaded Files'}
                        {activeTab === 'urls' && 'Saved URLs'}
                        {activeTab === 'text' && 'Text Notes'}
                    </h2>
                    {renderContent()}
                </div>

                {/* Document Viewer */}
                {selectedFile && (
                    <DocumentViewer
                        file={selectedFile}
                        onClose={() => setSelectedFile(null)}
                    />
                )}
            </div>
        </div>
    );
};

export default UploadPage;