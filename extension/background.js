let socket = null;
let reconnectTimer = null;
let pingInterval = null;

function updateBadge(status) {
  try {
    if (status === "connected") {
      chrome.action.setBadgeText({ text: "ON" });
      chrome.action.setBadgeBackgroundColor({ color: "#22c55e" }); // green
      chrome.action.setTitle({ title: "Tactab: Connected to MCP server (ws://localhost:8080)" });
    } else {
      chrome.action.setBadgeText({ text: "OFF" });
      chrome.action.setBadgeBackgroundColor({ color: "#ef4444" }); // red
      chrome.action.setTitle({ title: "Tactab: Disconnected (reconnecting...)" });
    }
  } catch (e) {
    // Action API might not be available in some contexts
  }
}

function connectWebSocket() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  try {
    socket = new WebSocket("ws://127.0.0.1:8080");
  } catch (err) {
    console.warn("[Tactab Background] WebSocket init failed:", err);
    updateBadge("disconnected");
    scheduleReconnect();
    return;
  }

  socket.onopen = () => {
    console.log("[Tactab Background] Successfully connected to local MCP server at ws://localhost:8080");
    updateBadge("connected");

    // Explicitly register as the Chrome Extension with the bridge hub
    socket.send(JSON.stringify({ type: "register_extension" }));

    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    // Ping every 20 seconds to keep connection alive
    clearInterval(pingInterval);
    pingInterval = setInterval(() => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "ping" }));
      }
    }, 20000);
  };

  socket.onmessage = async (event) => {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch (e) {
      console.error("[Extension Background] Failed to parse message:", e);
      return;
    }

    if (data.type === "pong") {
      return;
    }

    const { requestId, action, payload } = data;
    if (!requestId) return;

    try {
      // Fetch active tab: try last focused window first, then any active tab across windows
      let tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (!tabs || tabs.length === 0) {
        tabs = await chrome.tabs.query({ active: true });
      }
      const activeTab = tabs && tabs.length > 0 ? tabs[0] : null;

      if (!activeTab || !activeTab.id) {
        socket.send(JSON.stringify({
          requestId,
          response: { success: false, error: "No active browser tab detected in Chrome. Please ensure a tab is open." }
        }));
        return;
      }

      // If action is to query current tab details, respond immediately without needing content script
      if (action === "get_current_tab") {
        socket.send(JSON.stringify({
          requestId,
          response: {
            success: true,
            title: activeTab.title || "Untitled Tab",
            url: activeTab.url || "",
            id: activeTab.id
          }
        }));
        return;
      }

      // Action: Capture visual screenshot of active tab for multimodal vision
      if (action === "take_screenshot" || action === "capture_screenshot") {
        try {
          const windowId = activeTab.windowId || null;
          chrome.tabs.captureVisibleTab(windowId, { format: "png" }, (dataUrl) => {
            const captureError = chrome.runtime.lastError;
            if (captureError || !dataUrl) {
              socket.send(JSON.stringify({
                requestId,
                response: {
                  success: false,
                  error: captureError ? captureError.message : "Failed to capture visual screenshot of the active tab."
                }
              }));
              return;
            }

            // Strip the data:image/png;base64, prefix for pure base64 payload
            const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
            socket.send(JSON.stringify({
              requestId,
              response: {
                success: true,
                imageBase64: base64Data,
                mimeType: "image/png",
                title: activeTab.title || "Active Tab",
                url: activeTab.url || ""
              }
            }));
          });
        } catch (screenshotErr) {
          socket.send(JSON.stringify({
            requestId,
            response: { success: false, error: `Screenshot error: ${screenshotErr.message}` }
          }));
        }
        return;
      }

      // Check for restricted URLs (chrome internal pages cannot have content scripts injected)
      if (
        activeTab.url &&
        (activeTab.url.startsWith("chrome://") ||
         activeTab.url.startsWith("chrome-extension://") ||
         activeTab.url.startsWith("edge://") ||
         activeTab.url.startsWith("about:"))
      ) {
        if (action === "scrape_data") {
          socket.send(JSON.stringify({
            requestId,
            response: {
              success: true,
              title: activeTab.title || "Browser System Page",
              url: activeTab.url,
              content: `System page: ${activeTab.url}. Content scripts cannot execute on internal browser pages.`
            }
          }));
          return;
        }

        socket.send(JSON.stringify({
          requestId,
          response: {
            success: false,
            error: `Cannot automate restricted browser page (${activeTab.url}). Please open a standard website (e.g., https://example.com).`
          }
        }));
        return;
      }

      // Forward action to the active tab's content script
      chrome.tabs.sendMessage(activeTab.id, { action, payload: payload || {} }, async (response) => {
        const lastError = chrome.runtime.lastError;

        // If content script was not yet injected (e.g., tab loaded before extension was installed/reloaded)
        if (lastError) {
          console.warn("[Extension Background] Content script not detected, attempting dynamic injection:", lastError.message);
          try {
            await chrome.scripting.executeScript({
              target: { tabId: activeTab.id },
              files: ["content.js"]
            });

            // Retry sending message after injection
            chrome.tabs.sendMessage(activeTab.id, { action, payload: payload || {} }, (retryResponse) => {
              const retryError = chrome.runtime.lastError;
              socket.send(JSON.stringify({
                requestId,
                response: retryError
                  ? { success: false, error: `Content script execution failed: ${retryError.message}` }
                  : (retryResponse || { success: false, error: "No response from injected content script." })
              }));
            });
            return;
          } catch (injectErr) {
            socket.send(JSON.stringify({
              requestId,
              response: { success: false, error: `Could not inject content script into tab: ${injectErr.message}` }
            }));
            return;
          }
        }

        // Return the content script response back to the MCP bridge
        socket.send(JSON.stringify({
          requestId,
          response: response || { success: false, error: "Failed to receive a response from the web page script." }
        }));
      });
    } catch (err) {
      socket.send(JSON.stringify({
        requestId,
        response: { success: false, error: `Background error: ${err.message}` }
      }));
    }
  };

  socket.onclose = () => {
    console.log("[Extension Background] WebSocket connection dropped. Retrying in 5 seconds...");
    updateBadge("disconnected");
    clearInterval(pingInterval);
    scheduleReconnect();
  };

  socket.onerror = (err) => {
    console.warn("[Extension Background] WebSocket error:", err);
    updateBadge("disconnected");
  };
}

function scheduleReconnect() {
  if (!reconnectTimer) {
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connectWebSocket();
    }, 5000);
  }
}

// Initial connection
updateBadge("disconnected");
connectWebSocket();
