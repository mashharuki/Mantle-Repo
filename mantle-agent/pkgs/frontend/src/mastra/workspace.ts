import { LocalFilesystem, Workspace } from "@mastra/core/workspace";
import { existsSync } from "node:fs";
import path from "node:path";

const workspaceBasePath = path.resolve(process.cwd(), ".mastra-workspace");
const defaultSkillsPath = path.resolve(process.cwd(), "../../../.claude/skills");
const configuredSkillsPath = process.env.MASTRA_SKILLS_DIR
	? path.resolve(process.env.MASTRA_SKILLS_DIR)
	: defaultSkillsPath;

const skills = existsSync(configuredSkillsPath) ? [configuredSkillsPath] : [];

export const mantleWorkspace = new Workspace({
	filesystem: new LocalFilesystem({
		basePath: workspaceBasePath,
	}),
	skills,
});
