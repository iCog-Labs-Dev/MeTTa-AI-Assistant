import pytest
from fastapi.testclient import TestClient

class TestAuthentication:
    """Test authentication endpoints and flow"""
    
    def test_health_endpoint(self, client):
        """Test health endpoint without authentication"""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}
    
    def test_signup_and_login_flow(self, client):
        """Test complete user registration and login flow"""
        # Sign up new user
        signup_data = {
            "email": "integration_test@example.com",
            "password": "securepassword123",
            "role": "user"
        }
        
        response = client.post("/api/auth/signup", json=signup_data)
        assert response.status_code == 201
        assert "user_id" in response.json()
        
        # Login with new user
        login_data = {
            "email": "integration_test@example.com",
            "password": "securepassword123"
        }
        
        response = client.post("/api/auth/login", json=login_data)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
    
    def test_protected_endpoint_without_token(self, client):
        """Test that protected endpoints require authentication"""
        response = client.get("/api/chat/sessions/")
        assert response.status_code == 401  # Unauthorized
    
    def test_protected_endpoint_with_valid_token(self, client):
        """Test protected endpoint with valid token"""
        # First create a user and get token
        signup_data = {
            "email": "protected_test@example.com", 
            "password": "password123",
            "role": "user"
        }
        client.post("/api/auth/signup", json=signup_data)
        
        login_data = {
            "email": "protected_test@example.com",
            "password": "password123"
        }
        login_response = client.post("/api/auth/login", json=login_data)
        token = login_response.json()["access_token"]
        
        # Access protected endpoint
        headers = {"Authorization": f"Bearer {token}"}
        response = client.get("/api/chat/sessions/", headers=headers)
        
        # Should succeed (even if no sessions exist)
        assert response.status_code == 200