/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export for GitHub Pages (custom domain, so no basePath)
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
}

export default nextConfig
