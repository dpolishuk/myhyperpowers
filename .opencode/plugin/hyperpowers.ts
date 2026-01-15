import { definePlugin } from "@opencode-ai/plugin";

const TEST_PATH_REGEX = /(\b__tests__\b|\btests?\b|\.spec\.|\.test\.|_spec\.|_test\.)/i;
const COMPLETION_REGEX = /\b(done|complete|completed|finished|ready|implemented|resolved)\b/i;

const SKILL_HINTS = [
  { pattern: /\bbrainstorm|idea|explore\b/i, skill: "brainstorming" },
  { pattern: /\bplan|roadmap|spec\b/i, skill: "writing-plans" },
  { pattern: /\bexecute|implement\b/i, skill: "executing-plans" },
  { pattern: /\breview\b/i, skill: "review-implementation" },
  { pattern: /\bbug|fix|error|failure\b/i, skill: "fixing-bugs" },
  { pattern: /\brefactor\b/i, skill: "refactoring-safely" },
  { pattern: /\btest\b/i, skill: "test-driven-development" },
  { pattern: /\bverify|verification\b/i, skill: "verification-before-completion" },
];

const extractText = (payload: unknown): string => {
  if (!payload) return "";
  if (typeof payload === "string") return payload;
  if (Array.isArray(payload)) {
    return payload.map((item) => extractText(item)).join(" ");
  }

  if (typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    return (
      extractText(record.text) ||
      extractText(record.prompt) ||
      extractText(record.message) ||
      extractText(record.content)
    );
  }

  return "";
};

const formatSkillSuggestions = (prompt: string): string[] => {
  const matches = SKILL_HINTS.filter((hint) => hint.pattern.test(prompt)).map(
    (hint) => hint.skill
  );
  return Array.from(new Set(matches));
};

export default definePlugin((client) => {
  const touchedFiles = new Set<string>();
  let touchedTests = false;
  let touchedSources = false;
  let didTddReminder = false;
  let didVerifyReminder = false;
  let didCommitReminder = false;

  client.on("file.edited", (event) => {
    const path =
      (event as { path?: string; file?: string; filepath?: string })?.path ||
      (event as { path?: string; file?: string; filepath?: string })?.file ||
      (event as { path?: string; file?: string; filepath?: string })?.filepath;

    if (!path) {
      return;
    }

    touchedFiles.add(path);
    if (TEST_PATH_REGEX.test(path)) {
      touchedTests = true;
    } else {
      touchedSources = true;
    }
  });

  client.on("prompt.submit", (event) => {
    const prompt = extractText(event);
    if (!prompt) {
      return;
    }

    const suggestions = formatSkillSuggestions(prompt);
    if (suggestions.length > 0) {
      client.app.log(
        `Skill suggestion: consider loading ${suggestions
          .map((skill) => `"${skill}"`)
          .join(", ")}.`
      );
    }
  });

  client.on("assistant.response", (event) => {
    const responseText = extractText(event);

    if (touchedSources && !touchedTests && !didTddReminder) {
      client.app.log("TDD reminder: add or update tests for recent changes.");
      didTddReminder = true;
    }

    if (touchedFiles.size > 5 && !didCommitReminder) {
      client.app.log("Consider committing your changes.");
      didCommitReminder = true;
    }

    if (responseText && COMPLETION_REGEX.test(responseText) && !didVerifyReminder) {
      client.app.log("Verification reminder: run checks before claiming completion.");
      didVerifyReminder = true;
    }
  });
});
