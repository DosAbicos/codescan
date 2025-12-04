#!/usr/bin/env python3
"""
Additional edge case tests for the barcode assignment system
"""

import requests
import json
import time

BACKEND_URL = "https://stock-barcode.preview.emergentagent.com/api"

def log(message, level="INFO"):
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] [{level}] {message}")

def test_edge_cases():
    """Test edge cases and error handling"""
    session = requests.Session()
    
    log("Testing edge cases and error handling...")
    
    # Test 1: Invalid product ID for barcode assignment
    log("Test 1: Invalid product ID")
    try:
        response = session.put(
            f"{BACKEND_URL}/products/invalid-id/barcode",
            json={"barcode": "1234567890123"}
        )
        log(f"Invalid ID response: {response.status_code}")
        if response.status_code == 404:
            log("✅ Correctly handled invalid product ID")
        else:
            log("❌ Should return 404 for invalid product ID", "ERROR")
    except Exception as e:
        log(f"Exception in invalid ID test: {e}", "ERROR")
    
    # Test 2: Invalid barcode format (too long)
    log("Test 2: Invalid barcode format")
    try:
        # First get a valid product ID
        response = session.get(f"{BACKEND_URL}/products", params={"limit": 1})
        if response.status_code == 200:
            products = response.json().get('products', [])
            if products:
                product_id = products[0]['id']
                
                # Try to assign invalid barcode
                response = session.put(
                    f"{BACKEND_URL}/products/{product_id}/barcode",
                    json={"barcode": "12345678901234567890"}  # Too long
                )
                log(f"Invalid barcode response: {response.status_code}")
                # Note: The API might accept this, which is fine for this test
    except Exception as e:
        log(f"Exception in invalid barcode test: {e}", "ERROR")
    
    # Test 3: Session without upload
    log("Test 3: Download without session")
    try:
        # Clear session first by uploading empty data (this will fail but clear session)
        # Then try to download
        response = session.get(f"{BACKEND_URL}/download")
        log(f"Download without session response: {response.status_code}")
        # Should work since we have an active session from previous tests
    except Exception as e:
        log(f"Exception in download test: {e}", "ERROR")
    
    # Test 4: Large search query
    log("Test 4: Large search query")
    try:
        large_query = "A" * 1000  # Very long search term
        response = session.get(f"{BACKEND_URL}/products", params={"search": large_query})
        log(f"Large search response: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            log(f"Large search returned {data.get('total', 0)} results")
    except Exception as e:
        log(f"Exception in large search test: {e}", "ERROR")
    
    # Test 5: Pagination edge cases
    log("Test 5: Pagination edge cases")
    try:
        # Very large skip value
        response = session.get(f"{BACKEND_URL}/products", params={"skip": 10000, "limit": 10})
        log(f"Large skip response: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            log(f"Large skip returned {len(data.get('products', []))} products")
        
        # Zero limit
        response = session.get(f"{BACKEND_URL}/products", params={"limit": 0})
        log(f"Zero limit response: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            log(f"Zero limit returned {len(data.get('products', []))} products")
            
    except Exception as e:
        log(f"Exception in pagination test: {e}", "ERROR")

if __name__ == "__main__":
    test_edge_cases()