import type { WebMcpTool } from "@/lib/webmcp/tool-catalog";

type AnyFn = (...args: unknown[]) => unknown | Promise<unknown>;

interface RegisterToolObjectPayload {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input?: unknown) => Promise<unknown>;
}

interface RegisterCarrier {
  registerTool?: AnyFn;
}

interface RegisterWindow extends Window {
  modelContext?: RegisterCarrier;
  webmcp?: RegisterCarrier;
  mcpb?: RegisterCarrier;
  registerTool?: AnyFn;
  __AVICOLA_WEBMCP_REGISTERED__?: Set<string>;
}

function resolveRegisterTool(): AnyFn | null {
  if (typeof window === "undefined") return null;

  const currentNavigator = navigator as Navigator & { modelContext?: RegisterCarrier };
  const currentWindow = window as RegisterWindow;
  const candidates: Array<{ owner: unknown; fn: unknown }> = [
    { owner: currentNavigator.modelContext, fn: currentNavigator.modelContext?.registerTool },
    { owner: currentWindow.modelContext, fn: currentWindow.modelContext?.registerTool },
    { owner: currentWindow.webmcp, fn: currentWindow.webmcp?.registerTool },
    { owner: currentWindow.mcpb, fn: currentWindow.mcpb?.registerTool },
    { owner: currentWindow, fn: currentWindow.registerTool },
  ];

  for (const candidate of candidates) {
    if (typeof candidate.fn === "function") {
      const register = candidate.fn as AnyFn;
      return candidate.owner ? register.bind(candidate.owner) : register;
    }
  }

  return null;
}

function getRegistrySet(): Set<string> {
  if (typeof window === "undefined") return new Set<string>();
  const currentWindow = window as RegisterWindow;
  if (!currentWindow.__AVICOLA_WEBMCP_REGISTERED__) {
    currentWindow.__AVICOLA_WEBMCP_REGISTERED__ = new Set<string>();
  }
  return currentWindow.__AVICOLA_WEBMCP_REGISTERED__;
}

async function callRegisterTool(
  registerTool: AnyFn,
  payload: RegisterToolObjectPayload,
): Promise<void> {
  try {
    await registerTool(payload);
    return;
  } catch {
    await registerTool(payload.name, payload.description, payload.inputSchema, payload.execute);
  }
}

export function isWebMcpRuntimeAvailable(): boolean {
  return !!resolveRegisterTool();
}

export async function registerWebMcpTools(args: {
  tools: WebMcpTool[];
  onNavigate: (path: string) => void;
  onExecuteApiTool: (toolId: string, input: unknown) => Promise<unknown>;
}): Promise<{ registered: number; skipped: number }> {
  const registerTool = resolveRegisterTool();
  if (!registerTool) {
    return { registered: 0, skipped: args.tools.length };
  }

  let registered = 0;
  let skipped = 0;
  const registry = getRegistrySet();

  for (const tool of args.tools) {
    const runtimeName = `avicola.${tool.id}`;
    if (registry.has(runtimeName)) {
      skipped += 1;
      continue;
    }

    const payload: RegisterToolObjectPayload = {
      name: runtimeName,
      description: `${tool.title}. ${tool.description}`,
      inputSchema: tool.inputSchema,
      execute: async (input?: unknown) => {
        if (tool.kind === "navigation") {
          args.onNavigate(tool.path);
          return {
            success: true,
            action: "navigation",
            target: tool.path,
          };
        }

        return args.onExecuteApiTool(tool.id, input);
      },
    };

    await callRegisterTool(registerTool, payload);
    registry.add(runtimeName);
    registered += 1;
  }

  return { registered, skipped };
}
