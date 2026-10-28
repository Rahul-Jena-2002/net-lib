const path = require('path');

const isGithubPages = process.env.GITHUB_PAGES === 'true';

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(isGithubPages
    ? {
        output: 'export',
        basePath: '/net-lib',
        assetPrefix: '/net-lib/',
        images: { unoptimized: true },
      }
    : {}),
  serverExternalPackages: ['multer'],
  turbopack: {},
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    config.resolve.alias['@'] = path.resolve(__dirname, 'src');
    return config;
  },
};

module.exports = nextConfig;
