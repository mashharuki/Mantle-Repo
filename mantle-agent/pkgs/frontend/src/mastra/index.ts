import { Mastra } from "@mastra/core/mastra";
import { LibSQLStore } from "@mastra/libsql";
import { PinoLogger } from "@mastra/loggers";
import {
	CloudExporter,
	DefaultExporter,
	Observability,
	SensitiveDataFilter,
} from "@mastra/observability";
import { mantleAgent } from "./agents/mantle-agent";
import { mantleWorkspace } from "./workspace";

export const mastra = new Mastra({
	agents: { mantleAgent },
	workspace: mantleWorkspace,
	storage: new LibSQLStore({
		id: "mastra-storage",
		url: process.env.LIBSQL_URL ?? "file:./mastra.db",
		authToken: process.env.LIBSQL_AUTH_TOKEN,
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
