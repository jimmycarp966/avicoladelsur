export {};

declare global {
  interface Window {
    __AVICOLA_WEBMCP_REGISTERED__?: Set<string>;
    modelContext?: {
      registerTool?: (...args: any[]) => any;
    };
    webmcp?: {
      registerTool?: (...args: any[]) => any;
    };
    mcpb?: {
      registerTool?: (...args: any[]) => any;
    };
    registerTool?: (...args: any[]) => any;
  }

  interface Navigator {
    modelContext?: {
      registerTool?: (...args: any[]) => any;
    };
  }
}

