const fs = require('fs');
const path = './.pi/extensions/hyperpowers/index.ts';
let code = fs.readFileSync(path, 'utf8');

const toolCode = `
  // Brainstorm TUI Tool
  pi.registerTool({
    name: "update_brainstorm_state",
    label: "Brainstorm Dashboard",
    description: "Update the interactive Brainstorm Dashboard TUI with the current Epic state and ask the next multiple-choice question. Always use this instead of AskUserQuestion when brainstorming.",
    parameters: Type.Object({
      requirements: Type.Array(Type.String()),
      antiPatterns: Type.Array(Type.Object({
        pattern: Type.String(),
        reason: Type.String()
      })),
      researchFindings: Type.Array(Type.String()),
      openQuestions: Type.Array(Type.String()),
      history: Type.Array(Type.Object({
        role: Type.Union([Type.Literal("agent"), Type.Literal("user")]),
        content: Type.String()
      })),
      question: Type.Optional(Type.String({ description: "The next question to ask the user" })),
      options: Type.Optional(Type.Array(Type.Object({
        label: Type.String(),
        description: Type.Optional(Type.String())
      }))),
      priority: Type.Optional(Type.String({ description: "CRITICAL, IMPORTANT, or NICE_TO_HAVE" }))
    }),
    async execute(_toolCallId: string, params: any, _signal?: unknown, _update?: unknown, ctx?: any) {
      if (!ctx?.ui?.custom) {
        return "TUI not supported in this environment.";
      }
      const { BrainstormDashboard } = await import("./brainstorm-tui.js");
      
      const state = {
        requirements: params.requirements || [],
        antiPatterns: params.antiPatterns || [],
        researchFindings: params.researchFindings || [],
        openQuestions: params.openQuestions || [],
        history: params.history || []
      };
      
      if (params.question && params.options) {
        state.currentQuestion = {
          question: params.question,
          options: params.options,
          priority: params.priority || "IMPORTANT"
        };
      }

      return await new Promise<string>((resolve) => {
        let handle: any;
        const dashboard = new BrainstormDashboard(state);
        
        dashboard.onOptionSelect = (index) => {
          const selected = params.options[index].label;
          handle?.close();
          resolve(selected);
        };
        
        dashboard.onCancel = () => {
          handle?.close();
          resolve("User cancelled the question.");
        };
        
        handle = ctx.ui.custom(dashboard, { overlay: true });
      });
    }
  });
`;

code = code.replace('  // Register third-party plugins', toolCode + '\n  // Register third-party plugins');
fs.writeFileSync(path, code);
console.log('patched index.ts');
