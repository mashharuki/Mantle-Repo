import { LocalFilesystem, Workspace } from "@mastra/core/workspace";
import { accessSync, constants } from "node:fs";
import path from "node:path";

const workspaceBasePath = path.resolve(process.cwd(), ".mastra-workspace");

// Prefer MASTRA_SKILLS_DIR env var; fall back to repo-relative path
const defaultSkillsPath = path.resolve(
	process.cwd(),
	"src/mastra/skills",
);
const configuredSkillsPath = process.env.MASTRA_SKILLS_DIR
	? path.resolve(process.env.MASTRA_SKILLS_DIR)
	: defaultSkillsPath;

function canAccessDir(p: string): boolean {
	try {
		accessSync(p, constants.R_OK | constants.X_OK);
		return true;
	} catch {
		return false;
	}
}

// Only register skills if the path is readable; suppress Mastra permission warnings
const skills = canAccessDir(configuredSkillsPath) ? [configuredSkillsPath] : [];
if (skills.length === 0) {
	console.warn(
		`[workspace] Skills path not accessible: ${configuredSkillsPath}. ` +
		"Set MASTRA_SKILLS_DIR to an absolute path to enable workspace skills.",
	);
}

export const mantleWorkspace = new Workspace({
	filesystem: new LocalFilesystem({
		basePath: workspaceBasePath,
	}),
	skills,
});
