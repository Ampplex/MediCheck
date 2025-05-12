import os
import re
import logging
import requests
import wikipedia
import json
from typing import Dict, List, Any, Optional
from urllib.parse import quote_plus
from dotenv import load_dotenv

import langchain
from langchain.agents import AgentType, initialize_agent, Tool
from langchain.memory import ConversationBufferMemory
from langchain.prompts import PromptTemplate
from langchain.tools import BaseTool
from langchain_community.document_loaders import WebBaseLoader
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel, Field

# Configuration and Logging Setup
load_dotenv()
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Set USER_AGENT to resolve the warning
os.environ['USER_AGENT'] = 'MediCheck-Agent/1.0'

class EnhancedBaseTool(BaseTool):
    name: str = Field(default="base_tool", description="Base tool name")
    description: str = Field(default="A base tool for medical information retrieval", description="Tool description")
    
    def _safe_run(self, func, *args, **kwargs) -> str:
        """Wrapper for safe tool execution with logging."""
        try:
            return func(*args, **kwargs)
        except Exception as e:
            logger.error(f"Error in {self.name}: {str(e)}")
            return f"Error in {self.name}: {str(e)}"

class WHONewsroomTool(EnhancedBaseTool):
    name: str = Field(default="who_newsroom_tool", description="WHO Newsroom search tool")
    description: str = Field(default="Search the latest news and articles from WHO on health topics", description="Tool description")
    
    def _run(self, query: str) -> str:
        def _fetch_who_results():
            url = f"https://www.who.int/news-room/search-results?indexCatalogue=genericsearchindex&searchQuery={quote_plus(query.strip())}"
            return f"WHO Newsroom Search Results for '{query}':\nVisit: {url}"
        
        return self._safe_run(_fetch_who_results)

class WHODataTool(EnhancedBaseTool):
    name: str = Field(default="who_data_tool", description="WHO Health Data search tool")
    description: str = Field(default="Search official health data from WHO", description="Tool description")
    
    def _run(self, query: str) -> str:
        def _fetch_who_data():
            url = f"https://www.who.int/data/gho/data/indicators?query={quote_plus(query.strip())}"
            return f"WHO Data Results for '{query}':\nVisit: {url}"
        
        return self._safe_run(_fetch_who_data)

class WikipediaMedicalTool(EnhancedBaseTool):
    name: str = Field(default="wikipedia_medical_tool", description="Wikipedia Medical Information search tool")
    description: str = Field(default="Search medical information from Wikipedia", description="Tool description")
    
    def _run(self, query: str) -> str:
        def _fetch_wikipedia_info():
            try:
                search_results = wikipedia.search(f"medical {query}")
                if not search_results:
                    return f"No Wikipedia articles found for '{query}'"
                
                page_title = search_results[0]
                page = wikipedia.page(page_title, auto_suggest=False)
                summary = page.summary[:500] + "..." if len(page.summary) > 500 else page.summary
                
                return f"Wikipedia Medical Information for '{page_title}':\n\n{summary}\n\nFull Article: {page.url}"
            except Exception as e:
                return f"Error fetching Wikipedia information: {str(e)}"
        
        return self._safe_run(_fetch_wikipedia_info)

class MedicalWebSearchTool(EnhancedBaseTool):
    name: str = Field(default="medical_web_search_tool", description="Medical Web Search tool")
    description: str = Field(default="Search the web for medical information", description="Tool description")
    
    def _run(self, query: str) -> str:
        def _perform_web_search():
            search_url = f"https://www.google.com/search?q={quote_plus('medical site:gov site:edu site:org ' + query)}"
            return f"Medical Web Search Results for '{query}':\nSearch URL: {search_url}"
        
        return self._safe_run(_perform_web_search)

class PubMedSearchTool(EnhancedBaseTool):
    name: str = Field(default="pubmed_search_tool", description="PubMed Research Article search tool")
    description: str = Field(default="Search peer-reviewed medical research articles", description="Tool description")
    
    def _run(self, query: str) -> str:
        def _search_pubmed():
            base_url = f"https://pubmed.ncbi.nlm.nih.gov/?term={quote_plus(query)}"
            return f"PubMed Search Results for '{query}':\nVisit: {base_url}"
        
        return self._safe_run(_search_pubmed)

