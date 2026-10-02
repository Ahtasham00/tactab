/**
 * Content Script for Tactab (Browser MCP Bridge)
 * Injected into web pages to execute DOM automation actions on behalf of AI agents.
 */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("[Tactab Content Script] Command received:", request);

  const action = request.action;
  const payload = request.payload || {};

  try {
    switch (action) {
      /**
       * 1. SCRAPE_DATA: Extract text, title, and metadata from the webpage
       */
      case "scrape_data": {
        const maxLength = payload.maxLength || 8000;
        const bodyText = (document.body ? document.body.innerText : "").trim();
        const metaDescription = document.querySelector("meta[name='description']")?.getAttribute("content") || "";

        sendResponse({
          success: true,
          title: document.title,
          url: window.location.href,
          description: metaDescription,
          contentLength: bodyText.length,
          content: bodyText.substring(0, maxLength),
          truncated: bodyText.length > maxLength
        });
        break;
      }

      /**
       * 2. CLICK_BUTTON / CLICK: Click an element specified by CSS selector or inner text
       */
      case "click_button":
      case "click": {
        const selector = payload.selector || "button";
        let targetElement = document.querySelector(selector);

        // Fallback: If selector not found and text is provided, find button/link by text
        if (!targetElement && payload.text) {
          const searchLower = payload.text.toLowerCase();
          const candidates = Array.from(document.querySelectorAll("button, a, input[type='submit'], input[type='button'], [role='button']"));
          targetElement = candidates.find(el => (el.innerText || el.value || "").toLowerCase().includes(searchLower));
        }

        if (targetElement) {
          targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
          targetElement.click();
          sendResponse({
            success: true,
            message: `Successfully clicked element: <${targetElement.tagName.toLowerCase()}> with selector '${selector}'.`,
            tag: targetElement.tagName.toLowerCase(),
            text: (targetElement.innerText || targetElement.value || "").trim().substring(0, 100)
          });
        } else {
          sendResponse({
            success: false,
            error: `Element matching selector '${selector}' was not found on the page.`
          });
        }
        break;
      }

      /**
       * 3. FILL_FORM / INPUT_TEXT: Set input, textarea, or select values and fire input/change events
       */
      case "fill_form":
      case "input_text":
      case "type": {
        const selector = payload.selector;
        const value = payload.value !== undefined ? String(payload.value) : (payload.text !== undefined ? String(payload.text) : "");

        if (!selector) {
          sendResponse({ success: false, error: "Missing required 'selector' parameter in payload." });
          break;
        }

        const inputElement = document.querySelector(selector);
        if (inputElement) {
          inputElement.scrollIntoView({ behavior: "smooth", block: "center" });
          inputElement.focus();
          inputElement.value = value;

          // Dispatch standard events for reactive frameworks (React, Vue, Svelte, Angular)
          inputElement.dispatchEvent(new Event("input", { bubbles: true }));
          inputElement.dispatchEvent(new Event("change", { bubbles: true }));

          sendResponse({
            success: true,
            message: `Successfully entered value into '${selector}'.`,
            selector,
            value
          });
        } else {
          sendResponse({
            success: false,
            error: `Input element matching selector '${selector}' was not found on the page.`
          });
        }
        break;
      }

      /**
       * 4. GET_ELEMENTS: Query and list multiple elements (e.g., links, headings, list items)
       */
      case "get_elements":
      case "query_selector_all": {
        const selector = payload.selector || "a";
        const limit = Math.min(payload.limit || 20, 100);
        const elements = Array.from(document.querySelectorAll(selector)).slice(0, limit);

        const results = elements.map((el, index) => ({
          index,
          tag: el.tagName.toLowerCase(),
          text: (el.innerText || "").trim().substring(0, 120),
          href: el.getAttribute("href") || undefined,
          id: el.id || undefined,
          className: el.className || undefined,
          value: el.value || undefined
        }));

        sendResponse({
          success: true,
          count: results.length,
          selector,
          elements: results
        });
        break;
      }

      /**
       * 5. SCROLL: Scroll the viewport
       */
      case "scroll": {
        const direction = payload.direction || "down";
        const amount = payload.amount || 600;

        if (direction === "down") {
          window.scrollBy({ top: amount, behavior: "smooth" });
        } else if (direction === "up") {
          window.scrollBy({ top: -amount, behavior: "smooth" });
        } else if (direction === "top") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else if (direction === "bottom") {
          window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
        }

        sendResponse({
          success: true,
          message: `Scrolled ${direction}.`,
          scrollY: window.scrollY,
          maxScrollY: document.body.scrollHeight
        });
        break;
      }

      /**
       * 6. NAVIGATE: Redirect active tab to a new URL
       */
      case "navigate": {
        if (!payload.url) {
          sendResponse({ success: false, error: "Missing required 'url' parameter in payload." });
          break;
        }

        window.location.href = payload.url;
        sendResponse({
          success: true,
          message: `Initiated navigation to: ${payload.url}`
        });
        break;
      }

      /**
       * 7. GET_HTML: Extract outerHTML of an element or the entire page
       */
      case "get_html": {
        const selector = payload.selector || "body";
        const target = document.querySelector(selector);
        const maxLength = payload.maxLength || 10000;

        if (target) {
          const html = target.outerHTML;
          sendResponse({
            success: true,
            selector,
            html: html.substring(0, maxLength),
            truncated: html.length > maxLength
          });
        } else {
          sendResponse({ success: false, error: `Element matching '${selector}' not found.` });
        }
        break;
      }

      default:
        sendResponse({
          success: false,
          error: `Action '${action}' is not supported. Supported actions: scrape_data, click_button, fill_form, get_elements, scroll, navigate, get_html.`
        });
    }
  } catch (error) {
    sendResponse({
      success: false,
      error: `Error executing action '${action}': ${error.message}`
    });
  }

  return true; // Keep asynchronous message channel open for sendResponse
});
