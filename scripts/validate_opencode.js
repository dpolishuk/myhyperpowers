const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT_DIR = process.cwd();
const OPENCODE_DIR = path.join(ROOT_DIR, ".opencode");
const SKILLS_DIR = path.join(OPENCODE_DIR, "skill");
const COMMANDS_DIR = path.join(OPENCODE_DIR, "command");
const AGENTS_DIR = path.join(OPENCODE_DIR, "agent");
const PLUGIN_PATH = path.join(OPENCODE_DIR, "plugin", "hyperpowers.ts");

const SKILL_NAME_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const FRONTMATTER_REGEX = /^---\s*\n([\s\S]*?)\n---\s*\n?/;

const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const parseFrontmatter = (content) => {
  const match = content.match(FRONTMATTER_REGEX);
  if (!match) {
    return null;
  }

  const frontmatter = {};
  const lines = match[1].split(/\r?\n/);
  for (const line of lines) {
    const entry = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (!entry) {
      continue;
    }
    const [, key, value] = entry;
    frontmatter[key] = value.trim();
  }

  return frontmatter;
};

const collectErrors = (errors, message) => {
  errors.push(message);
};

const validateSkillFolders = async (errors) => {
  if (!(await fileExists(SKILLS_DIR))) {
    collectErrors(errors, `Missing skills directory: ${SKILLS_DIR}`);
    return;
  }

  const entries = await fs.readdir(SKILLS_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    if (!SKILL_NAME_REGEX.test(entry.name)) {
      collectErrors(
        errors,
        `Skill folder "${entry.name}" must match ${SKILL_NAME_REGEX.source}.`
      );
    }

    const skillFile = path.join(SKILLS_DIR, entry.name, "SKILL.md");
    if (!(await fileExists(skillFile))) {
      collectErrors(errors, `Skill "${entry.name}" is missing SKILL.md.`);
      continue;
    }

    const content = await fs.readFile(skillFile, "utf8");
    const frontmatter = parseFrontmatter(content);
    if (!frontmatter) {
      collectErrors(errors, `Skill "${entry.name}" is missing frontmatter.`);
      continue;
    }

    if (!frontmatter.name) {
      collectErrors(errors, `Skill "${entry.name}" frontmatter missing name.`);
    }

    if (!frontmatter.description) {
      collectErrors(errors, `Skill "${entry.name}" frontmatter missing description.`);
    }
  }
};

const validateFrontmatterFiles = async (
  errors,
  label,
  directory,
  requiredKeys
) => {
  if (!(await fileExists(directory))) {
    collectErrors(errors, `Missing ${label} directory: ${directory}`);
    return;
  }

  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) {
      continue;
    }

    const filePath = path.join(directory, entry.name);
    const content = await fs.readFile(filePath, "utf8");
    const frontmatter = parseFrontmatter(content);
    if (!frontmatter) {
      collectErrors(errors, `${label} "${entry.name}" is missing frontmatter.`);
      continue;
    }

    for (const key of requiredKeys) {
      if (!frontmatter[key]) {
        collectErrors(
          errors,
          `${label} "${entry.name}" frontmatter missing ${key}.`
        );
      }
    }
  }
};

const resolveTscPath = () => {
  const candidates = [
    path.join(ROOT_DIR, "node_modules", ".bin", "tsc"),
    path.join(OPENCODE_DIR, "node_modules", ".bin", "tsc"),
  ];

  return candidates.find((candidate) => fsSync.existsSync(candidate)) || null;
};

const validatePluginCompilation = (errors, warnings) => {
  if (!fsSync.existsSync(PLUGIN_PATH)) {
    collectErrors(errors, `Plugin file missing: ${PLUGIN_PATH}`);
    return;
  }

  const tscPath = resolveTscPath();
  const dependencyCandidates = [
    path.join(ROOT_DIR, "node_modules", "@opencode-ai", "plugin"),
    path.join(OPENCODE_DIR, "node_modules", "@opencode-ai", "plugin"),
  ];
  const dependencyInstalled = dependencyCandidates.some((candidate) =>
    fsSync.existsSync(candidate)
  );

  if (!tscPath || !dependencyInstalled) {
    warnings.push(
      "Skipping plugin compilation check (TypeScript dependencies not installed)."
    );
    return;
  }

  const result = spawnSync(tscPath, ["--noEmit", PLUGIN_PATH], {
    encoding: "utf8",
  });

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
    collectErrors(errors, `Plugin TypeScript check failed:\n${output}`);
  }
};

const reportResults = (errors, warnings) => {
  for (const warning of warnings) {
    console.warn(warning);
  }

  if (errors.length === 0) {
    console.log("OpenCode validation passed.");
    return;
  }

  console.error("OpenCode validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
};

const main = async () => {
  const errors = [];
  const warnings = [];

  await validateSkillFolders(errors);
  await validateFrontmatterFiles(errors, "Command", COMMANDS_DIR, ["description"]);
  await validateFrontmatterFiles(errors, "Agent", AGENTS_DIR, ["description", "mode"]);
  validatePluginCompilation(errors, warnings);

  reportResults(errors, warnings);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
