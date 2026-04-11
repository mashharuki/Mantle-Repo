import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	output: "standalone",
	serverExternalPackages: [
		"@libsql/client",
		"better-sqlite3",
	],
};

export default nextConfig;
