/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['../src'],
  experimental: {
    serverComponentsExternalPackages: ['@slack/web-api'],
  },
}

module.exports = nextConfig