class EnhancedMedicalAgentSystem:
    def __init__(self, model: str = "gemini-2.0-flash", temperature: float = 0.2, custom_instructions: str = None):
        # Initialize specific tools
        self.who_newsroom_tool = WHONewsroomTool()
        self.who_data_tool = WHODataTool()
        self.wikipedia_tool = WikipediaMedicalTool()
        self.web_search_tool = MedicalWebSearchTool()
        self.pubmed_tool = PubMedSearchTool()
        
        # Convert tools to Langchain Tool format
        self.tools = [
            Tool(
                name=tool.__class__.__name__.replace('Tool', ''), 
                func=tool._run, 
                description=tool.description
            ) for tool in [
                self.who_newsroom_tool, 
                self.who_data_tool, 
                self.wikipedia_tool, 
                self.web_search_tool, 
                self.pubmed_tool
            ]
        ]
        
        self.llm = ChatGoogleGenerativeAI(
            model=model, 
            temperature=temperature, 
            convert_system_message_to_human=True
        )
        
        self.memory = ConversationBufferMemory(memory_key="chat_history")
        
        # Store custom instructions
        self.custom_instructions = custom_instructions or "Synthesize information from various reliable sources."
        
        # Attribute to store comprehensive search results
        self.search_results: Dict[str, str] = {}

    def comprehensive_search(self, query: str) -> Dict[str, str]:
        """
        Perform a comprehensive search across multiple sources.
        
        Args:
            query (str): The medical query to search
        
        Returns:
            Dict[str, str]: Dictionary of search results from different sources
        """
        # Reset previous search results
        self.search_results = {}
        
        # Perform searches across different tools
        search_methods = [
            ("WHO Newsroom", self.who_newsroom_tool._run),
            ("WHO Data", self.who_data_tool._run),
            ("Wikipedia", self.wikipedia_tool._run),
            ("Web Search", self.web_search_tool._run),
            ("PubMed", self.pubmed_tool._run)
        ]
        
        for source_name, search_method in search_methods:
            try:
                result = search_method(query)
                self.search_results[source_name] = result
                logger.info(f"Retrieved information from {source_name}")
            except Exception as e:
                self.search_results[source_name] = f"Error searching {source_name}: {str(e)}"
                logger.error(f"Error in {source_name}: {str(e)}")
        
        return self.search_results

    def synthesize_with_llm(self, query: str, search_results: Dict[str, str]) -> str:
        """
        Use the LLM to synthesize information from all tool responses.
        
        Args:
            query (str): The user's query
            search_results (Dict[str, str]): Results from all tools
            
        Returns:
            str: Synthesized response from LLM in JSON format
        """
        # Create a comprehensive prompt with all tool responses
        prompt = f"""
        USER QUERY: {query}
        
        CUSTOM INSTRUCTIONS: {self.custom_instructions}
        
        SEARCH RESULTS FROM DIFFERENT SOURCES:
        
        """
        
        # Add all tool responses to the prompt
        for source, result in search_results.items():
            prompt += f"--- {source} ---\n{result}\n\n"
        
        # Add final instruction for synthesis in JSON format
        prompt += """
        Based on the user query and all the search results provided above, please:
        1. Analyze the accuracy of any claims in the query
        2. Provide accurate medical information based on reliable sources
        3. Cite specific sources when possible
        4. Present a well-structured, comprehensive response that directly addresses the query
        5. Follow the custom instructions provided above
        
        IMPORTANT: Your response must be in valid JSON format with this exact structure:
        {
          "summary": "<summary_of_correct_info>",
          "validation_results": [
            {
              "incorrect_text": "<highlighted_incorrect_text>",
              "correct_text": "<corrected_or_verified_text>"
            },
            ...
          ]
        }

        Where:
        - "summary" is a concise summary of the content with factually correct information
        - "validation_results" is an array of objects, each containing:
          - "incorrect_text": the specific claim or statement from the query that is incorrect
          - "correct_text": the factually correct information that should replace it
        
        Only include statements in "validation_results" if they are actually incorrect. If a statement is correct, don't include it in the array.
        Make sure your JSON is properly formatted with no syntax errors.
        
        IMPORTANT: Don't wrap the JSON in a code block or use ```json markers. Just return the raw JSON object.
        
        JSON RESPONSE:
        """
        
        try:
            response = self.llm.invoke(prompt)
            content = response.content
            
            # Clean the response in case model still included Markdown formatting
            content = self._clean_json_response(content)
            
            return content
        except Exception as e:
            logger.error(f"Error in LLM synthesis: {str(e)}")
            error_json = json.dumps({
                "summary": f"Error synthesizing information: {str(e)}",
                "validation_results": []
            })
            return error_json
            
    def _clean_json_response(self, response: str) -> str:
        """Clean any Markdown formatting from the JSON response.
        
        Args:
            response (str): The response from the LLM
            
        Returns:
            str: Cleaned JSON string
        """
        # Remove markdown code block formatting if present
        response = response.strip()
        
        # Remove ```json at the beginning
        if response.startswith("```json"):
            response = response[7:].strip()
        elif response.startswith("```"):
            response = response[3:].strip()
            
        # Remove trailing ``` if present
        if response.endswith("```"):
            response = response[:-3].strip()
            
        return response

    def run(self, query: str, custom_instructions: str = None) -> str:
        """
        Process the query and retrieve comprehensive information.
        
        Args:
            query (str): The medical query to process
            custom_instructions (str, optional): Custom instructions for the LLM synthesis
        
        Returns:
            str: Synthesized medical information with source references in JSON format
        """
        try:
            # Update custom instructions if provided
            if custom_instructions:
                self.custom_instructions = custom_instructions
                
            logger.info(f"Processing query: '{query}'")
            logger.info(f"Using custom instructions: {self.custom_instructions}")
            
            # First, perform comprehensive search to collect all tool responses
            search_results = self.comprehensive_search(query)
            
            # Generate synthesized response using the LLM with all tool outputs
            json_response = self.synthesize_with_llm(query, search_results)
            
            return json_response
        except Exception as e:
            error_msg = f"An error occurred: {e}. Please try rephrasing your query."
            logger.error(f"Query processing error: {e}")
            error_json = json.dumps({
                "summary": error_msg,
                "validation_results": []
            })
            return error_json

