#!/usr/bin/env python3
"""
Comprehensive endpoint testing script for MeTTa AI Assistant
Run this after the backend is started with Docker
"""

import requests
import json
import time

BASE_URL = "http://localhost:8000"

def print_response(method, endpoint, response):
    """Helper to print formatted responses"""
    print(f"\n{'='*60}")
    print(f"{method} {endpoint}")
    print(f"Status: {response.status_code}")
    if response.status_code != 200:
        print(f"Error: {response.text}")
    else:
        # Truncate long responses for readability
        response_data = response.json()
        if isinstance(response_data, dict) and "response" in response_data:
            # Truncate long AI responses
            if len(response_data["response"]) > 200:
                response_data["response"] = response_data["response"][:200] + "..."
        print(f"Response: {json.dumps(response_data, indent=2)}")
    print(f"{'='*60}")

def test_health():
    """Test health endpoint"""
    print("🧪 Testing Health Endpoint...")
    response = requests.get(f"{BASE_URL}/health")
    print_response("GET", "/health", response)
    return response.status_code == 200

def test_auth_flow():
    """Test complete authentication flow"""
    print("\n🔐 Testing Authentication Flow...")
    
    # Generate unique email to avoid conflicts
    unique_email = f"test_{int(time.time())}@example.com"
    
    # Test signup
    signup_data = {
        "email": unique_email,
        "password": "testpassword123",
        "role": "user"
    }
    response = requests.post(f"{BASE_URL}/api/auth/signup", json=signup_data)
    print_response("POST", "/api/auth/signup", response)
    
    # Test login
    login_data = {
        "email": unique_email,
        "password": "testpassword123"
    }
    response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
    print_response("POST", "/api/auth/login", response)
    
    if response.status_code == 200:
        tokens = response.json()
        access_token = tokens.get("access_token")
        refresh_token = tokens.get("refresh_token")
        
        # Test protected endpoint
        headers = {"Authorization": f"Bearer {access_token}"}
        response = requests.get(f"{BASE_URL}/api/chat/sessions/", headers=headers)
        print_response("GET", "/api/chat/sessions/", response)
        
        return access_token, refresh_token
    return None, None

def test_chat_endpoint(access_token):
    """Test the main chat endpoint"""
    print("\n💬 Testing Chat Endpoint...")
    
    headers = {"Authorization": f"Bearer {access_token}"}
    chat_data = {
        "query": "How do I define a function in MeTTa?",
        "provider": "gemini",
        "mode": "generate",
        "top_k": 3
    }
    
    response = requests.post(f"{BASE_URL}/api/chat/", json=chat_data, headers=headers)
    print_response("POST", "/api/chat/", response)
    
    if response.status_code == 200:
        return response.json().get("session_id")
    return None

def test_chat_sessions(access_token, session_id):
    """Test chat sessions endpoints"""
    print("\n📚 Testing Chat Sessions...")
    
    headers = {"Authorization": f"Bearer {access_token}"}
    
    # List sessions
    response = requests.get(f"{BASE_URL}/api/chat/sessions/", headers=headers)
    print_response("GET", "/api/chat/sessions/", response)
    
    # Get specific session
    if session_id:
        response = requests.get(f"{BASE_URL}/api/chat/sessions/{session_id}", headers=headers)
        print_response("GET", f"/api/chat/sessions/{session_id}", response)

def test_feedback(access_token, session_id):
    """Test feedback submission"""
    print("\n⭐ Testing Feedback System...")
    
    headers = {"Authorization": f"Bearer {access_token}"}
    feedback_data = {
        "responseId": f"resp_test_{int(time.time())}",
        "sessionId": session_id or "test_session",
        "sentiment": "positive",
        "comment": "Great response from the AI assistant!"
    }
    
    response = requests.post(f"{BASE_URL}/api/feedback/submit", json=feedback_data, headers=headers)
    print_response("POST", "/api/feedback/submit", response)

def test_search_endpoint(access_token):
    """Test search functionality"""
    print("\n🔍 Testing Search Endpoint...")
    
    headers = {"Authorization": f"Bearer {access_token}"}
    search_data = {
        "query": "function definition",
        "provider": "gemini", 
        "mode": "search",
        "top_k": 2
    }
    
    response = requests.post(f"{BASE_URL}/api/chat/", json=search_data, headers=headers)
    print_response("POST", "/api/chat/ (search mode)", response)

def main():
    """Run all tests"""
    print("🚀 Starting MeTTa AI Assistant Endpoint Tests")
    print("Make sure the backend is running on http://localhost:8000")
    print("=" * 60)
    
    # Test health
    if not test_health():
        print("❌ Health check failed! Is the backend running?")
        return
    
    # Test authentication and get tokens
    access_token, refresh_token = test_auth_flow()
    
    if not access_token:
        print("❌ Authentication flow failed!")
        return
    
    # Test search functionality
    test_search_endpoint(access_token)
    
    # Test chat functionality
    session_id = test_chat_endpoint(access_token)
    
    # Test sessions
    test_chat_sessions(access_token, session_id)
    
    # Test feedback
    test_feedback(access_token, session_id)
    
    print("\n" + "=" * 60)
    print("✅ All endpoint tests completed!")
    if access_token:
        print(f"Access Token: {access_token[:20]}...")
    if refresh_token:
        print(f"Refresh Token: {refresh_token[:20]}...")
    if session_id:
        print(f"Session ID: {session_id}")
    print("=" * 60)

if __name__ == "__main__":
    main()