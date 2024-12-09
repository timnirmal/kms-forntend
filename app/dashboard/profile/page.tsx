'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { FiEdit2, FiSave, FiX } from 'react-icons/fi';
import { createClient } from "@/utils/supabase/client";
import { v4 as uuidv4 } from 'uuid';

interface EditableField {
    username: boolean;
}

interface CombinedUserData {
    id: string;
    email: string;
    username: string;
    avatar_url: string | null;
}

export default function Profile() {
    const supabase = createClient();
    const router = useRouter();

    const [combinedUserData, setCombinedUserData] = useState<CombinedUserData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [editing, setEditing] = useState<EditableField>({ username: false });
    const [formData, setFormData] = useState({ username: '' });

    useEffect(() => {
        const fetchUserData = async () => {
            setIsLoading(true);
            try {
                const { data: { user }, error: userError } = await supabase.auth.getUser();

                if (userError || !user) {
                    router.push("/sign-in");
                    return;
                }

                const { data: userProfile, error: profileError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                if (profileError) {
                    setError('Failed to load profile data.');
                    return;
                }

                const combinedData: CombinedUserData = {
                    id: user.id,
                    email: user.email,
                    username: userProfile.username,
                    avatar_url: userProfile.avatar_url,
                };

                setCombinedUserData(combinedData);
                setFormData({ username: combinedData.username });
            } catch (err) {
                console.error('Error fetching user data:', err);
                setError('An unexpected error occurred.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchUserData();
    }, [supabase, router]);

    const handleProfilePictureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!combinedUserData) return;
        if (!e.target.files || !e.target.files[0]) return;

        const file = e.target.files[0];
        if (!file.type.startsWith('image/')) {
            setError('Please select an image file');
            return;
        }

        setIsUploading(true);
        setError('');
        setSuccess('');

        try {
            const fileName = `${uuidv4()}.${file.name.split('.').pop()}`;
            const { data: storageData, error: storageError } = await supabase.storage
                .from('profile_images')
                .upload(fileName, file);

            if (storageError) {
                throw new Error(storageError.message);
            }

            const { data: publicUrlData } = supabase.storage
                .from('profile_images')
                .getPublicUrl(fileName);

            if (!publicUrlData.publicUrl) {
                throw new Error('Failed to retrieve public URL for the image.');
            }

            const { error: updateError } = await supabase
                .from('profiles')
                .update({ avatar_url: publicUrlData.publicUrl })
                .eq('id', combinedUserData.id);

            if (updateError) {
                throw new Error(updateError.message);
            }

            setCombinedUserData(prev => prev ? { ...prev, avatar_url: publicUrlData.publicUrl } : prev);
            setSuccess('Profile picture updated successfully');
        } catch (err) {
            console.error('Error uploading profile picture:', err);
            setError(err instanceof Error ? err.message : 'Failed to upload profile picture');
        } finally {
            setIsUploading(false);
        }
    };

    const handleUpdateUsername = async () => {
        if (!combinedUserData) return;

        try {
            setError('');
            setSuccess('');

            const { error } = await supabase
                .from('profiles')
                .update({ username: formData.username })
                .eq('id', combinedUserData.id);

            if (error) {
                throw new Error(error.message);
            }

            setCombinedUserData(prev => prev ? { ...prev, username: formData.username } : prev);
            setEditing({ username: false });
            setSuccess('Username updated successfully');
        } catch (err) {
            console.error('Update error:', err);
            setError(err instanceof Error ? err.message : 'Failed to update username');
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
            </div>
        );
    }

    if (!combinedUserData) {
        return (
            <div className="p-6">
                <p className="text-red-600">Failed to load user data.</p>
            </div>
        );
    }

    const profileImage = combinedUserData.avatar_url || '/default-avatar.png';

    return (
        <div className="p-6">
            <div className="max-w-2xl mx-auto bg-white dark:bg-zinc-800 rounded-xl shadow-lg p-6">
                <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Profile Settings</h1>

                {/* Profile Picture Section */}
                <div className="mb-6">
                    <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Profile Picture</h2>
                    <div className="flex items-center space-x-6">
                        <div className="relative w-24 h-24">
                            <Image
                                src={profileImage}
                                alt="Profile"
                                width={96}
                                height={96}
                                className="rounded-full object-cover"
                            />
                            {isUploading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col space-y-2">
                            <label className="relative cursor-pointer">
                                <span className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                                    Upload New Picture
                                </span>
                                <input
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleProfilePictureChange}
                                    disabled={isUploading}
                                />
                            </label>
                        </div>
                    </div>
                </div>

                {/* Username Field */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
                    <div className="flex items-center space-x-2">
                        {editing.username ? (
                            <>
                                <input
                                    type="text"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ username: e.target.value })}
                                    className="flex-1 p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white"
                                />
                                <button
                                    onClick={handleUpdateUsername}
                                    className="p-2 text-green-600 hover:text-green-700"
                                    title="Save"
                                >
                                    <FiSave size={20} />
                                </button>
                                <button
                                    onClick={() => setEditing({ username: false })}
                                    className="p-2 text-red-600 hover:text-red-700"
                                    title="Cancel"
                                >
                                    <FiX size={20} />
                                </button>
                            </>
                        ) : (
                            <>
                                <p className="flex-1 text-gray-900 dark:text-white">{combinedUserData.username}</p>
                                <button
                                    onClick={() => setEditing({ username: true })}
                                    className="p-2 text-blue-600 hover:text-blue-700"
                                    title="Edit"
                                >
                                    <FiEdit2 size={20} />
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Email Field */}
                <div className="mt-6">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                    <p className="text-gray-900 dark:text-white">{combinedUserData.email}</p>
                </div>
            </div>
        </div>
    );
}
