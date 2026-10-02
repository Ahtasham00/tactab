# Tactab 🌐🤖
### Tactile Browser Control & Multimodal Vision Bridge for AI Agents

[![MCP Standard](https://img.shields.io/badge/MCP-Standard-blue)](https://modelcontextprotocol.io/)
[![Manifest V3](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-brightgreen)](https://developer.chrome.com/docs/extensions/mv3/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org/)

**Tactab** (*Tactile + Tab*) is a high-performance, local, and open-source bridge that gives **any MCP-compliant AI client** (Cursor, Claude Desktop, Antigravity, Windsurf, Cline, etc.) live visual eyes and tactile hands in your **Google Chrome** browser using the **Model Context Protocol (MCP)**, **WebSockets**, and a **Chrome Extension (Manifest V3)**.

---

## ⚡ Highlights

- 🌐 **Works with Any Plan (Free or Paid):** Seamlessly connects whether you are on free tiers or paid Pro/Enterprise plans. Zero subscriptions or paid cloud automation platforms (like Browserbase or MultiOn) required.
- 👁️ **Visual Multimodal Vision & DOM Control:** Enables your AI to capture high-res PNG screenshots for visual layout inspection, alongside full DOM scraping, button clicks, form filling, and navigation.
- 🔒 **Private & 100% Local:** Operates strictly over local loopback (`127.0.0.1`). Your session cookies, authenticated tabs (AWS, Jira, GitHub), and local dev servers (`localhost:3000`) never leave your machine.
- 🔄 **Universal MCP Standard:** Plug-and-play with Claude Desktop, Cursor, Antigravity, Windsurf, or custom AI agents over standard I/O (`stdio`).

---

## 🏗️ Architecture

```
┌─────────────────────────────────┐         STDIO (JSON-RPC)         ┌───────────────────────────────┐
│     AI Agent / IDE Client       │  ◄─────────────────────────────► │    Tactab MCP Server (Node)   │
│ (Cursor, Claude, Antigravity)   │                                  │         tactab/server         │
└─────────────────────────────────┘                                  └───────────────┬───────────────┘
                                                                                     │
                                                                            WebSocket (ws://127.0.0.1:8080)
                                                                                     │
┌─────────────────────────────────┐     chrome.tabs.sendMessage     ┌────────────────▼───────────────┐
│        Webpage DOM (Tab)        │  ◄─────────────────────────────► │     Tactab Extension (MV3)    │
│          (content.js)           │                                  │    (background.js + badge)    │
└─────────────────────────────────┘                                  └───────────────────────────────┘
```

1. **AI Agent** invokes the `automate_website` tool over standard input/output (`stdio`).
2. **Tactab Bridge Server (`bridge.js`)** listens on `127.0.0.1:8080` and translates tool calls into JSON WebSocket messages.
3. **Tactab Chrome Extension Service Worker (`background.js`)** receives commands, manages connection status, and routes to active tabs.
4. **Content Script (`content.js`)** executes actions inside the active web page and returns structured results back up the pipeline.

---

## 📂 Project Structure

```
tactab/
│
├── extension/                      # Chrome Extension (Manifest V3)
│   ├── manifest.json               # Extension manifest declaration
│   ├── background.js               # Service worker WebSocket client & badge manager
│   └── content.js                  # DOM interaction & scraping execution engine
│
├── server/                         # Local Node.js MCP Server
│   ├── package.json                # Dependencies (@modelcontextprotocol/sdk, ws)
│   └── bridge.js                   # MCP Stdio transport + WebSocket bridge
│
├── AGENTS.md                       # Universal Multi-Agent Handoff Guardrail
├── PLAN.md                         # Active milestone tracker & Decision Log
├── mcp_config.example.json         # Universal MCP configuration template
├── LICENSE                         # MIT License
├── .gitignore                      # Git ignore file (excludes plane.md, node_modules)
└── README.md                       # Documentation & setup guide
```

---

## 🚀 Quick Start Guide

### 1. Install Server Dependencies
Open your terminal in the `server/` directory:

```bash
cd server
npm install
```
*(On Windows systems where script execution policies restrict `npm`, run `npm.cmd install`)*

---

### 2. Load the Chrome Extension
1. Open **Google Chrome** and navigate to `chrome://extensions/`.
2. Toggle on **Developer mode** in the top-right corner.
3. Click the **Load unpacked** button in the top-left corner.
4. Select the `extension/` folder in this repository.
5. **Tactab — Browser MCP Bridge** will now appear in your extensions list.
   - When connected to the local MCP server, the badge displays green **ON**.
   - When disconnected, it displays red **OFF** and automatically retries every 5 seconds.

---

### 3. Configure Your AI Client

Add Tactab to your AI client's MCP configuration using your absolute path to `server/bridge.js`:

#### A. Claude Desktop
Config file location:
* **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
* **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
* **Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "tactab": {
      "command": "node",
      "args": [
        "/ABSOLUTE/PATH/TO/tactab/server/bridge.js"
      ]
    }
  }
}
```

> **Windows Note:** Use escaped backslashes in paths, e.g.:
> `"C:\\path\\to\\tactab\\server\\bridge.js"`

#### B. Cursor IDE
Open **Cursor Settings** ➔ **Features** ➔ **MCP Servers** (or edit `.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "tactab": {
      "command": "node",
      "args": [
        "/ABSOLUTE/PATH/TO/tactab/server/bridge.js"
      ]
    }
  }
}
```

#### C. Antigravity / Windsurf / Cline
Add the exact same JSON block into your environment's MCP server configuration file.

---

## 🛠️ Supported Browser Actions

The `automate_website` tool supports the following actions on any standard webpage:

| Action | Required Payload | Optional Payload | Description |
|---|---|---|---|
| `take_screenshot` | *(none)* | *(none)* | Captures a high-resolution visual PNG screenshot of the active tab for AI multimodal vision analysis. |
| `scrape_data` | *(none)* | `maxLength` (number) | Extracts page title, URL, meta description, and clean inner text content. |
| `click_button` | `selector` (string) | `text` (string) | Clicks an element by CSS selector with fallback matching by inner text. |
| `fill_form` | `selector` (string), `value` (string) | *(none)* | Sets input/textarea values and dispatches standard input/change events for modern frameworks (React, Vue, Angular). |
| `get_elements` | *(none)* | `selector` (default `"a"`), `limit` (default 20) | Scrapes multiple elements matching a selector, returning text, links, classes, and IDs. |
| `scroll` | *(none)* | `direction` (`"down"`, `"up"`, `"top"`, `"bottom"`), `amount` (pixels) | Scrolls the active tab smoothly. |
| `navigate` | `url` (string) | *(none)* | Navigates the active tab to a new URL. |
| `get_html` | *(none)* | `selector` (default `"body"`), `maxLength` (number) | Extracts outer HTML of a specific element or the entire page. |

---

## 💡 Example Prompts to Ask Your AI

Once configured, simply instruct your AI in natural language:

- 📸 *"Take a screenshot of my current tab and inspect the layout design."*
- 📊 *"Look at the charts on my active tab and summarize the visual data."*
- 🔍 *"Look at my active Chrome tab and summarize what you see."*
- ✍️ *"Fill in the login form with test credentials and submit."*
- 🔗 *"Extract all product titles and links visible on the page."*
- 📜 *"Scroll down 800 pixels and extract the pricing table."*

---

## 🤖 Multi-Agent Handoff Protocol (The "Triple-Anchor" Architecture)

Whether you are switching between specialized models (e.g. Cursor for rapid coding, Claude for system architecture), managing token budgets, or navigating provider rate limits, this repository includes the **Triple-Anchor Architecture** for seamless context transfer with zero loss of progress or hallucination.

```
┌───────────────────────────────────────────────────────────────┐
│ Anchor 1: AGENTS.md (Universal Agent Guardrail)               │
│ -> Tells any newly opened agent: "Read PLAN.md and Git first" │
└──────────────────────────────┬────────────────────────────────┘
                               │
       ┌───────────────────────┴───────────────────────┐
       ▼                                               ▼
