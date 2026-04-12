import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const spaceMono = localFont({
	src: [
		{ path: "../fonts/space-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
		{ path: "../fonts/space-mono-latin-700-normal.woff2", weight: "700", style: "normal" },
	],
	variable: "--font-space-mono",
});

export const metadata: Metadata = {
	title: "Mantle AI Agent",
	description:
		"AI Agent for Mantle Network — DeFi, contracts, portfolio analysis, and more.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="en"
			className={`${spaceMono.variable} dark h-full antialiased`}
		>
			<body className="min-h-full flex flex-col">{children}</body>
		</html>
	);
}
