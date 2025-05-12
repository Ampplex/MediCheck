# Medical Content Validator Chrome Extension

A Chrome extension that uses Gemini AI to validate medical information on web pages and provide factual corrections.

## Features

- Scrapes webpage content when the extension icon is clicked
- Sends content to a FastAPI backend for processing
- Uses Gemini AI to validate medical information and identify inaccuracies
- Highlights incorrect statements directly on the webpage with tooltips showing corrections
- Displays validation results in a Chrome side panel with three tabs:
  - **Content**: Shows the original webpage content
  - **Validation**: Displays summary and detailed validation results
  - **Assistant**: Interactive chat interface for asking questions about the content
- Light/dark theme toggle with sun/moon icons
- Local storage for saving validation results and chat history
- Options to clear chat history or reset all data for testing

## Prerequisites

- Python 3.8 or higher
- Google Chrome browser
- A Google API key for Gemini AI (get it from [Google AI Studio](https://makersuite.google.com/app/apikey))

## Local Development Setup

### 1. Clone the Repository

```bash
git clone https://github.com/JainamOswal18/MediCheck.git
cd chrome-extension
```

### 2. Backend Setup

1. Navigate to the backend directory:

   ```bash
   cd backend
   ```

2. Create and activate a virtual environment:

   ```bash
   # On Windows
   python -m venv venv
   venv\Scripts\activate

   # On macOS/Linux
   python -m venv venv
   source venv/bin/activate
   ```

3. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

4. Create a `.env` file in the backend directory:

   ```bash
   # backend/.env
   GOOGLE_API_KEY=your_api_key_here
   ```

   Replace `your_api_key_here` with your actual Google API key.

5. Start the FastAPI server:
   ```bash
   python main.py
   ```
   The server will start at `http://localhost:8000`

### 3. Chrome Extension Setup

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked" and select the `frontend` directory from the project
4. The extension icon should appear in your Chrome toolbar

### 4. Using the Extension

1. Make sure the backend server is running (you should see "Starting FastAPI server..." in the terminal)
2. Navigate to any webpage with medical content you want to validate
3. Click the extension icon in your Chrome toolbar
4. Click "Generate Summary" in the popup
5. The extension will:
   - Extract content from the webpage
   - Send it to the backend for validation
   - Highlight incorrect statements on the page with tooltips
   - Open a side panel with validation results
6. In the side panel, you can:
   - View the original content in the "Content" tab
   - See validation results and corrections in the "Validation" tab
   - Chat with the AI assistant about the content in the "Assistant" tab
7. Toggle between light and dark themes using the sun/moon icon in the header

## Backend API Endpoints

- `/summarize` - Validates content and returns analysis results
- `/chat` - Processes chat messages and returns AI responses
- `/health` - Health check endpoint

## Troubleshooting

### Common Issues

1. **Backend Connection Error**

   - Ensure the FastAPI server is running
   - Check if the server is accessible at `http://localhost:8000`
   - Verify your Google API key is correctly set in the `.env` file

2. **Extension Not Working**

   - Check Chrome DevTools console for errors (right-click extension popup → Inspect)
   - Ensure all permissions are granted in `chrome://extensions/`
   - Try reloading the extension

3. **Content Script Error**
   - Make sure you're on a webpage (not a chrome:// page)
   - Check if the content script is properly injected (visible in Chrome DevTools)

### Debugging

1. **Backend Logs**

   - Check the terminal running the FastAPI server for detailed logs
   - Look for any error messages or exceptions

2. **Extension Logs**
   - Open Chrome DevTools (F12)
   - Go to the Console tab
   - Look for any error messages when using the extension

## Development Notes

- The extension uses Manifest V3 with Chrome Side Panel API
- The backend uses FastAPI and LangChain with Gemini AI
- The frontend is built with vanilla JavaScript
- Light/dark theme using CSS variables
- Content highlighting with CSS and JavaScript
- Interactive chat interface with typing indicators and animations

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
