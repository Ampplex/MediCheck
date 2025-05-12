import requests

BASE_URL = "http://localhost:8000"  # Change if deployed on a different server

def test_summarize():
    print("\nTesting /summarize endpoint...")
    sample_payload = {
        "content": {
            "title": "AI in Healthcare",
            "url": "https://example.com/ai-healthcare",
            "text": "Artificial Intelligence is transforming the healthcare industry...",
            "metadata": {
                "description": "A study on AI advancements in healthcare.",
                "keywords": "AI, Healthcare, Technology",
                "author": "John Doe",
                "ogTitle": "AI & Healthcare",
                "ogDescription": "Exploring AI applications in medicine."
            }
        }
    }
    
    response = requests.post(f"{BASE_URL}/summarize", json=sample_payload)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")

def test_chat():
    print("\nTesting /chat endpoint...")
    sample_payload = {
        "message": "What have we discussed so far?."
    }
    
    response = requests.post(f"{BASE_URL}/chat", json=sample_payload)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")

def test_health():
    print("\nTesting /health endpoint...")
    response = requests.get(f"{BASE_URL}/health")
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")

if __name__ == "__main__":
    test_health()
    test_summarize()
    test_chat()