from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from dotenv import load_dotenv
import json
import logging
from agent1 import get_medical_validation
from google.generativeai import GenerativeModel

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Initialize Gemini 2.0 Flash model
gemini_model = GenerativeModel("gemini-2.0-flash")

# Store conversation history including chat and validation responses
conversation_history = []

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

class ContentRequest(BaseModel):
    content: dict

class ChatRequest(BaseModel):
    message: str

# Initialize conversation history
conversation_history = []

# Initialize Gemini model for chat
from langchain_google_genai import ChatGoogleGenerativeAI
gemini_model = ChatGoogleGenerativeAI(
    model="gemini-1.5-flash",
    temperature=0.2,
    google_api_key=os.getenv("GOOGLE_API_KEY"),
    convert_system_message_to_human=True
)

@app.post("/summarize")
async def validate_content(request: ContentRequest):
    try:
        logger.info("Received content validation request")
        content = request.content
        metadata = content.get("metadata", {})

        title = content.get("title", "No title")
        url = content.get("url", "No URL")
        text = content.get("text", "")

        custom_instructions = """
        Focus on fact-checking the medical claims in the query.
        Present accurate information and clearly correct any misconceptions.
        Use authoritative medical sources and provide links to reliable references.
        Structure your response with clear sections addressing each claim separately.
        """
    

        logger.info(f"Content info - Title: {title}, URL: {url}, Text length: {len(text)}")

        formatted_text = f"""
        Title: {title}
        URL: {url}

        Metadata:
        - Description: {metadata.get("description", "Not available")}
        - Keywords: {metadata.get("keywords", "Not available")}
        - Author: {metadata.get("author", "Not available")}
        - Open Graph Title: {metadata.get("ogTitle", "Not available")}
        - Open Graph Description: {metadata.get("ogDescription", "Not available")}

        Main Content:
        {text[:30000]}
        """

        logger.info(f"Processing Content for Validation - Source: {url}, Length: {len(formatted_text)}")

        logger.info("Calling get_medical_validation function")
        validation_result = get_medical_validation(formatted_text, custom_instructions=custom_instructions)
        
        # Check if validation_result is a string and parse it to JSON if needed
        if isinstance(validation_result, str):
            try:
                validation_result = json.loads(validation_result)
                logger.info("Successfully parsed validation result from string to JSON")
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse validation result as JSON: {str(e)}")
                # Create a fallback result if parsing fails
                validation_result = {
                    "summary": "Error parsing validation result",
                    "validation_results": []
                }
 
        # Now validation_result should be a dictionary
        logger.info(f"Validation result keys: {validation_result.keys() if isinstance(validation_result, dict) else 'Not a dictionary'}")
        if isinstance(validation_result, dict) and "validation_results" in validation_result:
            logger.info(f"Number of validation results: {len(validation_result['validation_results'])}")

        logger.info("Validation completed successfully")
        logger.info("Returning validation results to client")

        # Store request and validation response in conversation history
        conversation_history.append({"role": "user", "message": f"Validation request: {formatted_text}"})
        conversation_history.append({"role": "validation", "message": f"Validation result: {json.dumps(validation_result)}"})
        
        # Return the validation results
        return validation_result

    except Exception as e:
        logger.error(f"Error during content validation: {str(e)}")
        # Create a structured error response
        error_response = {
            "summary": f"Error: {str(e)}",
            "validation_results": []
        }
        # Return the error response directly instead of raising an exception
        # This ensures the client gets a properly formatted response even in error cases
        return error_response

@app.post("/chat")
async def chat(request: ChatRequest):
    try:
        user_input = request.message
        if not user_input:
            raise HTTPException(status_code=400, detail="Message cannot be empty")

        logger.info(f"Received chat query: {user_input}")

        # Append user message to history
        conversation_history.append({"role": "user", "message": user_input})

        # Limit history size (e.g., keep only last 15 exchanges)
        conversation_history[:] = conversation_history[-15:]

        # Format history as direct conversation
        context = "\n".join([f"{msg['role']}: {msg['message']}" for msg in conversation_history])

        # Generate response using LangChain's invoke method
        response = gemini_model.invoke(f"{context}\nBot:(Instruction: Keep it short and to the point)")
        bot_reply = response.content if response else "I'm sorry, I couldn't process your request."

        # Ensure bot responds naturally without third-person narration
        if "Response:" in bot_reply:
            bot_reply = bot_reply.split("Response:")[-1].strip()

        # Append bot response to history
        conversation_history.append({"role": "bot", "message": bot_reply})

        return {"response": bot_reply}

    except Exception as e:
        logger.error(f"Error in chat route: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}
# 
if __name__ == "__main__":
    import uvicorn
    logger.info("Starting FastAPI server...")
    uvicorn.run(app, host="0.0.0.0", port=8000)