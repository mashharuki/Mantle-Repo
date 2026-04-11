import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	output: "standalone",
	serverExternalPackages: [
		"@duckdb/node-api",
		"@duckdb/node-bindings",
		"@mastra/duckdb",
		"@libsql/client",
		"better-sqlite3",
	],
};

export default nextConfig;
