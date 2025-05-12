// document.addEventListener('DOMContentLoaded', function() {
//   const summaryContent = document.getElementById('summary-content');

//   // Get the summary from storage
//   chrome.storage.local.get(['summary'], function(result) {
//     if (result.summary) {
//       summaryContent.innerHTML = result.summary;
//     } else {
//       summaryContent.innerHTML = '<div class="error">No summary available. Please generate a summary first.</div>';
//     }
//   });
// });

document.addEventListener("DOMContentLoaded", function () {
  // Elements
  const tabButtons = document.querySelectorAll(".tab-button");
  const tabContents = document.querySelectorAll(".tab-content");
  const summaryContent = document.getElementById("summary-content");
  const medicalSummary = document.getElementById("medical-summary");
  const validationResults = document.getElementById("validation-results");
  const modeToggle = document.querySelector(".mode-toggle");
  const body = document.body;
  const contentContainer = document.querySelector(".content-container");

  console.log("Sidebar script loaded - DOM Content Loaded");

  // Initialize layout
  adjustLayout();

  // Debug element presence
  console.log("Elements found:", {
    tabButtons: tabButtons.length,
    tabContents: tabContents.length,
    summaryContent: !!summaryContent,
    medicalSummary: !!medicalSummary,
    validationResults: !!validationResults,
    modeToggle: !!modeToggle,
  });

  // Set up tab switching
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      console.log("Tab clicked:", button.getAttribute("data-tab"));
      switchToTab(button.getAttribute("data-tab"));
    });
  });

  function switchToTab(tabId) {
    // Remove active class from all tabs
    tabButtons.forEach((btn) => btn.classList.remove("active"));
    tabContents.forEach((content) => content.classList.remove("active"));

    // Add active class to the selected tab
    const selectedButton = document.querySelector(
      `.tab-button[data-tab="${tabId}"]`
    );
    if (selectedButton) {
      selectedButton.classList.add("active");
    }

    const selectedContent = document.getElementById(tabId);
    if (selectedContent) {
      selectedContent.classList.add("active");

      // Focus chat input if the chat tab is selected
      if (tabId === "chat-tab") {
        setTimeout(() => {
          const chatInput = document.getElementById("chat-input");
          if (chatInput) {
            chatInput.focus();
          }
        }, 100);
      }
    }

    // Save active tab preference
    chrome.storage.local.set({ activeTab: tabId });
  }

  // Adjust layout based on current viewport
  function adjustLayout() {
    if (!contentContainer) return;

    const headerSection = document.querySelector(".header-section");
    const tabButtons = document.querySelector(".tab-buttons");

    if (!headerSection || !tabButtons) return;

    const headerHeight = headerSection.offsetHeight;
    const tabsHeight = tabButtons.offsetHeight;
    const paddingHeight =
      parseInt(
        getComputedStyle(document.querySelector(".dashboard-container")).padding
      ) * 2;

    // Update CSS variables
    document.documentElement.style.setProperty(
      "--header-height",
      `${headerHeight}px`
    );
    document.documentElement.style.setProperty(
      "--tabs-height",
      `${tabsHeight}px`
    );

    // Set container height
    contentContainer.style.height = `calc(100vh - ${
      headerHeight + tabsHeight + paddingHeight + 30
    }px)`;

    // Ensure content areas have proper height
    document
      .querySelectorAll(".summary-section, .medical-section, .chat-section")
      .forEach((section) => {
        section.style.height = "100%";
      });

    console.log(
      `Adjusted layout - Header: ${headerHeight}px, Tabs: ${tabsHeight}px, Container height: ${contentContainer.style.height}`
    );
  }

  // Initialize data loading
  loadDataAndSetupSidebar();

  // Add listener for storage changes to update the sidebar in real-time
  chrome.storage.onChanged.addListener(function (changes, namespace) {
    console.log("Storage changes detected:", Object.keys(changes));
    if (
      namespace === "local" &&
      (changes.validationData || changes.scrapedContent)
    ) {
      console.log(
        "Validation data or scraped content changed, refreshing sidebar"
      );
      loadDataAndSetupSidebar();
    }
  });

  function formatContentForDisplay(content) {
    if (!content) return "<p>No content available</p>";

    let html = "";

    // Format title with proper styling
    if (content.title) {
      html += `<h3 style="margin-bottom: 15px; color: var(--accent-pink);">${content.title}</h3>`;
    } else {
      html += `<h3 style="margin-bottom: 15px; color: var(--accent-pink);">Webpage Content</h3>`;
    }

    // Format URL
    if (content.url) {
      html += `<p style="margin-bottom: 20px;"><strong>Source:</strong> <a href="${content.url}" target="_blank" style="color: var(--accent-blue); text-decoration: underline;">${content.url}</a></p>`;
    }

    // Add a simple message about content validation instead of showing the full text
    html += `<div style="margin-top: 30px; padding: 20px; background-color: var(--bg-secondary); border-radius: 8px; text-align: center;">
      <p style="margin-bottom: 15px; font-size: 16px;">This content has been analyzed by our validation system.</p>
      <p style="color: var(--accent-blue);">View the <strong>Validation</strong> tab to see analysis results.</p>
    </div>`;

    return html;
  }

  function loadDataAndSetupSidebar() {
    // Show loading indicators in all tabs
    summaryContent.innerHTML =
      '<p style="text-align: center; margin-top: 20px;"><em>Loading content...</em></p>';
    medicalSummary.innerHTML =
      '<p style="text-align: center;"><em>Loading validation data...</em></p>';
    validationResults.innerHTML =
      '<p style="text-align: center;"><em>Loading validation results...</em></p>';

    // Load saved data and populate the sidebar
    chrome.storage.local.get(
      ["validationData", "scrapedContent", "activeTab", "theme"],
      function (result) {
        console.log("Chrome storage data retrieved:", {
          hasValidationData: !!result.validationData,
          hasScrapedContent: !!result.scrapedContent,
          activeTab: result.activeTab,
          theme: result.theme,
        });

        // Set theme
        if (result.theme === "light") {
          body.classList.add("light-mode");
          const iconElement = modeToggle.querySelector("i");
          if (iconElement) {
            iconElement.className = "fas fa-sun";
          }
        } else {
          body.classList.remove("light-mode");
          const iconElement = modeToggle.querySelector("i");
          if (iconElement) {
            iconElement.className = "fas fa-moon";
          }
        }

        // Set active tab
        let tabToShow = result.activeTab;
        if (!tabToShow) {
          // Default to medical-tab if we have validation data, otherwise summary-tab
          tabToShow = result.validationData ? "medical-tab" : "summary-tab";
        }

        console.log("Setting active tab to:", tabToShow);
        switchToTab(tabToShow);

        // Display validation data if available
        if (result.validationData) {
          console.log("Displaying validation results");
          displayValidationResults(result.validationData);
        } else {
          console.log("No validation data available");
          medicalSummary.textContent =
            "No validation data available. Please validate content first.";
          validationResults.innerHTML =
            '<div class="error">No validation results available.</div>';
        }

        // Display source content
        if (result.scrapedContent) {
          console.log("Displaying source content");
          summaryContent.innerHTML = formatContentForDisplay(
            result.scrapedContent
          );
        } else {
          console.log("No source content available");
          summaryContent.innerHTML =
            '<div class="error">No content available. Please scrape a webpage first.</div>';
        }

        // Adjust layout after content is loaded
        setTimeout(adjustLayout, 100);
      }
    );
  }

  // Function to display validation results
  function displayValidationResults(data) {
    console.log("Processing validation results:", data);
    // Display the summary
    if (data.summary) {
      medicalSummary.innerHTML = `<p style="line-height: 1.7; font-size: 16px;">${data.summary}</p>`;
      console.log("Set medical summary");
    } else {
      medicalSummary.textContent = "No summary available.";
      console.log("No summary in validation data");
    }

    // Extract all incorrect phrases and their corrections for highlighting
    const incorrectPhrases = [];
    const correctTexts = [];
    if (data.validation_results && data.validation_results.length > 0) {
      data.validation_results.forEach((result) => {
        if (result.incorrect_text && result.incorrect_text.trim()) {
          incorrectPhrases.push(result.incorrect_text.trim());
          correctTexts.push(result.correct_text || "No correction available");
        }
      });
    }

    // Send highlight command to content script immediately without waiting for button press
    if (incorrectPhrases.length > 0) {
      console.log(
        `Sending highlight command for ${incorrectPhrases.length} phrases`
      );
      sendHighlightCommand(incorrectPhrases, correctTexts);
    }

    // Display validation results
    if (data.validation_results && data.validation_results.length > 0) {
      console.log(`Found ${data.validation_results.length} validation results`);
      let resultsHTML = "";

      data.validation_results.forEach((result, index) => {
        resultsHTML += `
          <div class="validation-result" style="margin-bottom: 20px; padding: 15px;">
            <h4 style="margin-bottom: 10px; color: var(--accent-blue);">Issue #${
              index + 1
            }</h4>
            <div class="incorrect-text" data-index="${index}">${
          result.incorrect_text
        }</div>
            <div class="correct-text">${result.correct_text}</div>
          </div>
        `;
      });

      validationResults.innerHTML = resultsHTML;
      console.log("Validation results HTML set");
    } else {
      console.log("No validation results array or empty array");
      validationResults.innerHTML =
        '<p style="padding: 15px; background-color: var(--bg-secondary); border-left: 3px solid var(--accent-green); color: var(--accent-green); font-weight: bold;">No issues found. All information appears to be accurate.</p>';
    }
  }

  // Function to send highlight command to content script
  function sendHighlightCommand(phrases, corrections) {
    // Get the current active tab
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs && tabs[0]) {
        console.log("Sending highlight command to tab:", tabs[0].id);
        try {
          chrome.tabs
            .sendMessage(tabs[0].id, {
              action: "highlight",
              phrases: phrases,
              corrections: corrections,
            })
            .then((response) => {
              console.log("Highlight command response:", response);
            })
            .catch((error) => {
              console.error("Error sending highlight command:", error);

              // If there's an error (content script not ready), retry after a short delay
              setTimeout(() => {
                console.log("Retrying highlight command...");
                chrome.tabs
                  .sendMessage(tabs[0].id, {
                    action: "highlight",
                    phrases: phrases,
                    corrections: corrections,
                  })
                  .catch((retryError) => {
                    console.error("Error on retry:", retryError);
                  });
              }, 1000);
            });
        } catch (error) {
          console.error("Exception sending highlight command:", error);
        }
      } else {
        console.error("No active tab found for highlighting");
      }
    });
  }

  // Event listener for theme toggle button
  if (modeToggle) {
    modeToggle.addEventListener("click", function () {
      // First, remove all transitions temporarily
      document.documentElement.style.setProperty("--transition-duration", "0s");

      // Toggle the theme
      body.classList.toggle("light-mode");

      // Update button icon and store preference
      const iconElement = modeToggle.querySelector("i");
      if (body.classList.contains("light-mode")) {
        iconElement.className = "fas fa-sun";
        chrome.storage.local.set({ theme: "light" });
      } else {
        iconElement.className = "fas fa-moon";
        chrome.storage.local.set({ theme: "dark" });
      }

      // Force reflow to apply color changes immediately
      void document.body.offsetHeight;

      // Adjust layout after theme change
      setTimeout(adjustLayout, 100);
    });
  }

  // ===== CHAT FUNCTIONALITY =====
  const chatInput = document.getElementById("chat-input");
  const sendButton = document.getElementById("send-button");
  const chatMessages = document.getElementById("chat-messages");
  const clearChatButton = document.getElementById("clear-chat-button");
  let isSending = false;

  // Initialize chat
  loadChatHistory();

  // Add event listeners for chat input
  chatInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  sendButton.addEventListener("click", sendMessage);

  // Add event listener for clear chat button
  clearChatButton.addEventListener("click", clearChatHistory);

  /**
   * Loads chat history from storage
   */
  function loadChatHistory() {
    chrome.storage.local.get(["chatHistory"], function (result) {
      if (result.chatHistory && result.chatHistory.length > 0) {
        chatMessages.innerHTML = ""; // Clear default message
        result.chatHistory.forEach((msg) => {
          appendMessageToUI(msg.role, msg.message);
        });
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
    });
  }

  /**
   * Saves chat history to storage
   * @param {Array} messages - Array of message objects {role, message}
   */
  function saveChatHistory(messages) {
    chrome.storage.local.set({ chatHistory: messages });
  }

  /**
   * Sends user message to backend and handles response
   */
  async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message || isSending) return;

    try {
      isSending = true;

      // Clear input field
      chatInput.value = "";

      // Add user message to UI with animation
      appendMessageToUI("user", message);

      // Show typing indicator
      const typingIndicator = addTypingIndicator();

      console.log("Sending chat message to backend:", message);

      try {
        // Make API request to backend chat endpoint
        const response = await fetch("http://localhost:8000/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message: message }),
        });

        // Remove typing indicator
        if (typingIndicator) typingIndicator.remove();

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Server error:", errorText);
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("Received chat response:", data);

        // Add bot response to UI with animation
        appendMessageToUI("ai", data.response);

        // Retrieve existing messages from UI
        const messages = [];
        document.querySelectorAll(".message").forEach((el) => {
          // Skip typing indicators
          if (el.classList.contains("typing-indicator")) return;

          const role = el.classList.contains("user-message") ? "user" : "ai";
          const text = el.textContent.trim();
          messages.push({ role, message: text });
        });

        // Save updated chat history
        saveChatHistory(messages);
      } catch (networkError) {
        console.error("Network error:", networkError);
        if (typingIndicator) typingIndicator.remove();

        // Show a more descriptive error message
        appendMessageToUI(
          "ai",
          "I'm having trouble connecting to the server. Please check that the backend is running at http://localhost:8000 and try again."
        );
      }
    } catch (error) {
      console.error("Chat error:", error);
      appendMessageToUI(
        "ai",
        "Sorry, I encountered an unexpected error. Please try again or check the console for details."
      );
    } finally {
      isSending = false;
      // Scroll to bottom
      chatMessages.scrollTop = chatMessages.scrollHeight;
      // Focus the input field again
      chatInput.focus();
    }
  }

  /**
   * Adds a typing indicator to the chat
   * @returns {HTMLElement} The typing indicator element
   */
  function addTypingIndicator() {
    const typingEl = document.createElement("div");
    typingEl.className = "message ai-message typing-indicator";
    typingEl.innerHTML = `
      <span class="dot"></span>
      <span class="dot"></span>
      <span class="dot"></span>
    `;

    // Add CSS for the typing animation
    if (!document.getElementById("typing-style")) {
      const style = document.createElement("style");
      style.id = "typing-style";
      style.innerHTML = `
        .typing-indicator {
          display: flex;
          align-items: center;
          padding: 12px 15px;
        }
        .typing-indicator .dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          margin-right: 3px;
          background-color: var(--accent-blue);
          border-radius: 50%;
          opacity: 0.6;
          animation: typing-dot 1.4s infinite ease-in-out both;
        }
        .typing-indicator .dot:nth-child(2) {
          animation-delay: 0.2s;
        }
        .typing-indicator .dot:nth-child(3) {
          animation-delay: 0.4s;
        }
        @keyframes typing-dot {
          0%, 80%, 100% { 
            transform: scale(0.7);
            opacity: 0.6;
          }
          40% { 
            transform: scale(1);
            opacity: 1;
          }
        }
      `;
      document.head.appendChild(style);
    }

    chatMessages.appendChild(typingEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return typingEl;
  }

  /**
   * Appends a message to the chat UI with animation
   * @param {string} role - "user" or "ai"
   * @param {string} text - Message text
   */
  function appendMessageToUI(role, text) {
    const messageEl = document.createElement("div");
    messageEl.className = `message ${
      role === "user" ? "user-message" : "ai-message"
    }`;
    messageEl.textContent = text;

    // Add animation class with random delay
    messageEl.style.animationDelay = `${Math.random() * 0.3}s`;

    // Add animation CSS if not already present
    if (!document.getElementById("message-animation")) {
      const style = document.createElement("style");
      style.id = "message-animation";
      style.innerHTML = `
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .message {
          animation: fadeInUp 0.3s ease forwards;
          opacity: 0;
        }
      `;
      document.head.appendChild(style);
    }

    chatMessages.appendChild(messageEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  /**
   * Clears chat history and resets to initial state
   */
  function clearChatHistory() {
    // Clear chat messages UI
    chatMessages.innerHTML = "";

    // Add default welcome message
    appendMessageToUI(
      "ai",
      "Hello! I'm your medical content assistant. You can ask me questions about the validated content, request explanations for medical terms, or get more information about any highlighted inaccuracies."
    );

    // Clear chat history in storage
    chrome.storage.local.remove(["chatHistory"], function () {
      console.log("Chat history cleared");
    });

    // Add subtle animation indicating successful reset
    clearChatButton.classList.add("button-flash");
    setTimeout(() => {
      clearChatButton.classList.remove("button-flash");
    }, 300);
  }

  // Debounced window resize handler
  let resizeTimeout;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(adjustLayout, 200);
  });
});
