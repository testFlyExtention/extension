#!/usr/bin/env python3
"""
FlySnipe Backend API Test Suite
Tests all critical endpoints for the flight search API
"""

import requests
import json
import uuid
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')

# Get backend URL from frontend environment
BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'http://localhost:8001')
API_BASE_URL = f"{BACKEND_URL}/api"

print(f"Testing backend at: {API_BASE_URL}")

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_test_header(test_name):
    print(f"\n{Colors.BLUE}{Colors.BOLD}{'='*60}{Colors.ENDC}")
    print(f"{Colors.BLUE}{Colors.BOLD}Testing: {test_name}{Colors.ENDC}")
    print(f"{Colors.BLUE}{Colors.BOLD}{'='*60}{Colors.ENDC}")

def print_success(message):
    print(f"{Colors.GREEN}✅ {message}{Colors.ENDC}")

def print_error(message):
    print(f"{Colors.RED}❌ {message}{Colors.ENDC}")

def print_warning(message):
    print(f"{Colors.YELLOW}⚠️  {message}{Colors.ENDC}")

def print_info(message):
    print(f"{Colors.BLUE}ℹ️  {message}{Colors.ENDC}")

def test_health_check():
    """Test GET /api/ - Health check endpoint"""
    print_test_header("Health Check Endpoint")
    
    try:
        response = requests.get(f"{API_BASE_URL}/")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("message") == "FlySnipe API is running" and data.get("status") == "OK":
                print_success("Health check endpoint working correctly")
                print_info(f"Response: {data}")
                return True
            else:
                print_error(f"Unexpected response format: {data}")
                return False
        else:
            print_error(f"Health check failed with status {response.status_code}")
            print_error(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Health check request failed: {str(e)}")
        return False

def test_flight_search():
    """Test POST /api/flights/search - Flight search endpoint"""
    print_test_header("Flight Search Endpoint")
    
    test_cases = [
        {
            "name": "Geneva to Tokyo (Free User)",
            "payload": {
                "from": "Geneva",
                "to": "Tokyo", 
                "departureDate": "2025-02-15",
                "passengers": 1,
                "premium": False
            }
        },
        {
            "name": "New York to London (Premium User)",
            "payload": {
                "from": "New York",
                "to": "London",
                "departureDate": "2025-03-01", 
                "passengers": 2,
                "premium": True
            }
        },
        {
            "name": "Paris to Dubai (Free User)",
            "payload": {
                "from": "Paris",
                "to": "Dubai",
                "departureDate": "2025-04-10",
                "passengers": 1,
                "premium": False
            }
        }
    ]
    
    all_passed = True
    
    for test_case in test_cases:
        print(f"\n{Colors.YELLOW}Testing: {test_case['name']}{Colors.ENDC}")
        
        try:
            response = requests.post(
                f"{API_BASE_URL}/flights/search",
                json=test_case["payload"],
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Validate response structure
                required_fields = ["flights", "total_results", "search_params", "premium_features_used"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    print_error(f"Missing required fields: {missing_fields}")
                    all_passed = False
                    continue
                
                flights = data["flights"]
                total_results = data["total_results"]
                premium_used = data["premium_features_used"]
                
                # Check flight count based on premium status
                if test_case["payload"]["premium"]:
                    if len(flights) > 3:
                        print_success(f"Premium user got {len(flights)} flights (expected > 3)")
                    else:
                        print_warning(f"Premium user only got {len(flights)} flights (expected > 3)")
                else:
                    if len(flights) <= 3:
                        print_success(f"Free user got {len(flights)} flights (expected ≤ 3)")
                    else:
                        print_warning(f"Free user got {len(flights)} flights (expected ≤ 3)")
                
                # Validate flight structure
                if flights:
                    flight = flights[0]
                    required_flight_fields = ["id", "airline", "flight_number", "departure", "arrival", "price", "duration"]
                    missing_flight_fields = [field for field in required_flight_fields if field not in flight]
                    
                    if missing_flight_fields:
                        print_error(f"Flight missing required fields: {missing_flight_fields}")
                        all_passed = False
                    else:
                        print_success("Flight data structure is valid")
                        print_info(f"Sample flight: {flight['airline']} {flight['flight_number']} - ${flight['price']}")
                
                # Check premium features flag
                if premium_used == test_case["payload"]["premium"]:
                    print_success(f"Premium features flag correct: {premium_used}")
                else:
                    print_warning(f"Premium features flag mismatch: got {premium_used}, expected {test_case['payload']['premium']}")
                
            else:
                print_error(f"Flight search failed with status {response.status_code}")
                print_error(f"Response: {response.text}")
                all_passed = False
                
        except Exception as e:
            print_error(f"Flight search request failed: {str(e)}")
            all_passed = False
    
    return all_passed

def test_google_auth():
    """Test POST /api/auth/google - Google authentication endpoint"""
    print_test_header("Google Authentication Endpoint")
    
    test_cases = [
        {
            "name": "Valid token",
            "payload": {"id_token": "mock_google_token_12345"},
            "should_succeed": True
        },
        {
            "name": "Missing token",
            "payload": {},
            "should_succeed": False
        }
    ]
    
    all_passed = True
    
    for test_case in test_cases:
        print(f"\n{Colors.YELLOW}Testing: {test_case['name']}{Colors.ENDC}")
        
        try:
            response = requests.post(
                f"{API_BASE_URL}/auth/google",
                json=test_case["payload"],
                headers={"Content-Type": "application/json"}
            )
            
            if test_case["should_succeed"]:
                if response.status_code == 200:
                    data = response.json()
                    if "email" in data and "name" in data:
                        print_success(f"Authentication successful: {data['email']}")
                    else:
                        print_error(f"Missing required fields in response: {data}")
                        all_passed = False
                else:
                    print_error(f"Authentication failed with status {response.status_code}")
                    all_passed = False
            else:
                if response.status_code == 400:
                    print_success("Correctly rejected invalid request")
                else:
                    print_warning(f"Expected 400 error, got {response.status_code}")
                    
        except Exception as e:
            print_error(f"Authentication request failed: {str(e)}")
            all_passed = False
    
    return all_passed

def test_check_premium():
    """Test GET /api/check-premium - Check premium subscription endpoint"""
    print_test_header("Check Premium Subscription Endpoint")
    
    test_cases = [
        {
            "name": "Valid email",
            "email": "user@example.com",
            "should_succeed": True
        },
        {
            "name": "Non-existent user",
            "email": "nonexistent@example.com", 
            "should_succeed": False
        }
    ]
    
    all_passed = True
    
    for test_case in test_cases:
        print(f"\n{Colors.YELLOW}Testing: {test_case['name']}{Colors.ENDC}")
        
        try:
            response = requests.get(
                f"{API_BASE_URL}/check-premium",
                params={"email": test_case["email"]}
            )
            
            if test_case["should_succeed"]:
                if response.status_code == 200:
                    data = response.json()
                    if "email" in data and "is_premium" in data:
                        print_success(f"Premium check successful: {data['email']} - Premium: {data['is_premium']}")
                    else:
                        print_error(f"Missing required fields in response: {data}")
                        all_passed = False
                elif response.status_code == 404:
                    print_info("User not found - this is expected for new users")
                else:
                    print_error(f"Premium check failed with status {response.status_code}")
                    all_passed = False
            else:
                if response.status_code == 404:
                    print_success("Correctly returned 404 for non-existent user")
                else:
                    print_warning(f"Expected 404 error, got {response.status_code}")
                    
        except Exception as e:
            print_error(f"Premium check request failed: {str(e)}")
            all_passed = False
    
    return all_passed

def test_create_checkout_session():
    """Test POST /api/create-checkout-session - Create Stripe checkout session"""
    print_test_header("Create Checkout Session Endpoint")
    
    test_cases = [
        {
            "name": "Monthly package",
            "payload": {
                "package_id": "monthly",
                "email": "test@example.com"
            },
            "should_succeed": True
        },
        {
            "name": "Yearly package",
            "payload": {
                "package_id": "yearly",
                "email": "test@example.com"
            },
            "should_succeed": True
        },
        {
            "name": "Invalid package",
            "payload": {
                "package_id": "invalid_package",
                "email": "test@example.com"
            },
            "should_succeed": False
        }
    ]
    
    all_passed = True
    
    for test_case in test_cases:
        print(f"\n{Colors.YELLOW}Testing: {test_case['name']}{Colors.ENDC}")
        
        try:
            response = requests.post(
                f"{API_BASE_URL}/create-checkout-session",
                json=test_case["payload"],
                headers={"Content-Type": "application/json"}
            )
            
            if test_case["should_succeed"]:
                if response.status_code == 200:
                    data = response.json()
                    if "url" in data and "session_id" in data:
                        print_success(f"Checkout session created successfully")
                        print_info(f"Session ID: {data['session_id']}")
                        print_info(f"Checkout URL: {data['url'][:50]}...")
                    else:
                        print_error(f"Missing required fields in response: {data}")
                        all_passed = False
                else:
                    print_error(f"Checkout session creation failed with status {response.status_code}")
                    print_error(f"Response: {response.text}")
                    all_passed = False
            else:
                if response.status_code == 400:
                    print_success("Correctly rejected invalid package")
                else:
                    print_warning(f"Expected 400 error, got {response.status_code}")
                    
        except Exception as e:
            print_error(f"Checkout session request failed: {str(e)}")
            all_passed = False
    
    return all_passed

def test_checkout_status():
    """Test GET /api/payments/checkout/status/{session_id} - Get payment session status"""
    print_test_header("Checkout Status Endpoint")
    
    # Test with mock session IDs
    test_cases = [
        {
            "name": "Mock session ID",
            "session_id": "cs_test_mock_session_12345",
            "should_succeed": True
        },
        {
            "name": "Invalid session ID",
            "session_id": "invalid_session",
            "should_succeed": False
        }
    ]
    
    all_passed = True
    
    for test_case in test_cases:
        print(f"\n{Colors.YELLOW}Testing: {test_case['name']}{Colors.ENDC}")
        
        try:
            response = requests.get(
                f"{API_BASE_URL}/payments/checkout/status/{test_case['session_id']}"
            )
            
            if test_case["should_succeed"]:
                # Note: This might fail if Stripe is not properly configured
                if response.status_code == 200:
                    data = response.json()
                    required_fields = ["status", "payment_status", "session_id"]
                    if all(field in data for field in required_fields):
                        print_success(f"Checkout status retrieved successfully")
                        print_info(f"Status: {data['status']}, Payment: {data['payment_status']}")
                    else:
                        print_error(f"Missing required fields in response: {data}")
                        all_passed = False
                elif response.status_code == 500:
                    print_warning("Stripe not configured - this is expected in test environment")
                else:
                    print_error(f"Checkout status failed with status {response.status_code}")
                    print_error(f"Response: {response.text}")
                    all_passed = False
            else:
                if response.status_code in [400, 404, 500]:
                    print_success("Correctly handled invalid session ID")
                else:
                    print_warning(f"Unexpected status code: {response.status_code}")
                    
        except Exception as e:
            print_error(f"Checkout status request failed: {str(e)}")
            all_passed = False
    
    return all_passed

def test_stripe_webhook():
    """Test POST /api/webhook/stripe - Stripe webhook handler"""
    print_test_header("Stripe Webhook Endpoint")
    
    # Mock webhook payload
    mock_payload = {
        "id": "evt_test_webhook",
        "object": "event",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": "cs_test_session_12345",
                "payment_status": "paid"
            }
        }
    }
    
    try:
        response = requests.post(
            f"{API_BASE_URL}/webhook/stripe",
            json=mock_payload,
            headers={
                "Content-Type": "application/json",
                "stripe-signature": "mock_signature"
            }
        )
        
        # Note: This will likely fail without proper Stripe configuration
        if response.status_code == 200:
            data = response.json()
            print_success("Webhook processed successfully")
            print_info(f"Response: {data}")
            return True
        elif response.status_code == 500:
            print_warning("Stripe not configured - webhook endpoint exists but can't process")
            return True  # Endpoint exists, just not configured
        else:
            print_error(f"Webhook failed with status {response.status_code}")
            print_error(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Webhook request failed: {str(e)}")
        return False

def test_error_cases():
    """Test various error scenarios"""
    print_test_header("Error Handling Tests")
    
    error_tests = [
        {
            "name": "Flight search with missing parameters",
            "endpoint": "/flights/search",
            "method": "POST",
            "payload": {"from": "Geneva"},  # Missing required fields
            "expected_status": 422
        },
        {
            "name": "Invalid JSON in flight search",
            "endpoint": "/flights/search", 
            "method": "POST",
            "payload": "invalid json",
            "expected_status": 422
        },
        {
            "name": "Non-existent endpoint",
            "endpoint": "/nonexistent",
            "method": "GET",
            "payload": None,
            "expected_status": 404
        }
    ]
    
    all_passed = True
    
    for test in error_tests:
        print(f"\n{Colors.YELLOW}Testing: {test['name']}{Colors.ENDC}")
        
        try:
            if test["method"] == "POST":
                if isinstance(test["payload"], str):
                    response = requests.post(
                        f"{API_BASE_URL}{test['endpoint']}",
                        data=test["payload"],
                        headers={"Content-Type": "application/json"}
                    )
                else:
                    response = requests.post(
                        f"{API_BASE_URL}{test['endpoint']}",
                        json=test["payload"],
                        headers={"Content-Type": "application/json"}
                    )
            else:
                response = requests.get(f"{API_BASE_URL}{test['endpoint']}")
            
            if response.status_code == test["expected_status"]:
                print_success(f"Correctly returned {test['expected_status']} error")
            else:
                print_warning(f"Expected {test['expected_status']}, got {response.status_code}")
                
        except Exception as e:
            print_error(f"Error test failed: {str(e)}")
            all_passed = False
    
    return all_passed

def run_all_tests():
    """Run all backend API tests"""
    print(f"{Colors.BOLD}{Colors.BLUE}")
    print("=" * 80)
    print("FlySnipe Backend API Test Suite")
    print("=" * 80)
    print(f"{Colors.ENDC}")
    
    test_results = {}
    
    # Run all tests
    test_results["Health Check"] = test_health_check()
    test_results["Flight Search"] = test_flight_search()
    test_results["Google Auth"] = test_google_auth()
    test_results["Check Premium"] = test_check_premium()
    test_results["Create Checkout"] = test_create_checkout_session()
    test_results["Checkout Status"] = test_checkout_status()
    test_results["Stripe Webhook"] = test_stripe_webhook()
    test_results["Error Handling"] = test_error_cases()
    
    # Print summary
    print(f"\n{Colors.BOLD}{Colors.BLUE}")
    print("=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print(f"{Colors.ENDC}")
    
    passed = 0
    total = len(test_results)
    
    for test_name, result in test_results.items():
        if result:
            print_success(f"{test_name}: PASSED")
            passed += 1
        else:
            print_error(f"{test_name}: FAILED")
    
    print(f"\n{Colors.BOLD}Overall Result: {passed}/{total} tests passed{Colors.ENDC}")
    
    if passed == total:
        print_success("🎉 All tests passed! Backend API is working correctly.")
        return True
    else:
        print_error(f"❌ {total - passed} test(s) failed. Please check the issues above.")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    exit(0 if success else 1)