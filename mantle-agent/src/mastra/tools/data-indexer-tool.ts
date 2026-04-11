import { createTool } from "@mastra/core/tools";
import { z } from "zod";

type QueryType =
	| "wallet_swaps"
	| "pool_volume"
	| "wallet_activity"
	| "top_pools";

function buildGraphQLQuery(
	queryType: QueryType,
	params: {
		wallet?: string;
		poolId?: string;
		startUtc: string;
		endUtc: string;
		limit: number;
	},
): { query: string; variables: Record<string, unknown> } {
	const startTs = Math.floor(new Date(params.startUtc).getTime() / 1000);
	const endTs = Math.floor(new Date(params.endUtc).getTime() / 1000);

	switch (queryType) {
		case "wallet_swaps":
			return {
				query: `query WalletSwaps($wallet: String!, $startTs: Int!, $endTs: Int!, $first: Int!, $skip: Int!) {
  swaps(
    where: { trader: $wallet timestamp_gte: $startTs timestamp_lte: $endTs }
    orderBy: timestamp orderDirection: asc first: $first skip: 0
  ) { id txHash timestamp tokenIn tokenOut amountIn amountOut }
}`,
				variables: {
					wallet: params.wallet ?? "",
					startTs,
					endTs,
					first: params.limit,
					skip: 0,
				},
			};

		case "pool_volume":
			return {
				query: `query PoolDailyVolume($poolId: String!, $startDay: Int!, $endDay: Int!, $first: Int!, $skip: Int!) {
  poolDayDatas(
    where: { pool: $poolId date_gte: $startDay date_lte: $endDay }
    orderBy: date orderDirection: asc first: $first skip: 0
  ) { date volumeUSD txCount }
}`,
				variables: {
					poolId: params.poolId ?? "",
					startDay: Math.floor(startTs / 86400),
					endDay: Math.floor(endTs / 86400),
					first: params.limit,
					skip: 0,
				},
			};

		case "wallet_activity":
			return {
				query: `query WalletSwaps($wallet: String!, $startTs: Int!, $endTs: Int!, $first: Int!, $skip: Int!) {
  swaps(
    where: { trader: $wallet timestamp_gte: $startTs timestamp_lte: $endTs }
    orderBy: timestamp orderDirection: asc first: $first skip: 0
  ) { id txHash timestamp tokenIn tokenOut amountIn amountOut }
}`,
				variables: {
					wallet: params.wallet ?? "",
					startTs,
					endTs,
					first: params.limit,
					skip: 0,
				},
			};

		case "top_pools":
			return {
				query: `query TopPools($startTs: Int!, $endTs: Int!, $first: Int!) {
  poolDayDatas(
    where: { date_gte: $startTs date_lte: $endTs }
    orderBy: volumeUSD orderDirection: desc first: $first
  ) { pool { id } volumeUSD txCount }
}`,
				variables: { startTs, endTs, first: params.limit },
			};
	}
}

function buildSQLQuery(
	queryType: QueryType,
	params: {
		wallet?: string;
		poolId?: string;
		startUtc: string;
		endUtc: string;
		limit: number;
	},
): { query: string; sqlParams: Record<string, unknown> } {
	switch (queryType) {
		case "wallet_swaps":
		case "wallet_activity":
			return {
				query: `SELECT
  DATE_TRUNC('day', block_time) AS day_utc,
  COUNT(*) AS tx_count,
  SUM(amount_usd) AS volume_usd
FROM swaps
WHERE chain_id = 5000
  AND LOWER(wallet_address) = LOWER(:wallet)
  AND block_time >= :start_utc
  AND block_time < :end_utc
GROUP BY 1
ORDER BY 1 ASC
LIMIT :limit_n;`,
				sqlParams: {
					wallet: params.wallet ?? "",
					start_utc: params.startUtc,
					end_utc: params.endUtc,
					limit_n: params.limit,
				},
			};

		case "pool_volume":
			return {
				query: `SELECT
  DATE_TRUNC('day', block_time) AS day_utc,
  COUNT(*) AS tx_count,
  SUM(amount_usd) AS volume_usd
FROM swaps
WHERE chain_id = 5000
  AND LOWER(pool_address) = LOWER(:pool_id)
  AND block_time >= :start_utc
  AND block_time < :end_utc
GROUP BY 1
ORDER BY 1 ASC
LIMIT :limit_n;`,
				sqlParams: {
					pool_id: params.poolId ?? "",
					start_utc: params.startUtc,
					end_utc: params.endUtc,
					limit_n: params.limit,
				},
			};

		case "top_pools":
			return {
				query: `SELECT
  pool_address,
  SUM(amount_usd) AS volume_24h_usd,
  COUNT(*) AS swap_count
FROM swaps
WHERE chain_id = 5000
  AND block_time >= :window_start_utc
  AND block_time < :window_end_utc
GROUP BY pool_address
ORDER BY volume_24h_usd DESC
LIMIT :limit_n;`,
				sqlParams: {
					window_start_utc: params.startUtc,
					window_end_utc: params.endUtc,
					limit_n: params.limit,
				},
			};
	}
}

