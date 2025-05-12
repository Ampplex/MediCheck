// Background script for handling side panel operations

// Cache for tracking operations
const operationState = {
  sidePanelOpenRequests: 0,
  lastOpenAttempt: 0
};

console.log("Background script loaded");

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background script received message:", message.action);

  if (message.action === "openSidePanel") {
    handleSidePanelOpen(sendResponse);
    // Return true to indicate we'll respond asynchronously
    return true;
  }

  if (message.action === "checkSidePanel") {
    sendResponse({ checked: true, timestamp: Date.now() });
    return true;
  }
});

/**
 * Handles the side panel opening with retry logic
 * @param {Function} sendResponse - Function to send response back to caller
 */
async function handleSidePanelOpen(sendResponse) {
  console.log("Attempting to open side panel from background script");

  // Prevent rapid repeated attempts (debounce)
  const now = Date.now();
  if (now - operationState.lastOpenAttempt < 1000) {
    operationState.sidePanelOpenRequests++;
    if (operationState.sidePanelOpenRequests > 3) {
      sendResponse({
        success: false,
        error: "Too many requests in short time",
        retryAfter: 1000,
      });
      return;
    }
  } else {
    operationState.sidePanelOpenRequests = 1;
  }

  operationState.lastOpenAttempt = now;

  try {
    // Check if sidePanel API is available
    if (!chrome.sidePanel || !chrome.sidePanel.open) {
      sendResponse({
        success: false,
        error: "Side panel API not available in this browser",
      });
      return;
    }

    // Try to open the side panel
    await chrome.sidePanel.open();
    console.log("Side panel opened successfully from background");
    sendResponse({ success: true, message: "Side panel opened" });
  } catch (error) {
    console.error("Error opening side panel from background:", error);

    // Try again after a short delay
    setTimeout(async () => {
      try {
        await chrome.sidePanel.open();
        console.log("Side panel opened successfully after retry");
        sendResponse({
          success: true,
          message: "Side panel opened after retry",
        });
      } catch (retryError) {
        console.error("Error opening side panel on retry:", retryError);
        sendResponse({ success: false, error: retryError.message });
      }
    }, 500);
  }
}

// Listen for side panel status changes
if (chrome.sidePanel) {
  if (chrome.sidePanel.onShow) {
    chrome.sidePanel.onShow.addListener(() => {
      console.log("Side panel was shown");
      operationState.sidePanelOpenRequests = 0; // Reset counter on success

      // When side panel is shown, check if we need to apply highlighting
      applyHighlightingToActiveTab();
    });
  }

  if (chrome.sidePanel.onHide) {
    chrome.sidePanel.onHide.addListener(() => {
      console.log("Side panel was hidden");
    });
  }
}

// Function to apply highlighting to active tab
function applyHighlightingToActiveTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (!tabs || !tabs[0]) return;

    const activeTab = tabs[0];
    chrome.storage.local.get(["validationData"], (result) => {
      if (result.validationData && result.validationData.validation_results) {
        const validationResults = result.validationData.validation_results;

        // Extract both incorrect phrases and corrections
        const incorrectPhrases = [];
        const correctTexts = [];

        validationResults.forEach((item) => {
          if (item.incorrect_text && item.incorrect_text.trim()) {
            incorrectPhrases.push(item.incorrect_text.trim());
            correctTexts.push(item.correct_text || "No correction available");
          }
        });

        if (incorrectPhrases.length > 0) {
          console.log(
            `Applying highlighting to tab ${activeTab.id} with ${incorrectPhrases.length} phrases`
          );

          // Wait for content to be fully loaded
          setTimeout(() => {
            chrome.tabs
              .sendMessage(activeTab.id, {
                action: "highlight",
                phrases: incorrectPhrases,
                corrections: correctTexts,
              })
              .catch((error) => {
                console.error("Error applying highlighting:", error);

                // Try once more with a longer delay
                setTimeout(() => {
                  chrome.tabs
                    .sendMessage(activeTab.id, {
                      action: "highlight",
                      phrases: incorrectPhrases,
                      corrections: correctTexts,
                    })
                    .catch((retryError) => {
                      console.error("Error on retry:", retryError);
                    });
                }, 2000);
              });
          }, 1000);
        }
      }
    });
  });
}

// Handle extension installation or update
chrome.runtime.onInstalled.addListener((details) => {
  console.log("Extension installed/updated:", details.reason);

  // Reset state on update or install
  operationState.sidePanelOpenRequests = 0;
  operationState.lastOpenAttempt = 0;

  // Clear chat history for testing on startup/restart
  chrome.storage.local.remove(["chatHistory"], function () {
    console.log("Chat history cleared on extension startup/update");
  });
});

// Listen for tab updates to reapply highlighting if needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only react to complete page loads
  if (changeInfo.status === "complete") {
    chrome.storage.local.get(["validationData"], (result) => {
      // If we have validation data, apply highlighting
      if (result.validationData && result.validationData.validation_results) {
        const validationResults = result.validationData.validation_results;

        // Extract both incorrect phrases and corrections
        const incorrectPhrases = [];
        const correctTexts = [];

        validationResults.forEach((item) => {
          if (item.incorrect_text && item.incorrect_text.trim()) {
            incorrectPhrases.push(item.incorrect_text.trim());
            correctTexts.push(item.correct_text || "No correction available");
          }
        });

        if (incorrectPhrases.length > 0) {
          // Wait a short time for the page to fully render
          setTimeout(() => {
            console.log(
              `Tab ${tabId} updated, applying highlighting for ${incorrectPhrases.length} phrases`
            );
            chrome.tabs
              .sendMessage(tabId, {
                action: "highlight",
                phrases: incorrectPhrases,
                corrections: correctTexts,
              })
              .catch((error) => {
                console.log(
                  "Error sending highlight command on tab update, will retry:",
                  error
                );

                // Retry with a longer delay
                setTimeout(() => {
                  chrome.tabs
                    .sendMessage(tabId, {
                      action: "highlight",
                      phrases: incorrectPhrases,
                      corrections: correctTexts,
                    })
                    .catch((retryError) => {
                      console.error("Error on retry:", retryError);
                    });
                }, 2000);
              });
          }, 1000);
        }
      }
    });
  }
});
