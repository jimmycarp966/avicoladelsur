export const ERROR_CODES = {
  CFG_MISSING: "HARNESS_E_CFG_MISSING",
  BRANCH_PROTECTED: "HARNESS_E_BRANCH_PROTECTED",
  GUARDRAIL: "HARNESS_E_GUARDRAIL",
  QA_FAILED: "HARNESS_E_QA_FAILED",
  INTERNAL: "HARNESS_E_INTERNAL",
};

export const REQUIRED_PROFILE_TOP_LEVEL = [
  "version",
  "repo",
  "branches",
  "qa",
  "guardrails",
  "maintenance",
  "pr",
];

export const REQUIRED_PROFILE_FIELDS = [
  "repo.name",
  "repo.default_branch",
  "branches.prefix",
  "branches.mode",
  "qa.commands.lint",
  "qa.commands.typecheck",
  "qa.commands.test",
  "qa.commands.smoke",
  "guardrails.require_human_confirmation_for",
  "guardrails.blocked_command_patterns",
  "maintenance.schedule.type",
  "maintenance.schedule.day",
  "maintenance.schedule.time",
  "pr.required_checks",
];

export const REQUIRED_HARNESS_DOCS = [
  "docs/harness/README.md",
  "docs/harness/architecture.md",
  "docs/harness/guardrails.md",
  "docs/harness/script-contract.md",
  "docs/harness/flow.md",
  "docs/harness/troubleshooting.md",
  "docs/harness/maintenance.md",
];

export const MANDATORY_CONFIRMATION_AREAS = [
  "deploy",
  "irreversible",
  "secrets",
];

export const DANGEROUS_COMMAND_PATTERNS = [
  {
    type: "deploy",
    pattern:
      /\b(vercel|netlify|firebase deploy|kubectl apply|helm upgrade|terraform apply|supabase db push|npm(?:\.cmd)?\s+run\s+deploy)\b/i,
    remediation:
      "Deploy commands are blocked by default. Add explicit human confirmation flags.",
  },
  {
    type: "irreversible",
    pattern:
      /\b(git\s+reset\s+--hard|git\s+clean\s+-fdx?|rm\s+-rf|Remove-Item\s+-Recurse\s+-Force|del\s+\/f\s+\/q|drop\s+table|truncate\s+table)\b/i,
    remediation:
      "Irreversible commands are blocked by default. Use an explicit human confirmation flag.",
  },
  {
    type: "secrets",
    pattern:
      /\b(cat|type|Get-Content)\s+\.env|printenv|Get-ChildItem\s+Env:|env\b/i,
    remediation:
      "Secret discovery commands are blocked by default. Use an explicit human confirmation flag.",
  },
];

export const CRITICAL_CHECKS = ["config", "architecture", "qa", "security"];