┌───────────────────────────────┐   ┌───────────────────────────────┐
│ Anchor 2: PLAN.md             │   │ Anchor 3: Git Status & Diff   │
│ (The Intent & Architecture)   │   │ (The Ground Truth of Code)    │
│ • Completed tasks             │   │ • Exact lines of code changed │
│ • Next pending tasks          │   │ • Clean syntax state          │
│ • "Decision Log" & Gotchas    │   │ • Zero hallucinated changes   │
└───────────────────────────────┘   └───────────────────────────────┘
```

### How to Use in Any Project
Copy [`AGENTS.md`](./AGENTS.md) and [`PLAN.md`](./PLAN.md) into the root of any codebase:

1. **Anchor 1 (`AGENTS.md`):** Automatically read by modern AI tools (Cursor, Antigravity, Claude, ChatGPT CLI). It instructs the model to inspect `PLAN.md` and `git status` before modifying any files.
2. **Anchor 2 (`PLAN.md`):** Contains the live checklist and **Decision Log**. The Decision Log is critical: it prevents the incoming agent from accidentally reverting intentional architecture choices (such as why a heartbeat ping was added).
3. **Anchor 3 (Git Milestones):** When your current agent approaches its token limit, tell it:
   > *"Commit your progress to Git and update PLAN.md."*
4. **Instant Continuation:** Open your next AI agent and simply prompt:
   > *"Continue."*
   The new model reads `AGENTS.md` ➔ `PLAN.md` ➔ `git status`, and picks up immediately with zero lost context.

---

## 🔧 Troubleshooting

- **"Chrome extension is disconnected"**: Make sure Google Chrome is open, the extension is loaded, and you have an active standard website open (not a restricted internal page like `chrome://extensions` or `about:blank`).
- **Port Customization**: By default, the bridge uses WebSocket port `8080`. To use a different port, set the `WS_PORT` environment variable before launching (e.g. `set WS_PORT=8090` / `export WS_PORT=8090`) and update the port in `extension/background.js`.

---

## ⚠️ Legal Disclaimer & Responsible Use

> **IMPORTANT NOTICE:** This software is provided for personal workflow automation, educational research, and authorized testing purposes only.

1. **Compliance with Terms of Service:** Users are solely responsible for ensuring that their automated actions, scraping requests, and web interactions comply with all applicable local, national, and international laws, as well as the Terms of Service, Acceptable Use Policies, and `robots.txt` guidelines of any websites visited.
2. **No Unauthorized Access:** This software must not be used to bypass authentication barriers, paywalls, CAPTCHAs, rate limits, or security controls, nor to access or extract proprietary, copyrighted, or sensitive personal data without explicit permission.
3. **Limitation of Liability:** The author(s) and contributor(s) of this project assume **no liability or responsibility** for any misuse, website bans, legal disputes, data loss, damages, or consequences resulting from the installation or execution of this software. By using this project, you agree to assume all associated risks and responsibilities.

---

## 📄 License
Released under the [MIT License](LICENSE). Free for open source and commercial use.
