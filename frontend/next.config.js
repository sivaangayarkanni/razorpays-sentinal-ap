/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  async redirects() {
    return [{ source: "/playground", destination: "/integrate", permanent: true }];
  },
};

module.exports = nextConfig;
