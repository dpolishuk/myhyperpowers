import { promises as fs } from "fs";
import path from "path";

const SKILL_NAME_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_NAME_LENGTH = 64;

const SKILLS_DIR = path.join(process.cwd(), "skills");
const OUTPUT_DIR = path.join(process.cwd(), ".opencode", "skill");

const FRONTMATTER_REGEX = /^---\s*\n([\s\S]*?)\n---\s*\n?/;

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const parseFrontmatter = (content: string) => {
  const match = content.match(FRONTMATTER_REGEX);
  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const frontmatter: Record<string, string> = {};
  const lines = match[1].split(/\r?\n/);
  for (const line of lines) {
    const entry = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (!entry) {
      continue;
    }
    const [, key, value] = entry;
    frontmatter[key] = value.trim();
  }

  return {
    frontmatter,
    body: content.slice(match[0].length),
  };
};

const deriveDescription = (frontmatter: Record<string, string>, body: string) => {
  if (frontmatter.description) {
    return frontmatter.description.trim();
  }

  const headingMatch = body.match(/^#\s+(.+)$/m);
  return headingMatch ? headingMatch[1].trim() : "";
};

const normalizeBody = (body: string) => body.replace(/^\s+/, "");

const validateName = (name: string) => {
  if (!SKILL_NAME_REGEX.test(name)) {
    throw new Error(
      `Skill name "${name}" must match ${SKILL_NAME_REGEX.source}.`
    );
  }
  if (name.length > MAX_NAME_LENGTH) {
    throw new Error(`Skill name "${name}" must be <= ${MAX_NAME_LENGTH} characters.`);
  }
};

const collectSkills = async () => {
  const entries = await fs.readdir(SKILLS_DIR, { withFileTypes: true });
  const skillDirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const skills = [] as Array<{
    slug: string;
    description: string;
    body: string;
  }>;

  for (const dirName of skillDirs) {
    const skillPath = path.join(SKILLS_DIR, dirName);
    const skillFile = path.join(skillPath, "SKILL.md");
    const fallbackFile = path.join(skillPath, "skill.md");
    let fileToRead: string | null = null;

    if (await fileExists(skillFile)) {
      fileToRead = skillFile;
    } else if (await fileExists(fallbackFile)) {
      fileToRead = fallbackFile;
    }

    if (!fileToRead) {
      continue;
    }

    const content = await fs.readFile(fileToRead, "utf8");
    const { frontmatter, body } = parseFrontmatter(content);
    const slug = (frontmatter.name || dirName).trim();
    const description = deriveDescription(frontmatter, body);

    validateName(slug);
    if (!description) {
      throw new Error(`Skill "${slug}" is missing a description.`);
    }

    skills.push({
      slug,
      description,
      body: normalizeBody(body),
    });
  }

  return skills;
};

const writeSkills = async (skills: Array<{ slug: string; description: string; body: string }>) => {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  for (const skill of skills) {
    const skillDir = path.join(OUTPUT_DIR, skill.slug);
    await fs.mkdir(skillDir, { recursive: true });

    const output = [
      "---",
      `name: ${skill.slug}`,
      `description: ${skill.description}`,
      "---",
      "",
      skill.body,
    ].join("\n");

    await fs.writeFile(path.join(skillDir, "SKILL.md"), `${output}\n`, "utf8");
  }
};

const main = async () => {
  const skills = await collectSkills();
  await writeSkills(skills);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
