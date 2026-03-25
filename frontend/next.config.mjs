/** @type {import('next').NextConfig} */
const nextConfig = {
  // FCL (Flow Client Library) is incompatible with React StrictMode's
  // double-invoke pattern — currentUser.subscribe gets stuck at loggedIn:null.
  // This is a documented FCL limitation; disable StrictMode for FCL to work.
  reactStrictMode: false,
};

export default nextConfig;
