/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js 15+: top-level serverExternalPackages (Note: do not add packages here on exFAT filesystem as Turbopack creates symlinks)
  serverExternalPackages: ['multer'],

  // Turbopack config (default bundler in Next.js 16)
  turbopack: {
    resolveAlias: {
      // Prevent optional canvas dependency from being bundled (react-pdf peer dep)
      canvas: { browser: false },
    },
  },

  // Kept for `next build --webpack` fallback
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

module.exports = nextConfig;
