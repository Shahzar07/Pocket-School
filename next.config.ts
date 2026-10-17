import type {NextConfig} from 'next';
import { studioRedirects } from './lib/studio-paths';

const nextConfig: NextConfig = {
  async redirects() {
    return [...studioRedirects];
  },
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  output: 'standalone',
  serverExternalPackages: ['mammoth', 'unpdf', 'firebase-admin', 'web-push', 'sharp'],
  transpilePackages: ['motion'],
  webpack: (config, { dev }) => {
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = { ignored: /.*/ };
    }
    // Suppress protobufjs dynamic require warning (comes from Firebase gRPC)
    config.ignoreWarnings = [
      { module: /node_modules\/@protobufjs\/inquire/ },
    ];
    return config;
  },
};

export default nextConfig;
