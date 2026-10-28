const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['multer'],
  turbopack: {},
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    config.resolve.alias['@'] = path.resolve(__dirname, 'src');
    return config;
  },
};

module.exports = nextConfig;
