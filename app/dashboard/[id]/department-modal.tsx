'use client';

import { useState } from 'react';

interface DepartmentModalProps {
    onClose: () => void;
    onSelect: (dept: string) => void;
}

export default function DepartmentModal({ onClose, onSelect }: DepartmentModalProps) {
    const [selectedDept, setSelectedDept] = useState('');

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded p-6 w-[300px]">
                <h2 className="text-lg font-bold mb-4">Select Department</h2>
                <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    className="border border-gray-300 p-2 w-full mb-4 rounded"
                >
                    <option value="">--Select--</option>
                    <option value="Sales">Sales</option>
                    <option value="Engineering">Engineering</option>
                    <option value="AI">AI</option>
                </select>
                <div className="flex space-x-2 justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-300 rounded">
                        Cancel
                    </button>
                    <button
                        onClick={() => {
                            if (selectedDept) onSelect(selectedDept);
                        }}
                        className="px-4 py-2 bg-blue-500 text-white rounded"
                    >
                        Open Chat
                    </button>
                </div>
            </div>
        </div>
    );
}
