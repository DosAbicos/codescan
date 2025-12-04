#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Barcode Assignment System
Tests all backend endpoints with real data scenarios
"""

import requests
import json
import os
import time
from pathlib import Path

# Configuration
BACKEND_URL = "https://stock-barcode.preview.emergentagent.com/api"
SAMPLE_FILE_PATH = "/app/sample_file.xls"

class BarcodeAPITester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.session = requests.Session()
        self.session_id = None
        self.test_product_id = None
        
    def log(self, message, level="INFO"):
        """Log test messages with timestamp"""
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] [{level}] {message}")
        
    def test_upload_excel(self):
        """Test POST /api/upload - Upload Excel file"""
        self.log("Testing Excel file upload...")
        
        if not os.path.exists(SAMPLE_FILE_PATH):
            self.log(f"Sample file not found at {SAMPLE_FILE_PATH}", "ERROR")
            return False
            
        try:
            with open(SAMPLE_FILE_PATH, 'rb') as f:
                files = {'file': ('sample_file.xls', f, 'application/vnd.ms-excel')}
                response = self.session.post(f"{self.base_url}/upload", files=files)
                
            self.log(f"Upload response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"Upload response: {json.dumps(data, indent=2)}")
                
                # Verify response structure
                if not data.get('success'):
                    self.log("Upload failed - success is False", "ERROR")
                    return False
                    
                self.session_id = data.get('session_id')
                total_products = data.get('total_products', 0)
                products_with_barcode = data.get('products_with_barcode', 0)
                
                self.log(f"Session ID: {self.session_id}")
                self.log(f"Total products parsed: {total_products}")
                self.log(f"Products with existing barcodes: {products_with_barcode}")
                
                # Verify expected product count (~3224 as mentioned in requirements)
                if total_products < 3000:
                    self.log(f"WARNING: Expected ~3224 products, got {total_products}", "WARN")
                
                return True
            else:
                self.log(f"Upload failed with status {response.status_code}: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"Upload test failed with exception: {str(e)}", "ERROR")
            return False
    
    def test_get_session(self):
        """Test GET /api/session - Get current session"""
        self.log("Testing get current session...")
        
        try:
            response = self.session.get(f"{self.base_url}/session")
            self.log(f"Session response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"Session data: {json.dumps(data, indent=2)}")
                
                session = data.get('session')
                if not session:
                    self.log("No active session found", "ERROR")
                    return False
                    
                # Verify session structure
                required_fields = ['id', 'filename', 'total_products', 'products_with_barcode']
                for field in required_fields:
                    if field not in session:
                        self.log(f"Missing required field in session: {field}", "ERROR")
                        return False
                
                self.log(f"Session verified - ID: {session['id']}, File: {session['filename']}")
                return True
            else:
                self.log(f"Get session failed with status {response.status_code}: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"Get session test failed with exception: {str(e)}", "ERROR")
            return False
    
    def test_get_products_filtering(self):
        """Test GET /api/products - Get products with various filters"""
        self.log("Testing product filtering...")
        
        test_cases = [
            {"name": "All products", "params": {}},
            {"name": "Products without barcode", "params": {"has_barcode": False}},
            {"name": "Products with barcode", "params": {"has_barcode": True}},
            {"name": "Search by name", "params": {"search": "товар"}},
            {"name": "Pagination test", "params": {"skip": 0, "limit": 10}}
        ]
        
        all_passed = True
        
        for test_case in test_cases:
            try:
                self.log(f"Testing: {test_case['name']}")
                response = self.session.get(f"{self.base_url}/products", params=test_case['params'])
                
                if response.status_code == 200:
                    data = response.json()
                    total = data.get('total', 0)
                    products = data.get('products', [])
                    
                    self.log(f"  Result: {total} total products, {len(products)} returned")
                    
                    # Store a test product ID for barcode assignment test
                    if products and not self.test_product_id:
                        # Find a product without barcode for testing
                        for product in products:
                            if not product.get('barcode'):
                                self.test_product_id = product.get('id')
                                self.log(f"  Selected test product: {product.get('name')} (ID: {self.test_product_id})")
                                break
                    
                    # Verify response structure
                    if 'total' not in data or 'products' not in data:
                        self.log(f"  ERROR: Invalid response structure", "ERROR")
                        all_passed = False
                        
                else:
                    self.log(f"  ERROR: Status {response.status_code}: {response.text}", "ERROR")
                    all_passed = False
                    
            except Exception as e:
                self.log(f"  ERROR: Exception in {test_case['name']}: {str(e)}", "ERROR")
                all_passed = False
        
        return all_passed
    
    def test_barcode_assignment(self):
        """Test PUT /api/products/{id}/barcode - Update barcode"""
        self.log("Testing barcode assignment...")
        
        if not self.test_product_id:
            self.log("No test product ID available for barcode assignment", "ERROR")
            return False
        
        test_barcode = "1234567890123"  # Valid EAN-13 format
        
        try:
            # Assign barcode
            self.log(f"Assigning barcode {test_barcode} to product {self.test_product_id}")
            payload = {"barcode": test_barcode}
            response = self.session.put(
                f"{self.base_url}/products/{self.test_product_id}/barcode",
                json=payload
            )
            
            self.log(f"Barcode assignment response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"Assignment response: {json.dumps(data, indent=2)}")
                
                if not data.get('success'):
                    self.log("Barcode assignment failed - success is False", "ERROR")
                    return False
                
                product = data.get('product', {})
                if product.get('barcode') != test_barcode:
                    self.log(f"Barcode mismatch: expected {test_barcode}, got {product.get('barcode')}", "ERROR")
                    return False
                
                self.log("Barcode assignment successful")
                
                # Test barcode deletion (set to null)
                self.log("Testing barcode deletion...")
                payload = {"barcode": None}
                response = self.session.put(
                    f"{self.base_url}/products/{self.test_product_id}/barcode",
                    json=payload
                )
                
                if response.status_code == 200:
                    data = response.json()
                    product = data.get('product', {})
                    if product.get('barcode') is not None:
                        self.log("Barcode deletion failed - barcode still present", "ERROR")
                        return False
                    self.log("Barcode deletion successful")
                else:
                    self.log(f"Barcode deletion failed with status {response.status_code}", "ERROR")
                    return False
                
                return True
            else:
                self.log(f"Barcode assignment failed with status {response.status_code}: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"Barcode assignment test failed with exception: {str(e)}", "ERROR")
            return False
    
    def test_download_excel(self):
        """Test GET /api/download - Download updated Excel"""
        self.log("Testing Excel download...")
        
        try:
            response = self.session.get(f"{self.base_url}/download")
            self.log(f"Download response status: {response.status_code}")
            
            if response.status_code == 200:
                # Check content type
                content_type = response.headers.get('content-type', '')
                self.log(f"Download content type: {content_type}")
                
                # Check file size
                content_length = len(response.content)
                self.log(f"Downloaded file size: {content_length} bytes")
                
                if content_length == 0:
                    self.log("Downloaded file is empty", "ERROR")
                    return False
                
                # Verify it's a valid Excel file by checking headers
                if response.content[:2] == b'PK':  # ZIP signature (xlsx files are ZIP archives)
                    self.log("Downloaded file appears to be a valid Excel file")
                    
                    # Save file for verification
                    output_path = "/app/test_download.xlsx"
                    with open(output_path, 'wb') as f:
                        f.write(response.content)
                    self.log(f"File saved to {output_path} for verification")
                    
                    return True
                else:
                    self.log("Downloaded file does not appear to be a valid Excel file", "ERROR")
                    return False
            else:
                self.log(f"Download failed with status {response.status_code}: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"Download test failed with exception: {str(e)}", "ERROR")
            return False
    
    def run_all_tests(self):
        """Run all backend API tests"""
        self.log("=" * 60)
        self.log("STARTING COMPREHENSIVE BACKEND API TESTING")
        self.log("=" * 60)
        
        test_results = {}
        
        # Test 1: Upload Excel file
        test_results['upload'] = self.test_upload_excel()
        
        # Test 2: Get current session
        test_results['session'] = self.test_get_session()
        
        # Test 3: Get products with filtering
        test_results['products_filtering'] = self.test_get_products_filtering()
        
        # Test 4: Barcode assignment and deletion
        test_results['barcode_assignment'] = self.test_barcode_assignment()
        
        # Test 5: Download Excel
        test_results['download'] = self.test_download_excel()
        
        # Summary
        self.log("=" * 60)
        self.log("TEST RESULTS SUMMARY")
        self.log("=" * 60)
        
        passed = 0
        total = len(test_results)
        
        for test_name, result in test_results.items():
            status = "PASS" if result else "FAIL"
            self.log(f"{test_name.upper()}: {status}")
            if result:
                passed += 1
        
        self.log(f"\nOVERALL: {passed}/{total} tests passed")
        
        if passed == total:
            self.log("🎉 ALL TESTS PASSED! Backend API is working correctly.", "SUCCESS")
        else:
            self.log(f"❌ {total - passed} tests failed. Backend needs attention.", "ERROR")
        
        return test_results

if __name__ == "__main__":
    tester = BarcodeAPITester()
    results = tester.run_all_tests()