def get_medical_validation(query: str, custom_instructions: str = None): # This function returns the validated response with important source links if any
    # Create the medical agent with optional custom instructions
    agent = EnhancedMedicalAgentSystem(custom_instructions=custom_instructions)

    try:    
        # Run the comprehensive search and get the response
        response = agent.run(query)
        print("\nAssistant:", response)
        return response
        
    except KeyboardInterrupt:
        print("\nOperation cancelled. Type 'exit' to quit.")


# Example usage with custom instructions
if __name__ == "__main__":
    custom_instructions = """
    Focus on fact-checking the medical claims in the query.
    Present accurate information and clearly correct any misconceptions.
    Use authoritative medical sources and provide links to reliable references.
    Structure your response with clear sections addressing each claim separately.
    """
    
    # get_medical_validation(
    #     "The Great Wall of China is the only man-made structure visible from the moon. It was built during the 20th century to protect China from invasions. Albert Einstein invented the light bulb, which revolutionized the modern world. The Amazon rainforest produces 80% of the world's oxygen, making it the lungs of the planet. Humans only use 10% of their brain, and unlocking the remaining 90% could give them superhuman abilities. Mount Everest is the second tallest mountain in the world after K2. Napoleon Bonaparte was extremely short, standing only 4 feet 5 inches tall. Drinking eight glasses of water a day is a scientific requirement for maintaining good health. Penguins can fly short distances when they are escaping predators. The Sahara Desert is the largest desert in the world, covering almost half of Africa. Dinosaurs and humans coexisted for thousands of years before the dinosaurs became extinct.",
    #     custom_instructions=custom_instructions
    # )