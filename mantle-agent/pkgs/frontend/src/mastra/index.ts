import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { LibSQLStore } from "@mastra/libsql";
import { DuckDBStore } from "@mastra/duckdb";
import { MastraCompositeStore } from "@mastra/core/storage";
import {
	Observability,
	DefaultExporter,
	CloudExporter,
	SensitiveDataFilter,
} from "@mastra/observability";
import { mantleAgent } from "./agents/mantle-agent";

export const mastra = new Mastra({
	agents: { mantleAgent },
	storage: new MastraCompositeStore({
		id: "composite-storage",
		default: new LibSQLStore({
			id: "mastra-storage",
			url: process.env.LIBSQL_URL ?? "file:./mastra.db",
			authToken: process.env.LIBSQL_AUTH_TOKEN,
		}),
		domains: {
			observability: await new DuckDBStore({ path: ":memory:" }).getStore("observability"),
		},
	}),
	logger: new PinoLogger({
		name: "Mastra",
		level: "info",
	}),
	observability: new Observability({
		configs: {
			default: {
				serviceName: "mantle-agent",
				exporters: [
					new DefaultExporter(), // Persists traces to storage for Mastra Studio
					new CloudExporter(), // Sends traces to Mastra Cloud (if MASTRA_CLOUD_ACCESS_TOKEN is set)
				],
				spanOutputProcessors: [
					new SensitiveDataFilter(), // Redacts sensitive data like passwords, tokens, keys
				],
			},
		},
	}),
});