export const queryHistoricalData = createTool({
	id: "query-historical-data",
	description:
		"Generate and optionally execute historical data queries for Mantle DeFi activity. Supports wallet swap history, pool volume, wallet activity rollup, and top pools. Constructs GraphQL or SQL query templates from the reference library. If an endpoint is provided, executes the query; otherwise returns the template for manual execution.",
	inputSchema: z.object({
		queryType: z
			.enum(["wallet_swaps", "pool_volume", "wallet_activity", "top_pools"])
			.describe("Type of historical data to query"),
		wallet: z
			.string()
			.optional()
			.describe("Wallet address for wallet-scoped queries"),
		poolId: z
			.string()
			.optional()
			.describe("Pool address for pool-scoped queries"),
		startUtc: z
			.string()
			.describe("Query start time in ISO-8601 UTC (e.g. 2025-01-01T00:00:00Z)"),
		endUtc: z
			.string()
			.describe("Query end time in ISO-8601 UTC (e.g. 2025-01-31T23:59:59Z)"),
		limit: z.number().default(20).describe("Maximum number of rows to return"),
		endpoint: z
			.string()
			.optional()
			.describe(
				"Subgraph GraphQL or SQL indexer endpoint URL. If omitted, only the query template is returned.",
			),
		queryFormat: z
			.enum(["graphql", "sql"])
			.default("graphql")
			.describe("Query format to generate"),
	}),
	outputSchema: z.object({
		queryType: z.string(),
		queryFormat: z.string(),
		query: z.string(),
		variables: z.record(z.string(), z.unknown()).optional(),
		sqlParams: z.record(z.string(), z.unknown()).optional(),
		endpoint: z.string().optional(),
		executed: z.boolean(),
		results: z.unknown().optional(),
		resultCount: z.number().optional(),
		note: z.string(),
		qualityNotes: z.array(z.string()),
	}),
	execute: async (inputData) => {
		const queryType = inputData.queryType;
		const wallet = inputData.wallet;
		const poolId = inputData.poolId;
		const startUtc = inputData.startUtc;
		const endUtc = inputData.endUtc;
		const limit = inputData.limit ?? 20;
		const endpoint = inputData.endpoint;
		const queryFormat = inputData.queryFormat ?? "graphql";

		const queryParams = { wallet, poolId, startUtc, endUtc, limit };
		const qualityNotes: string[] = [
			"All timestamps are UTC.",
			"Amounts may be in raw token units — normalize using token decimals before display.",
			"Mantle chain ID used in SQL queries: 5000 (mainnet).",
		];

		if (queryFormat === "sql") {
			const { query, sqlParams } = buildSQLQuery(queryType, queryParams);

			if (!endpoint) {
				qualityNotes.push(
					"No endpoint provided. Execute this query against a Mantle SQL indexer. Ask the user for the endpoint URL.",
				);
				return {
					queryType,
					queryFormat: "sql",
					query,
					sqlParams,
					executed: false,
					note: "SQL query template generated. Provide an endpoint URL to execute it.",
					qualityNotes,
				};
			}

			try {
				const res = await fetch(endpoint, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ query, params: sqlParams }),
				});
				const data = (await res.json()) as {
					rows?: unknown[];
					data?: unknown[];
				};
				const rows = data.rows ?? data.data ?? [];
				qualityNotes.push(
					`Executed against ${endpoint}. Result count: ${Array.isArray(rows) ? rows.length : "unknown"}.`,
				);
				return {
					queryType,
					queryFormat: "sql",
					query,
					sqlParams,
					endpoint,
					executed: true,
					results: rows,
					resultCount: Array.isArray(rows) ? rows.length : undefined,
					note: "SQL query executed successfully.",
					qualityNotes,
				};
			} catch (e) {
				qualityNotes.push(
					`Execution failed: ${e instanceof Error ? e.message : String(e)}`,
				);
				return {
					queryType,
					queryFormat: "sql",
					query,
					sqlParams,
					endpoint,
					executed: false,
					note: `Query execution failed. Template is returned for manual use. Error: ${e instanceof Error ? e.message : String(e)}`,
					qualityNotes,
				};
			}
		}

		// GraphQL
		const { query, variables } = buildGraphQLQuery(queryType, queryParams);

		if (!endpoint) {
			qualityNotes.push(
				"No endpoint provided. Execute this query against a Mantle subgraph. Ask the user for the subgraph endpoint URL.",
			);
			return {
				queryType,
				queryFormat: "graphql",
				query,
				variables,
				executed: false,
				note: "GraphQL query template generated. Provide a subgraph endpoint URL to execute it.",
				qualityNotes,
			};
		}

		try {
			const res = await fetch(endpoint, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ query, variables }),
			});
			const json = (await res.json()) as { data?: unknown; errors?: unknown[] };
			if (json.errors?.length) {
				qualityNotes.push(
					`GraphQL errors returned: ${JSON.stringify(json.errors)}`,
				);
			}
			const results = json.data;
			const firstKey =
				results && typeof results === "object"
					? Object.values(results)[0]
					: null;
			const resultCount = Array.isArray(firstKey) ? firstKey.length : undefined;
			qualityNotes.push(`Executed against ${endpoint}.`);
			return {
				queryType,
				queryFormat: "graphql",
				query,
				variables,
				endpoint,
				executed: true,
				results,
				resultCount,
				note: "GraphQL query executed successfully.",
				qualityNotes,
			};
		} catch (e) {
			qualityNotes.push(
				`Execution failed: ${e instanceof Error ? e.message : String(e)}`,
			);
			return {
				queryType,
				queryFormat: "graphql",
				query,
				variables,
				endpoint,
				executed: false,
				note: `Query execution failed. Template is returned for manual use. Error: ${e instanceof Error ? e.message : String(e)}`,
				qualityNotes,
			};
		}
	},
});
