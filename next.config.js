/** @type {import('next').NextConfig} */
const nextConfig = {};

module.exports = {
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'dewmqwriscxigmajdbrb.supabase.co',
                port: '',
                pathname: '/storage/v1/object/public/profile_images/**',
            },
        ],
    },
};
