const build = process.env.VERCEL_GIT_COMMIT_SHA || "dev";

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: { NEXT_PUBLIC_BUILD: build },
  async headers() {
    return [
      { source: "/", headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }] },
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, must-revalidate" }] },
      { source: "/manifest.json", headers: [{ key: "Cache-Control", value: "no-cache, must-revalidate" }] },
    ];
  },
};

export default nextConfig;
