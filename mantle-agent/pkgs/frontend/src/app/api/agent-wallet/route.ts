import { getPublicClient, getAgentAddress } from "@/lib/viem-clients";
import { formatEther } from "viem";

export const runtime = "nodejs";

export async function GET(req: Request) {
	const { searchParams } = new URL(req.url);
	const network = (searchParams.get("network") ?? "sepolia") as
		| "mainnet"
		| "sepolia";

	if (!process.env.AGENT_PRIVATE_KEY) {
		return Response.json({ configured: false }, { status: 200 });
	}

	try {
		const address = getAgentAddress();
		const client = getPublicClient(network);
		const balanceWei = await client.getBalance({ address });
		const balanceMNT = formatEther(balanceWei);

		return Response.json({
			configured: true,
			address,
			balanceMNT,
			network,
		});
	} catch (e) {
		return Response.json(
			{ configured: false, error: e instanceof Error ? e.message : "unknown" },
			{ status: 500 },
		);
	}
}
