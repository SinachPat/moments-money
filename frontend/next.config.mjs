/** @type {import('next').NextConfig} */
const nextConfig = {
  // FCL (Flow Client Library) is incompatible with React StrictMode's
  // double-invoke pattern — currentUser.subscribe gets stuck at loggedIn:null.
  // This is a documented FCL limitation; disable StrictMode for FCL to work.
  reactStrictMode: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.dicebear.com",
      },
      // NBA Top Shot and other common NFT image CDNs
      {
        protocol: "https",
        hostname: "assets.nbatopshot.com",
      },
      {
        protocol: "https",
        hostname: "**.cdninstagram.com",
      },
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "**.ipfs.dweb.link",
      },
      {
        protocol: "https",
        hostname: "ipfs.io",
      },
    ],
  },
};

export default nextConfig;
