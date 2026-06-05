/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        // Proxy Pexels video through our own domain to avoid CORS blocks.
        // Usage in code: src="/api/proxy-video"
        source: "/api/proxy-video",
        destination:
          "https://videos.pexels.com/video-files/34645692/14684158_2560_1440_30fps.mp4",
      },
    ];
  },
};

export default nextConfig;
