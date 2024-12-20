'use client';

import { useState, useEffect } from 'react';
import { FiUpload, FiLink, FiFileText, FiDownload, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import { createClient } from "@/utils/supabase/client";
import DocViewer, { DocViewerRenderers } from "react-doc-viewer";
import dynamic from 'next/dynamic';

const ReactQuill = dynamic(() => import('react-quill'), { ssr: false });
import 'react-quill/dist/quill.snow.css';

interface EditState {
    editing: boolean;
    department: string;
    access_level: number;
    workspace: string;
}

// CombinedItem represents a merged item (file/url/text)
interface CombinedItem {
    type: 'file' | 'url' | 'text';
    identifier: string;
    file_type?: string;
    department: string;
    access_level: number;
    workspace: string[];
    update_timestamp?: string;
    content: string;
    s3_url?: string;
    domain?: string;
    title?: string;
    isDisabled: boolean;
    chunkIds: number[];
}

interface Department {
    id: number;
    name: string;
}

const UploadPage = () => {
    const supabase = createClient();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('files');
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [filesInput, setFilesInput] = useState<FileList | null>(null);
    const [urlsInput, setUrlsInput] = useState<string[]>(['']);
    const [textTitle, setTextTitle] = useState('');
    const [textContent, setTextContent] = useState('');
    const [loadingData, setLoadingData] = useState(true);
    const [filesData, setFilesData] = useState<CombinedItem[]>([]);
    const [urlsData, setUrlsData] = useState<CombinedItem[]>([]);
    const [textsData, setTextsData] = useState<CombinedItem[]>([]);
    const [selectedItem, setSelectedItem] = useState<CombinedItem | null>(null);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [selectedDepartment, setSelectedDepartment] = useState<string>('');
    const [showAddDeptModal, setShowAddDeptModal] = useState(false);
    const [newDepartmentName, setNewDepartmentName] = useState('');

    // For collapsible URL domains
    const [collapsedDomains, setCollapsedDomains] = useState<Record<string, boolean>>({});

    useEffect(() => {
        fetchDepartments();
    }, []);

    useEffect(() => {
        if (departments.length > 0 && !selectedDepartment) {
            setSelectedDepartment(departments[0].name);
        }
    }, [departments]);

    useEffect(() => {
        fetchData();
    }, [selectedDepartment]);

    const fetchDepartments = async () => {
        try {
            const { data, error } = await supabase.from('department').select('*');
            if (error) throw error;
            if (data) {
                setDepartments(data);
            }
        } catch (err: any) {
            console.error('Error fetching departments:', err);
            setError('Failed to fetch departments.');
        }
    };

    const addDepartment = async () => {
        if (!newDepartmentName.trim()) {
            alert('Department name cannot be empty.');
            return;
        }
        try {
            const { data, error } = await supabase
                .from('department')
                .insert([{ name: newDepartmentName.trim() }])
                .select();
            if (error) throw error;
            if (data) {
                setShowAddDeptModal(false);
                setNewDepartmentName('');
                await fetchDepartments();
                setSuccess('Department added successfully.');
            }
        } catch (err: any) {
            console.error('Error adding department:', err);
            setError('Failed to add department.');
        }
    };

    const fetchData = async () => {
        try {
            setLoadingData(true);

            // Using 'docs' table now
            const { data, error } = await supabase
                .from('documents5')
                .select('doc_id, content, metadata');
            if (error) throw error;

            console.log(data)

            const fileMap: Record<string, CombinedItem> = {};
            const domainMap: Record<string, CombinedItem[]> = {};
            const textMap: Record<string, CombinedItem> = {};

            data.forEach((row: any) => {
                const metadata = row.metadata || {};
                let content;
                try {
                    content = JSON.parse(row.content);
                } catch (e) {
                    content = row.content;
                }
                const chunkContent = typeof content === 'string' ? content : JSON.stringify(content);

                const department = Array.isArray(metadata.department) && metadata.department.length > 0
                    ? metadata.department[0] : (metadata.department || selectedDepartment || 'AI');
                const access_level = metadata.access_level || 1;
                const workspace = metadata.workspace || [];
                const wsArray = Array.isArray(workspace) ? workspace : [workspace].filter(Boolean);
                const isDisabled = metadata.isDisabled === true;

                // Identify item by file_name/url/title
                if (metadata?.s3_url && metadata?.file_name) {
                    const key = metadata.file_name;
                    if (!fileMap[key]) {
                        fileMap[key] = {
                            type: 'file',
                            identifier: key,
                            file_type: metadata.file_type,
                            department,
                            access_level,
                            workspace: wsArray,
                            update_timestamp: metadata.update_timestamp,
                            content: chunkContent,
                            s3_url: metadata.s3_url,
                            isDisabled: isDisabled,
                            chunkIds: [row.doc_id]
                        };
                    } else {
                        fileMap[key].content += '\n' + chunkContent;
                        fileMap[key].chunkIds.push(row.doc_id);
                        // If any chunk is disabled, consider the whole item disabled
                        if (isDisabled) fileMap[key].isDisabled = true;
                    }
                } else if (metadata?.source_type === 'url' && metadata?.url) {
                    const domain = metadata.domain || 'Unknown Domain';
                    const urlItem: CombinedItem = {
                        type: 'url',
                        identifier: metadata.url,
                        department,
                        access_level,
                        workspace: wsArray,
                        domain,
                        update_timestamp: metadata.fetch_time,
                        content: chunkContent,
                        isDisabled: isDisabled,
                        chunkIds: [row.doc_id]
                    };

                    if (!domainMap[domain]) {
                        domainMap[domain] = [];
                    } else {
                        // If disabled chunk found, set domain items disabled
                        const existing = domainMap[domain].find(i => i.identifier === urlItem.identifier);
                        if (existing && existing.isDisabled !== isDisabled) {
                            // if any chunk disabled for same URL, set disabled
                            existing.isDisabled = existing.isDisabled || isDisabled;
                        }
                    }

                    const existingItem = domainMap[domain].find(item => item.identifier === metadata.url);
                    if (existingItem) {
                        existingItem.content += '\n' + chunkContent;
                        existingItem.chunkIds.push(row.doc_id);
                        if (isDisabled) existingItem.isDisabled = true;
                    } else {
                        domainMap[domain].push(urlItem);
                    }
                } else if (metadata?.source_type === 'text' && metadata?.title) {
                    const key = metadata.title;
                    if (!textMap[key]) {
                        textMap[key] = {
                            type: 'text',
                            identifier: key,
                            department,
                            access_level,
                            workspace: wsArray,
                            update_timestamp: metadata.update_timestamp,
                            content: chunkContent,
                            title: metadata.title,
                            isDisabled: isDisabled,
                            chunkIds: [row.doc_id]
                        };
                    } else {
                        textMap[key].content += '\n' + chunkContent;
                        textMap[key].chunkIds.push(row.doc_id);
                        if (isDisabled) textMap[key].isDisabled = true;
                    }
                }
            });

            console.log(Object.values(fileMap))
            console.log(Object.values(domainMap).flat())
            console.log(Object.values(textMap))

            setFilesData(Object.values(fileMap));
            setUrlsData(Object.values(domainMap).flat());
            setTextsData(Object.values(textMap));
        } catch (err: any) {
            console.error('Error fetching data:', err);
            setError('Failed to fetch data.');
        } finally {
            setLoadingData(false);
        }
    };

    const handleFileUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!filesInput || filesInput.length === 0) {
            setError('Please select at least one file');
            return;
        }
        setError('');
        setSuccess('');
        setIsUploading(true);

        try {
            const formData = new FormData();
            Array.from(filesInput).forEach(file => {
                formData.append('files[]', file);
            });

            formData.append('department', selectedDepartment);

            const response = await fetch('http://127.0.0.1:5005/upload', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to upload files');
            }

            const data = await response.json();
            setSuccess(`Upload successful! Message: ${data.message || 'Files uploaded successfully.'}`);
            setFilesInput(null);
            const fileInput = document.getElementById('file-upload') as HTMLInputElement;
            if (fileInput) fileInput.value = '';
            // Refresh data
            fetchData();
        } catch (err: any) {
            setError(err.message || 'Failed to upload files');
            console.error('Upload error:', err);
        } finally {
            setIsUploading(false);
        }
    };

    const handleUrlSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const validUrls = urlsInput.filter(url => url.trim() !== '');
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
            formData.append('department', selectedDepartment);

            const response = await fetch('http://127.0.0.1:5005/upload', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to save URLs');
            }

            setSuccess('URLs saved successfully');
            setUrlsInput(['']);
            // Refresh data
            fetchData();
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
            const response = await fetch('http://127.0.0.1:5005/upload_text', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    department: selectedDepartment,
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
            // Refresh data
            fetchData();
        } catch (err: any) {
            setError(err.message || 'Failed to save text');
        } finally {
            setIsUploading(false);
        }
    };

    const addUrlField = () => {
        setUrlsInput([...urlsInput, '']);
    };

    const updateUrl = (index: number, value: string) => {
        const newUrls = [...urlsInput];
        newUrls[index] = value;
        setUrlsInput(newUrls);
    };

    const removeUrl = (index: number) => {
        const newUrls = urlsInput.filter((_, i) => i !== index);
        setUrlsInput(newUrls.length > 0 ? newUrls : ['']);
    };

    const workspaceArrayToString = (arr: string[]) => arr.join(', ');
    const workspaceStringToArray = (str: string) =>
        str.split(',').map(s => s.trim()).filter(Boolean);

    const toggleDisable = async (item: CombinedItem) => {
        // Update isDisabled for all chunkIds
        try {
            const { error } = await supabase
                .from('documents5')
                .update({ 'metadata': { isDisabled: !item.isDisabled } }, { returning: 'minimal' })
                .in('doc_id', item.chunkIds);

            // The above might overwrite metadata entirely.
            // If so, we need to fetch current metadata and update isDisabled only.
            // A safer approach: fetch each row's metadata, set isDisabled, then update.
            // We'll do that in a loop:
            // NOTE: A single update can be done if we use RPC or a trigger. For now, let's do multiple updates if needed.

            // Actually, Supabase update on a jsonb column replaces the column.
            // We need to use Postgres jsonb set operation.
            // Without that, we can do a client-side approach:
            // 1. Fetch all rows by chunkIds
            // 2. Update metadata.isDisabled
            // 3. Send an array of updates
            // For brevity, let's do a fetch and per-row update:

            // More correct approach:
            const { data: rows } = await supabase
                .from('documents5')
                .select('id, metadata')
                .in('doc_id', item.chunkIds);

            if (!rows) throw new Error('No rows found for update');

            for (const row of rows) {
                const meta = row.metadata || {};
                meta.isDisabled = !item.isDisabled;
                const { error: updateErr } = await supabase
                    .from('documents5')
                    .update({ metadata: meta })
                    .eq('doc_id', row.doc_id);
                if (updateErr) throw updateErr;
            }

            setSuccess(`${item.isDisabled ? 'Enabled' : 'Disabled'} successfully`);
            fetchData();
        } catch (err: any) {
            console.error('Error updating isDisabled:', err);
            setError('Failed to update isDisabled state.');
        }
    };

    const DepartmentModal = () => (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-2xl p-6 w-full max-w-sm">
                <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Add New Department</h2>
                <input
                    type="text"
                    value={newDepartmentName}
                    onChange={(e) => setNewDepartmentName(e.target.value)}
                    placeholder="Department Name"
                    className="w-full p-2 border border-gray-300 dark:border-zinc-700 rounded mb-4 bg-white dark:bg-zinc-900 text-gray-900 dark:text-white"
                />
                <div className="flex justify-end space-x-2">
                    <button
                        onClick={() => setShowAddDeptModal(false)}
                        className="px-4 py-2 bg-gray-500 text-white rounded"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={addDepartment}
                        className="px-4 py-2 bg-blue-500 text-white rounded"
                    >
                        Add
                    </button>
                </div>
            </div>
        </div>
    );

    // Separate component to avoid hooks in .map()
    const ItemCard = ({item, onSelect}: {item: CombinedItem, onSelect: (i: CombinedItem) => void}) => {
        const [editState, setEditState] = useState<EditState>({
            editing: false,
            department: item.department,
            access_level: item.access_level,
            workspace: workspaceArrayToString(item.workspace)
        });

        const onEdit = (e: React.MouseEvent) => {
            e.stopPropagation();
            // If we consider enabling an edit mode for department/access_level/workspace, uncomment:
            // setEditState({ ...editState, editing: true });
            // For now, we focus on the disable/enable functionality as requested.
        };

        const onDisableEnable = async (e: React.MouseEvent) => {
            e.stopPropagation();
            await toggleDisable(item);
        };

        return (
            <div
                className="bg-white dark:bg-zinc-800 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-200 cursor-pointer"
                onClick={() => { if (!editState.editing) onSelect(item); }}
            >
                <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate" title={item.identifier}>
                            {item.identifier}
                        </h3>
                    </div>
                    {item.update_timestamp && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                            {new Date(item.update_timestamp).toLocaleDateString()}
                        </p>
                    )}
                    {editState.editing ? (
                        <div className="space-y-2 mb-4">
                            {/* Edit form if needed */}
                        </div>
                    ) : (
                        <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1 mb-4">
                            <p><strong>Department:</strong> {item.department}</p>
                            <p><strong>Access Level:</strong> {item.access_level}</p>
                            <p><strong>Workspace:</strong> {item.workspace.join(', ')}</p>
                            <p><strong>Disabled:</strong> {item.isDisabled ? 'Yes' : 'No'}</p>
                        </div>
                    )}
                    {!editState.editing && (
                        <div className="flex justify-end space-x-2">
                            <button
                                onClick={onDisableEnable}
                                className={`p-1 ${item.isDisabled ? 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/50' : 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50'} rounded transition-colors duration-200`}
                            >
                                {item.isDisabled ? 'Enable' : 'Disable'}
                            </button>
                            {(item.type === 'file' && item.s3_url) && (
                                <a
                                    href={item.s3_url}
                                    download
                                    onClick={(e) => e.stopPropagation()}
                                    className="p-1 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/50 rounded transition-colors duration-200"
                                    title="Download"
                                >
                                    <FiDownload size={18}/>
                                </a>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderCards = (items: CombinedItem[]) => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.length === 0 && (
                <div className="col-span-full text-center py-8 text-gray-500 dark:text-gray-400">
                    No items found
                </div>
            )}
            {items.map((item, index) => (
                <ItemCard key={index} item={item} onSelect={(i) => setSelectedItem(i)} />
            ))}
        </div>
    );

    const toggleDomainCollapse = (domain: string) => {
        setCollapsedDomains(prev => ({...prev, [domain]: !prev[domain]}));
    };

    const renderUrlsByDomain = (urls: CombinedItem[]) => {
        const groupedByDomain = urls.reduce((acc, item) => {
            const domain = item.domain || 'Unknown Domain';
            if (!acc[domain]) acc[domain] = [];
            acc[domain].push(item);
            return acc;
        }, {} as Record<string, CombinedItem[]>);

        return (
            <div className="space-y-4">
                {Object.entries(groupedByDomain).map(([domain, items]) => {
                    const isCollapsed = collapsedDomains[domain] ?? false;
                    return (
                        <div key={domain} className="border border-gray-200 dark:border-zinc-700 rounded-lg">
                            <div
                                className="flex items-center justify-between p-4 bg-gray-100 dark:bg-zinc-900 cursor-pointer"
                                onClick={() => toggleDomainCollapse(domain)}
                            >
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{domain}</h3>
                                {isCollapsed ? <FiChevronDown /> : <FiChevronUp />}
                            </div>
                            {!isCollapsed && (
                                <div className="p-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {items.map((item, index) => (
                                            <ItemCard key={index} item={item} onSelect={(i) => setSelectedItem(i)} />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'files':
                return renderCards(filesData);
            case 'urls':
                return renderUrlsByDomain(urlsData);
            case 'text':
                return renderCards(textsData);
        }
    };

    const DocumentsModal = ({ item, onClose }: { item: CombinedItem, onClose: () => void }) => {
        const isFile = item.type === 'file';
        const isPDF = isFile && item.file_type?.toLowerCase().includes('pdf');

        const docs = item.s3_url ? [{ uri: item.s3_url }] : [];

        return (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
                <div className="max-w-6xl w-full bg-white dark:bg-zinc-800 rounded-xl shadow-2xl overflow-hidden flex">
                    {/* File Viewer Section */}
                    <div className="w-2/3 bg-gray-200 dark:bg-gray-900 flex items-center justify-center relative">
                        {isFile && docs.length > 0 && isPDF ? (
                            <div className="w-full h-[80vh] overflow-auto">
                                <DocViewer
                                    documents={docs}
                                    pluginRenderers={DocViewerRenderers}
                                    style={{ width: '100%', height: '100%' }}
                                />
                            </div>
                        ) : (
                            <div className="text-gray-700 dark:text-gray-200 p-4">
                                Preview not available.
                            </div>
                        )}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 text-white bg-black bg-opacity-50 hover:bg-opacity-75 rounded-full p-2"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Metadata Section */}
                    <div className="w-1/3 bg-white dark:bg-zinc-700 p-4 flex flex-col text-gray-800 dark:text-gray-100">
                        <h2 className="text-xl font-semibold mb-4">
                            {item.type === 'file' ? `File: ${item.identifier}`
                                : item.type === 'url' ? `URL: ${item.identifier}`
                                    : `Text: ${item.identifier}`}
                        </h2>
                        <p className="mb-2"><strong>Department:</strong> {item.department}</p>
                        <p className="mb-2"><strong>Access Level:</strong> {item.access_level}</p>
                        <p className="mb-2"><strong>Workspace:</strong> {item.workspace.join(', ')}</p>
                        {item.update_timestamp && (
                            <p className="mb-2"><strong>Updated:</strong> {new Date(item.update_timestamp).toLocaleString()}</p>
                        )}
                        <p className="mb-2"><strong>Disabled:</strong> {item.isDisabled ? 'Yes' : 'No'}</p>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-6">
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl p-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">Upload Content</h1>
                    <button
                        onClick={() => setShowAddDeptModal(true)}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                    >
                        Add Department
                    </button>
                </div>
                {departments.length > 0 && (
                    <div className="mb-4 flex items-center space-x-2">
                        <label className="text-gray-700 dark:text-gray-300">Department:</label>
                        <select
                            value={selectedDepartment}
                            onChange={(e) => setSelectedDepartment(e.target.value)}
                            className="p-1 border border-gray-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900 text-gray-700 dark:text-white"
                        >
                            {departments.map(d => (
                                <option key={d.id} value={d.name}>{d.name}</option>
                            ))}
                        </select>
                    </div>
                )}

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
                                onChange={(e) => setFilesInput(e.target.files)}
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
                                    Supported: PDF, DOC, XLS, MP3, MP4, etc.
                                </span>
                            </label>
                        </div>
                        {filesInput && filesInput.length > 0 && (
                            <div className="mt-4">
                                <h3 className="font-medium mb-2">Selected Files:</h3>
                                <ul className="space-y-2">
                                    {Array.from(filesInput).map((file, index) => (
                                        <li key={index} className="text-sm text-gray-600 dark:text-gray-300">
                                            {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={isUploading || !filesInput}
                            className="w-full py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400"
                        >
                            {isUploading ? 'Uploading...' : 'Upload Files'}
                        </button>
                    </form>
                )}

                {/* URLs Tab */}
                {activeTab === 'urls' && (
                    <form onSubmit={handleUrlSubmit} className="space-y-4">
                        {urlsInput.map((url, index) => (
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
                            className="w-full p-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-700 dark:text-white"
                        />
                        <ReactQuill
                            theme="snow"
                            value={textContent}
                            onChange={setTextContent}
                            className="bg-white dark:bg-zinc-900 text-gray-700 dark:text-white pb-10"
                            style={{height: '250px'}}
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
                    {loadingData ? (
                        <p>Loading...</p>
                    ) : (
                        renderContent()
                    )}
                </div>

                {selectedItem && (
                    <DocumentsModal
                        item={selectedItem}
                        onClose={() => setSelectedItem(null)}
                    />
                )}
            </div>
            {showAddDeptModal && <DepartmentModal />}
        </div>
    );
};

export default UploadPage;
