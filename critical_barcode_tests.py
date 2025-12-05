#!/usr/bin/env python3
"""
Critical Barcode Assignment Testing
Tests specific issues with barcode persistence and Excel export accuracy
"""

import requests
import json
import os
import time
import xlrd
from pathlib import Path

# Configuration
BACKEND_URL = "https://stock-barcode.preview.emergentagent.com/api"
SAMPLE_FILE_PATH = "/app/sample_file.xls"

class CriticalBarcodeTests:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.session = requests.Session()
        self.session_id = None
        self.test_results = {}
        
    def log(self, message, level="INFO"):
        """Log test messages with timestamp"""
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] [{level}] {message}")
        
    def upload_fresh_file(self):
        """Upload a fresh sample file"""
        self.log("Uploading fresh sample file...")
        
        if not os.path.exists(SAMPLE_FILE_PATH):
            self.log(f"Sample file not found at {SAMPLE_FILE_PATH}", "ERROR")
            return False
            
        try:
            with open(SAMPLE_FILE_PATH, 'rb') as f:
                files = {'file': ('sample_file.xls', f, 'application/vnd.ms-excel')}
                response = self.session.post(f"{self.base_url}/upload", files=files)
                
            if response.status_code == 200:
                data = response.json()
                self.session_id = data.get('session_id')
                self.log(f"Fresh upload successful - Session ID: {self.session_id}")
                self.log(f"Total products: {data.get('total_products')}")
                return True
            else:
                self.log(f"Upload failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"Upload failed with exception: {str(e)}", "ERROR")
            return False
    
    def find_product_by_name(self, search_name):
        """Find a product by name"""
        try:
            response = self.session.get(f"{self.base_url}/products", params={"search": search_name})
            if response.status_code == 200:
                data = response.json()
                products = data.get('products', [])
                if products:
                    return products[0]  # Return first match
            return None
        except Exception as e:
            self.log(f"Error finding product: {str(e)}", "ERROR")
            return None
    
    def assign_barcode_to_product(self, product_id, barcode, quantity=None):
        """Assign barcode to a product"""
        try:
            payload = {"barcode": barcode}
            if quantity is not None:
                payload["quantity_actual"] = quantity
                
            response = self.session.put(
                f"{self.base_url}/products/{product_id}/barcode",
                json=payload
            )
            
            if response.status_code == 200:
                data = response.json()
                return data.get('success', False)
            else:
                self.log(f"Barcode assignment failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"Barcode assignment failed with exception: {str(e)}", "ERROR")
            return False
    
    def remove_barcode_from_product(self, product_id):
        """Remove barcode from a product"""
        try:
            payload = {"barcode": None}
            response = self.session.put(
                f"{self.base_url}/products/{product_id}/barcode",
                json=payload
            )
            
            if response.status_code == 200:
                data = response.json()
                return data.get('success', False)
            else:
                self.log(f"Barcode removal failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"Barcode removal failed with exception: {str(e)}", "ERROR")
            return False
    
    def download_and_analyze_excel(self, save_path):
        """Download Excel and analyze barcode positions"""
        try:
            response = self.session.get(f"{self.base_url}/download")
            if response.status_code == 200:
                with open(save_path, 'wb') as f:
                    f.write(response.content)
                
                # Analyze the Excel file
                return self.analyze_excel_barcodes(save_path)
            else:
                self.log(f"Download failed: {response.status_code} - {response.text}", "ERROR")
                return None
                
        except Exception as e:
            self.log(f"Download failed with exception: {str(e)}", "ERROR")
            return None
    
    def analyze_excel_barcodes(self, file_path):
        """Analyze Excel file to find barcode positions"""
        try:
            workbook = xlrd.open_workbook(file_path)
            sheet = workbook.sheet_by_index(0)
            
            barcode_info = []
            
            # Check each row for barcodes (column 8 = I)
            for row_idx in range(sheet.nrows):
                try:
                    barcode_cell = sheet.cell_value(row_idx, 8)  # Column I (barcode)
                    product_name_cell = sheet.cell_value(row_idx, 0)  # Column A (product name)
                    
                    if barcode_cell and str(barcode_cell).strip():
                        barcode_info.append({
                            'row': row_idx,
                            'barcode': str(barcode_cell).strip(),
                            'product_name': str(product_name_cell).strip() if product_name_cell else ""
                        })
                except:
                    continue  # Skip rows with errors
            
            return barcode_info
            
        except Exception as e:
            self.log(f"Excel analysis failed: {str(e)}", "ERROR")
            return None
    
    def test_scenario_1_fresh_upload_export(self):
        """Scenario 1: Fresh Upload and Export"""
        self.log("\n" + "="*60)
        self.log("SCENARIO 1: Fresh Upload and Export")
        self.log("="*60)
        
        # Upload fresh file
        if not self.upload_fresh_file():
            return False
        
        # Get session info
        response = self.session.get(f"{self.base_url}/session")
        if response.status_code == 200:
            session_data = response.json().get('session', {})
            self.log(f"Session created - Total products: {session_data.get('total_products')}")
        
        # Export without changes
        barcode_info = self.download_and_analyze_excel("/app/test_scenario1.xls")
        if barcode_info is not None:
            self.log(f"Found {len(barcode_info)} existing barcodes in fresh export")
            for info in barcode_info:
                self.log(f"  Row {info['row']}: {info['barcode']} - {info['product_name'][:50]}...")
            return True
        
        return False
    
    def test_scenario_2_ideal_product_barcode(self):
        """Scenario 2: Single Barcode Assignment to IDEAL product"""
        self.log("\n" + "="*60)
        self.log("SCENARIO 2: IDEAL ПАРКЕТНЫЙ ЛАК ГЛЯНЦЕВЫЙ (10L) Barcode Assignment")
        self.log("="*60)
        
        # Upload fresh file
        if not self.upload_fresh_file():
            return False
        
        # Find the specific product
        target_product_name = "IDEAL ПАРКЕТНЫЙ ЛАК ГЛЯНЦЕВЫЙ (10L)"
        self.log(f"Searching for product: {target_product_name}")
        
        product = self.find_product_by_name("IDEAL ПАРКЕТНЫЙ ЛАК")
        if not product:
            self.log("Target product not found", "ERROR")
            return False
        
        self.log(f"Found product: {product.get('name')} (ID: {product.get('id')})")
        self.log(f"Product row_index: {product.get('row_index')}")
        
        # Assign barcode
        test_barcode = "TEST10L"
        if not self.assign_barcode_to_product(product.get('id'), test_barcode, 50):
            return False
        
        self.log(f"Assigned barcode {test_barcode} to product")
        
        # Export and verify
        barcode_info = self.download_and_analyze_excel("/app/test_scenario2.xls")
        if barcode_info is None:
            return False
        
        # Find our barcode in the export
        found_barcode = None
        for info in barcode_info:
            if info['barcode'] == test_barcode:
                found_barcode = info
                break
        
        if found_barcode:
            self.log(f"SUCCESS: Barcode {test_barcode} found at row {found_barcode['row']}")
            self.log(f"Product name at that row: {found_barcode['product_name']}")
            
            # Check if it's the correct row (should match product row_index + 1)
            expected_row = product.get('row_index') + 1
            actual_row = found_barcode['row']
            
            if actual_row == expected_row:
                self.log(f"✅ CORRECT ROW: Barcode is at expected row {expected_row}")
                return True
            else:
                self.log(f"❌ WRONG ROW: Expected row {expected_row}, found at row {actual_row}", "ERROR")
                return False
        else:
            self.log(f"❌ BARCODE NOT FOUND: {test_barcode} not found in exported file", "ERROR")
            return False
    
    def test_scenario_3_multiple_operations(self):
        """Scenario 3: Multiple Operations - Assign, Delete, Reassign"""
        self.log("\n" + "="*60)
        self.log("SCENARIO 3: Multiple Operations (Assign → Delete → Reassign)")
        self.log("="*60)
        
        # Upload fresh file
        if not self.upload_fresh_file():
            return False
        
        # Find two different products
        response = self.session.get(f"{self.base_url}/products", params={"has_barcode": False, "limit": 10})
        if response.status_code != 200:
            return False
        
        products = response.json().get('products', [])
        if len(products) < 2:
            self.log("Need at least 2 products for this test", "ERROR")
            return False
        
        product_a = products[0]
        product_b = products[1]
        
        self.log(f"Product A: {product_a.get('name')[:50]}... (ID: {product_a.get('id')})")
        self.log(f"Product B: {product_b.get('name')[:50]}... (ID: {product_b.get('id')})")
        
        # Step 1: Assign barcode to Product A
        barcode_test = "MULTI123"
        if not self.assign_barcode_to_product(product_a.get('id'), barcode_test):
            return False
        self.log(f"Step 1: Assigned barcode {barcode_test} to Product A")
        
        # Step 2: Remove barcode from Product A
        if not self.remove_barcode_from_product(product_a.get('id')):
            return False
        self.log(f"Step 2: Removed barcode from Product A")
        
        # Step 3: Assign same barcode to Product B
        if not self.assign_barcode_to_product(product_b.get('id'), barcode_test):
            return False
        self.log(f"Step 3: Assigned barcode {barcode_test} to Product B")
        
        # Step 4: Export and verify
        barcode_info = self.download_and_analyze_excel("/app/test_scenario3.xls")
        if barcode_info is None:
            return False
        
        # Check that barcode appears only once (for Product B)
        barcode_occurrences = [info for info in barcode_info if info['barcode'] == barcode_test]
        
        if len(barcode_occurrences) == 0:
            self.log(f"❌ CRITICAL ERROR: Barcode {barcode_test} not found in export", "ERROR")
            return False
        elif len(barcode_occurrences) == 1:
            occurrence = barcode_occurrences[0]
            expected_row = product_b.get('row_index') + 1
            actual_row = occurrence['row']
            
            if actual_row == expected_row:
                self.log(f"✅ SUCCESS: Barcode {barcode_test} found only once at correct row {actual_row}")
                return True
            else:
                self.log(f"❌ WRONG ROW: Expected row {expected_row}, found at row {actual_row}", "ERROR")
                return False
        else:
            self.log(f"❌ CRITICAL ERROR: Barcode {barcode_test} appears {len(barcode_occurrences)} times (should be 1)", "ERROR")
            self.log("This indicates old deleted barcodes are still appearing in export!")
            for i, occ in enumerate(barcode_occurrences):
                self.log(f"  Occurrence {i+1}: Row {occ['row']} - {occ['product_name'][:50]}...")
            return False
    
    def test_scenario_4_session_isolation(self):
        """Scenario 4: Session Isolation"""
        self.log("\n" + "="*60)
        self.log("SCENARIO 4: Session Isolation")
        self.log("="*60)
        
        # Session 1: Upload and assign 2 barcodes
        if not self.upload_fresh_file():
            return False
        
        session1_id = self.session_id
        self.log(f"Session 1 ID: {session1_id}")
        
        # Get 2 products for session 1
        response = self.session.get(f"{self.base_url}/products", params={"has_barcode": False, "limit": 2})
        if response.status_code != 200:
            return False
        
        products = response.json().get('products', [])
        if len(products) < 2:
            self.log("Need at least 2 products for this test", "ERROR")
            return False
        
        # Assign barcodes in session 1
        self.assign_barcode_to_product(products[0].get('id'), "SESSION1_A")
        self.assign_barcode_to_product(products[1].get('id'), "SESSION1_B")
        self.log("Assigned 2 barcodes in Session 1")
        
        # Session 2: Upload same file again (should create new session)
        if not self.upload_fresh_file():
            return False
        
        session2_id = self.session_id
        self.log(f"Session 2 ID: {session2_id}")
        
        if session1_id == session2_id:
            self.log("❌ ERROR: Same session ID - new session not created", "ERROR")
            return False
        
        # Get 1 product for session 2
        response = self.session.get(f"{self.base_url}/products", params={"has_barcode": False, "limit": 1})
        if response.status_code != 200:
            return False
        
        products = response.json().get('products', [])
        if len(products) < 1:
            self.log("Need at least 1 product for session 2", "ERROR")
            return False
        
        # Assign 1 barcode in session 2
        self.assign_barcode_to_product(products[0].get('id'), "SESSION2_ONLY")
        self.log("Assigned 1 barcode in Session 2")
        
        # Export and verify only session 2 barcode exists
        barcode_info = self.download_and_analyze_excel("/app/test_scenario4.xls")
        if barcode_info is None:
            return False
        
        # Check barcodes
        session1_barcodes = [info for info in barcode_info if info['barcode'] in ["SESSION1_A", "SESSION1_B"]]
        session2_barcodes = [info for info in barcode_info if info['barcode'] == "SESSION2_ONLY"]
        
        if len(session1_barcodes) > 0:
            self.log(f"❌ ERROR: Found {len(session1_barcodes)} barcodes from Session 1 in Session 2 export", "ERROR")
            return False
        
        if len(session2_barcodes) == 1:
            self.log("✅ SUCCESS: Only Session 2 barcode found in export (session isolation working)")
            return True
        else:
            self.log(f"❌ ERROR: Expected 1 Session 2 barcode, found {len(session2_barcodes)}", "ERROR")
            return False
    
    def run_critical_tests(self):
        """Run all critical barcode tests"""
        self.log("=" * 80)
        self.log("STARTING CRITICAL BARCODE ASSIGNMENT TESTS")
        self.log("=" * 80)
        
        test_results = {}
        
        # Run all scenarios
        test_results['scenario_1_fresh_upload'] = self.test_scenario_1_fresh_upload_export()
        test_results['scenario_2_ideal_product'] = self.test_scenario_2_ideal_product_barcode()
        test_results['scenario_3_multiple_ops'] = self.test_scenario_3_multiple_operations()
        test_results['scenario_4_session_isolation'] = self.test_scenario_4_session_isolation()
        
        # Summary
        self.log("\n" + "=" * 80)
        self.log("CRITICAL TEST RESULTS SUMMARY")
        self.log("=" * 80)
        
        passed = 0
        total = len(test_results)
        
        for test_name, result in test_results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            self.log(f"{test_name.upper()}: {status}")
            if result:
                passed += 1
        
        self.log(f"\nOVERALL: {passed}/{total} critical tests passed")
        
        if passed == total:
            self.log("🎉 ALL CRITICAL TESTS PASSED! Barcode system is working correctly.")
        else:
            self.log(f"❌ {total - passed} critical tests failed. URGENT ATTENTION REQUIRED!")
            self.log("\nCRITICAL ISSUES DETECTED:")
            for test_name, result in test_results.items():
                if not result:
                    if 'multiple_ops' in test_name:
                        self.log("  - Old deleted barcodes may be appearing in exports")
                    elif 'ideal_product' in test_name:
                        self.log("  - Barcodes may be written to wrong Excel rows")
                    elif 'session_isolation' in test_name:
                        self.log("  - Session isolation not working properly")
        
        return test_results

if __name__ == "__main__":
    tester = CriticalBarcodeTests()
    results = tester.run_critical_tests()