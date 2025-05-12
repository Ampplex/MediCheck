chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "scrape") {
    // Get only the text content of the page
    const content = {
      title: document.title,
      text: document.body.innerText,
      url: window.location.href,
      metadata: {
        description:
          document.querySelector('meta[name="description"]')?.content || "",
        keywords:
          document.querySelector('meta[name="keywords"]')?.content || "",
        author: document.querySelector('meta[name="author"]')?.content || "",
        ogTitle:
          document.querySelector('meta[property="og:title"]')?.content || "",
        ogDescription:
          document.querySelector('meta[property="og:description"]')?.content ||
          "",
        ogImage:
          document.querySelector('meta[property="og:image"]')?.content || "",
      },
    };

    // Send the content back to the popup
    sendResponse({ content });
  } else if (request.action === "highlight") {
    // Add the highlight functionality with corrections
    highlightIncorrectText(request.phrases, request.corrections);
    sendResponse({ success: true });
  }
  return true; // Required for async response
});

function highlightIncorrectText(phrases, corrections) {
  // Create a mapping of incorrect phrases to their corrections
  const correctionMap = {};
  if (phrases && corrections && phrases.length === corrections.length) {
    phrases.forEach((phrase, index) => {
      if (phrase && phrase.trim()) {
        correctionMap[phrase.trim().toLowerCase()] = corrections[index];
      }
    });
  }

  // Add styling for highlighted text and tooltips
  let style = document.getElementById("highlight-style");
  if (!style) {
    style = document.createElement("style");
    style.id = "highlight-style";
    style.innerHTML = `
            .highlighted-text {
                background-color: rgba(255, 255, 0, 0.5);
                color: red;
                font-weight: bold;
                cursor: pointer;
                border-radius: 3px;
                padding: 2px;
                border: 1px dashed red;
                position: relative;
            }
            
            .correction-tooltip {
                position: fixed;
                background-color: #333;
                color: white;
                padding: 12px 15px;
                border-radius: 4px;
                white-space: normal;
                width: 300px;
                z-index: 1000;
                box-shadow: 0 3px 8px rgba(0,0,0,0.4);
                text-align: left;
                font-weight: normal;
                font-size: 14px;
                line-height: 1.5;
                word-wrap: break-word;
                overflow-wrap: break-word;
                hyphens: auto;
                visibility: hidden;
                opacity: 0;
                transition: opacity 0.3s;
                pointer-events: none;
            }
            
            .highlighted-text {
                transition: background-color 0.2s;
            }
            
            .highlighted-text:hover {
                background-color: rgba(255, 220, 0, 0.7);
            }
        `;
    document.head.appendChild(style);
  }

  // Remove previous highlights if any
  document.querySelectorAll(".highlighted-text").forEach((el) => {
    const text = el.textContent;
    const textNode = document.createTextNode(text);
    el.parentNode.replaceChild(textNode, el);
  });

  // Remove existing tooltip if any
  const existingTooltip = document.getElementById("correction-tooltip");
  if (existingTooltip) {
    existingTooltip.remove();
  }

  // Create tooltip element
  const tooltip = document.createElement("div");
  tooltip.id = "correction-tooltip";
  tooltip.className = "correction-tooltip";
  document.body.appendChild(tooltip);

  // Function to escape special characters in regex
  function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // Filter out empty phrases and sort by length (longest first) to avoid partial matches
  const filteredPhrases = phrases
    .filter((phrase) => phrase && phrase.trim().length > 0)
    .sort((a, b) => b.length - a.length);

  if (filteredPhrases.length === 0) return;

  // Convert phrases into a single regex pattern
  const regexPattern = filteredPhrases.map(escapeRegExp).join("|"); // Combine all phrases using "|"
  const regex = new RegExp(`(${regexPattern})`, "gi"); // Global case-insensitive regex

  function highlightTextNodes(node) {
    if (node.nodeType === 3) {
      // Text node
      const text = node.nodeValue;
      if (!text.trim()) return; // Skip empty text nodes

      let match = regex.exec(text);
      if (!match) return; // No matches in this text node

      regex.lastIndex = 0; // Reset regex state

      const newHTML = text.replace(regex, (match) => {
        const matchLower = match.toLowerCase();
        // Find the correction for this phrase
        let correction = "This statement may be factually incorrect.";

        // Look for exact match first
        if (correctionMap[matchLower]) {
          correction = correctionMap[matchLower];
        } else {
          // Try to find the closest match
          for (const key of Object.keys(correctionMap)) {
            if (matchLower.includes(key) || key.includes(matchLower)) {
              correction = correctionMap[key];
              break;
            }
          }
        }

        // Sanitize the correction text to prevent HTML issues
        const sanitizedCorrection = correction
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&apos;");

        return `<span class="highlighted-text" data-correction="${sanitizedCorrection}">${match}</span>`;
      });

      if (newHTML !== text) {
        // If any replacement happened
        const span = document.createElement("span");
        span.innerHTML = newHTML;
        node.replaceWith(span);
      }
    } else if (node.nodeType === 1) {
      // Element node
      // Skip script and style elements
      if (
        node.tagName === "SCRIPT" ||
        node.tagName === "STYLE" ||
        node.tagName === "NOSCRIPT" ||
        node.classList.contains("highlighted-text")
      ) {
        return;
      }

      // Recursively process child nodes (make a copy of the list to avoid live collection issues)
      Array.from(node.childNodes).forEach(highlightTextNodes);
    }
  }

  // Start highlighting from the body
  highlightTextNodes(document.body);

  // Add event listeners for tooltip display
  const highlightedElements = document.querySelectorAll(".highlighted-text");
  highlightedElements.forEach((el) => {
    el.addEventListener("mouseenter", function (e) {
      const correction = this.getAttribute("data-correction");
      tooltip.textContent = correction;
      tooltip.style.visibility = "visible";
      tooltip.style.opacity = "1";

      positionTooltip(e, this);
    });

    el.addEventListener("mousemove", function (e) {
      positionTooltip(e, this);
    });

    el.addEventListener("mouseleave", function () {
      tooltip.style.visibility = "hidden";
      tooltip.style.opacity = "0";
    });
  });

  // Function to position the tooltip based on mouse position and element
  function positionTooltip(e, element) {
    const rect = element.getBoundingClientRect();
    const tooltipWidth = 300;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // Calculate horizontal position
    let left;
    if (rect.left + tooltipWidth / 2 > windowWidth) {
      // Too close to right edge
      left = windowWidth - tooltipWidth - 20;
    } else if (rect.left < tooltipWidth / 2) {
      // Too close to left edge
      left = 20;
    } else {
      // Center above the element
      left = rect.left + rect.width / 2 - tooltipWidth / 2;
    }

    // Calculate vertical position
    let top;
    const tooltipHeight = tooltip.offsetHeight || 100; // Default height if not yet rendered

    if (rect.top < tooltipHeight + 10) {
      // If not enough space above, position below
      top = rect.bottom + 10;
    } else {
      // Position above
      top = rect.top - tooltipHeight - 10;
    }

    // Make sure tooltip is fully visible
    top = Math.max(10, Math.min(windowHeight - tooltipHeight - 10, top));

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  console.log(
    `Highlighted ${filteredPhrases.length} incorrect phrases on the page`
  );
} 