"use client";

import "@mcp-b/global";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { getWebMcpToolsForRole } from "@/lib/webmcp/tool-catalog";
import { registerWebMcpTools } from "@/lib/webmcp/runtime";

function isWebMcpEnabledByFlag(): boolean {
  return process.env.NEXT_PUBLIC_WEBMCP_ENABLED === "true";
}

export function WebMCPProvider() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || !user) return;
    if (!isWebMcpEnabledByFlag()) return;

    const tools = getWebMcpToolsForRole(user.rol);
    if (tools.length === 0) return;

    registerWebMcpTools({
      tools,
      onNavigate: (path) => {
        router.push(path);
      },
      onExecuteApiTool: async (toolId, input) => {
        const response = await fetch("/api/webmcp/execute", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tool: toolId,
            input: input ?? {},
          }),
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || `Error ejecutando tool ${toolId}`);
        }

        return payload;
      },
    }).catch((error) => {
      console.error("[WebMCP] Error registrando tools:", error);
    });
  }, [loading, router, user]);

  return null;
}
