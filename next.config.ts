import type {NextConfig} from 'next';
import { studioRedirects } from './lib/studio-paths';

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
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
