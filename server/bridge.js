import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { WebSocketServer } from "ws";

// Port configuration (default 8080)
const WS_PORT = process.env.WS_PORT ? parseInt(process.env.WS_PORT, 10) : 8080;

let activeExtensionSocket = null;
const pendingRequests = new Map();

// 1. Initialize WebSocket Server for the Chrome Extension
const wss = new WebSocketServer({ port: WS_PORT, host: "127.0.0.1" });

wss.on("listening", () => {
  console.error(`[Tactab Server] WebSocket server listening on ws://127.0.0.1:${WS_PORT}`);
});

wss.on("connection", (ws) => {
  activeExtensionSocket = ws;
  console.error("[Tactab Server] Chrome extension connected.");

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());

      // Chrome Extension registration confirmation
      if (data.type === "register_extension") {
        activeExtensionSocket = ws;
        console.error("[Tactab Server] Chrome extension registered.");
        return;
      }

      // Heartbeat ping
      if (data.type === "ping") {
        activeExtensionSocket = ws;
        ws.send(JSON.stringify({ type: "pong" }));
        return;
      }

      // Response from Chrome extension
      if (data.requestId && pendingRequests.has(data.requestId)) {
        const resolveFn = pendingRequests.get(data.requestId);
        resolveFn(data.response);
        pendingRequests.delete(data.requestId);
      }
    } catch (e) {
      console.error("[Tactab Server] Malformed message received:", e.message);
    }
  });

  ws.on("close", () => {
    if (activeExtensionSocket === ws) {
      activeExtensionSocket = null;
      console.error("[Tactab Server] Chrome extension disconnected.");
    }
  });

  ws.on("error", (err) => {
    console.error("[Tactab Server] Socket error:", err.message);
  });
});

wss.on("error", (err) => {
  console.error("[Tactab Server] WebSocket server error:", err.message);
});

// Helper function to push commands to the Chrome Extension
function sendCommandToExtension(action, payload = {}) {
  return new Promise((resolve) => {
    if (!activeExtensionSocket || activeExtensionSocket.readyState !== 1) {
      return resolve({
        success: false,
        error: "Chrome extension is disconnected. Please ensure Google Chrome is open, the extension is loaded, and you have an active webpage tab open."
      });
    }

    const requestId = Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    pendingRequests.set(requestId, resolve);

    activeExtensionSocket.send(JSON.stringify({ requestId, action, payload }));

    // Safety Timeout (30 seconds)
    setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        resolve({
          success: false,
          error: `Operation '${action}' timed out after 30s waiting for Chrome extension response.`
        });
      }
    }, 30000);
  });
}

// 2. Initialize the MCP Server
const server = new Server(
  { name: "tactab", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// Define tools available to MCP clients (Claude Desktop, Cursor, Antigravity, etc.)
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "automate_website",
        description: "Executes custom browser actions on the currently active webpage via the local Chrome extension bridge.",
        inputSchema: {
          type: "object",
          properties: {
            action: {
              type: "string",
              description: "The targeted script action. Supported actions: 'take_screenshot' (capture visual PNG screenshot of the tab for multimodal vision), 'scrape_data' (get text content), 'click_button' (click element by selector), 'fill_form' (type into input/textarea), 'get_elements' (query elements), 'scroll' (scroll down/up), 'navigate' (open URL), 'get_html' (extract HTML)."
            },
            payload: {
              type: "object",
              description: "Key-value parameters needed for the action (e.g. { selector: 'button.submit' }, { selector: 'input[name=q]', value: 'search text' }, { direction: 'down', amount: 500 }, { url: 'https://example.com' })"
            }
          },
          required: ["action"]
        }
      }
    ]
  };
});

// Route requests down to the WebSocket pipeline
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "automate_website") {
    const { action, payload } = request.params.arguments || {};
    const result = await sendCommandToExtension(action, payload);

    // If result contains screenshot data, return standard MCP image content for vision analysis
    if (result && result.imageBase64) {
      return {
        content: [
          {
            type: "image",
            data: result.imageBase64,
            mimeType: result.mimeType || "image/png"
          },
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `Captured visual screenshot of ${result.title || "active tab"} (${result.url || ""})`
            }, null, 2)
          }
        ]
      };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }
  throw new Error(`Tool unknown: ${request.params.name}`);
});

// Run using the local Stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[Tactab Server] MCP server successfully connected via Stdio transport.");
