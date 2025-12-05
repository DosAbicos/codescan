#!/usr/bin/env python3
"""
CRITICAL ROW POSITIONING AND DATA ACCURACY TESTS
Tests barcode row positioning and data accuracy after fixing header=None.
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

class CriticalRowPositionTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.session = requests.Session()
        self.session_id = None
        
    def log(self, message, level="INFO"):
        """Log test messages with timestamp"""
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] [{level}] {message}")
        
    def upload_fresh_file(self):
        """Upload fresh sample file for testing"""
        self.log("Uploading fresh sample file...")
        
        try:
            with open(SAMPLE_FILE_PATH, 'rb') as f:
                files = {'file': ('sample_file.xls', f, 'application/vnd.ms-excel')}
                response = self.session.post(f"{self.base_url}/upload", files=files)
                
            if response.status_code == 200:
                data = response.json()
                self.session_id = data.get('session_id')
                self.log(f"✅ File uploaded successfully. Session ID: {self.session_id}")
                self.log(f"Total products: {data.get('total_products')}")
                return True
            else:
                self.log(f"❌ Upload failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Upload exception: {str(e)}", "ERROR")
            return False
    
    def find_ideal_product(self):
        """Find the IDEAL ПАРКЕТНЫЙ ЛАК ГЛЯНЦЕВЫЙ (10L) product"""
        self.log("Searching for 'IDEAL ПАРКЕТНЫЙ ЛАК ГЛЯНЦЕВЫЙ (10L)' product...")
        
        try:
            # Search for the specific product
            params = {"search": "IDEAL ПАРКЕТНЫЙ ЛАК ГЛЯНЦЕВЫЙ", "limit": 100}
            response = self.session.get(f"{self.base_url}/products", params=params)
            
            if response.status_code == 200:
                data = response.json()
                products = data.get('products', [])
                
                # Find exact match
                target_product = None
                for product in products:
                    if "IDEAL ПАРКЕТНЫЙ ЛАК ГЛЯНЦЕВЫЙ (10L)" in product.get('name', ''):
                        target_product = product
                        break
                
                if target_product:
                    self.log(f"✅ Found target product:")
                    self.log(f"   Name: {target_product['name']}")
                    self.log(f"   ID: {target_product['id']}")
                    self.log(f"   Row Index: {target_product['row_index']}")
                    return target_product
                else:
                    self.log("❌ Target product not found", "ERROR")
                    # Show available products for debugging
                    self.log("Available products with 'IDEAL':")
                    for product in products:
                        if "IDEAL" in product.get('name', ''):
                            self.log(f"   - {product['name']} (row: {product['row_index']})")
                    return None
            else:
                self.log(f"❌ Search failed: {response.status_code}", "ERROR")
                return None
                
        except Exception as e:
            self.log(f"❌ Search exception: {str(e)}", "ERROR")
            return None
    
    def verify_xlrd_row_index(self, product_row_index, product_name):
        """Verify row index matches xlrd row index"""
        self.log(f"Verifying xlrd row index for row {product_row_index}...")
        
        try:
            # Open original file with xlrd
            rb = xlrd.open_workbook(SAMPLE_FILE_PATH, formatting_info=True)
            ws = rb.sheet_by_index(0)
            
            # Check the product name at the specified row
            xlrd_cell_value = ws.cell_value(product_row_index, 0)  # Column 0 = product name
            
            self.log(f"Row {product_row_index} in xlrd contains: '{xlrd_cell_value}'")
            self.log(f"Expected product name: '{product_name}'")
            
            # Check if names match (allowing for minor formatting differences)
            if product_name.strip() in str(xlrd_cell_value).strip() or str(xlrd_cell_value).strip() in product_name.strip():
                self.log(f"✅ Row index verification PASSED - pandas row_index matches xlrd row")
                return True
            else:
                self.log(f"❌ Row index verification FAILED - mismatch between pandas and xlrd", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ xlrd verification exception: {str(e)}", "ERROR")
            return False
    
    def test_1_row_index_verification(self):
        """Test 1: Row Index Verification"""
        self.log("=" * 60)
        self.log("TEST 1: ROW INDEX VERIFICATION")
        self.log("=" * 60)
        
        # Find the IDEAL product
        product = self.find_ideal_product()
        if not product:
            return False
        
        # Verify row index matches xlrd
        row_verification = self.verify_xlrd_row_index(product['row_index'], product['name'])
        if not row_verification:
            return False
        
        # Assign test barcode
        test_barcode = "TEST_IDEAL_10L"
        quantity = 15
        
        self.log(f"Assigning barcode '{test_barcode}' with quantity {quantity}...")
        
        try:
            payload = {"barcode": test_barcode, "quantity_actual": quantity}
            response = self.session.put(
                f"{self.base_url}/products/{product['id']}/barcode",
                json=payload
            )
            
            if response.status_code == 200:
                self.log("✅ Barcode assigned successfully")
                
                # Export Excel and verify
                return self.verify_barcode_in_export(product['row_index'], test_barcode, quantity, product['name'])
            else:
                self.log(f"❌ Barcode assignment failed: {response.status_code}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Barcode assignment exception: {str(e)}", "ERROR")
            return False
    
    def test_2_barcode_data_accuracy(self):
        """Test 2: Barcode Data Accuracy"""
        self.log("=" * 60)
        self.log("TEST 2: BARCODE DATA ACCURACY")
        self.log("=" * 60)
        
        # Get any product without barcode
        try:
            params = {"has_barcode": False, "limit": 1}
            response = self.session.get(f"{self.base_url}/products", params=params)
            
            if response.status_code == 200:
                data = response.json()
                products = data.get('products', [])
                
                if not products:
                    self.log("❌ No products without barcode found", "ERROR")
                    return False
                
                product = products[0]
                test_barcode = "ACCURATE_TEST_123"
                quantity = 25
                
                self.log(f"Testing with product: {product['name']} (row: {product['row_index']})")
                
                # Assign barcode
                payload = {"barcode": test_barcode, "quantity_actual": quantity}
                response = self.session.put(
                    f"{self.base_url}/products/{product['id']}/barcode",
                    json=payload
                )
                
                if response.status_code == 200:
                    self.log("✅ Barcode assigned successfully")
                    
                    # Verify in export
                    return self.verify_barcode_in_export(product['row_index'], test_barcode, quantity, product['name'])
                else:
                    self.log(f"❌ Barcode assignment failed: {response.status_code}", "ERROR")
                    return False
            else:
                self.log(f"❌ Product search failed: {response.status_code}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Test 2 exception: {str(e)}", "ERROR")
            return False
    
    def test_3_multiple_products(self):
        """Test 3: Multiple Products"""
        self.log("=" * 60)
        self.log("TEST 3: MULTIPLE PRODUCTS")
        self.log("=" * 60)
        
        try:
            # Get 3 products without barcodes
            params = {"has_barcode": False, "limit": 3}
            response = self.session.get(f"{self.base_url}/products", params=params)
            
            if response.status_code == 200:
                data = response.json()
                products = data.get('products', [])
                
                if len(products) < 3:
                    self.log(f"❌ Need 3 products, only found {len(products)}", "ERROR")
                    return False
                
                # Assign barcodes to 3 products
                test_assignments = []
                for i, product in enumerate(products[:3]):
                    barcode = f"MULTI_TEST_{i+1:03d}"
                    quantity = (i + 1) * 10  # 10, 20, 30
                    
                    payload = {"barcode": barcode, "quantity_actual": quantity}
                    response = self.session.put(
                        f"{self.base_url}/products/{product['id']}/barcode",
                        json=payload
                    )
                    
                    if response.status_code == 200:
                        test_assignments.append({
                            'row_index': product['row_index'],
                            'barcode': barcode,
                            'quantity': quantity,
                            'name': product['name']
                        })
                        self.log(f"✅ Assigned {barcode} to row {product['row_index']}")
                    else:
                        self.log(f"❌ Failed to assign barcode to product {i+1}", "ERROR")
                        return False
                
                # Verify all assignments in export
                return self.verify_multiple_barcodes_in_export(test_assignments)
            else:
                self.log(f"❌ Product search failed: {response.status_code}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Test 3 exception: {str(e)}", "ERROR")
            return False
    
    def verify_barcode_in_export(self, expected_row, expected_barcode, expected_quantity, expected_name):
        """Verify barcode is written to correct row in exported Excel"""
        self.log(f"Verifying barcode in export at row {expected_row}...")
        
        try:
            # Download Excel
            response = self.session.get(f"{self.base_url}/download")
            
            if response.status_code == 200:
                # Save exported file
                export_path = "/tmp/test_export.xls"
                with open(export_path, 'wb') as f:
                    f.write(response.content)
                
                # Verify with xlrd
                rb = xlrd.open_workbook(export_path, formatting_info=True)
                ws = rb.sheet_by_index(0)
                
                # Check row contains correct data
                name_cell = ws.cell_value(expected_row, 0)  # Column 0 = name
                barcode_cell = ws.cell_value(expected_row, 8)  # Column 8 = barcode
                quantity_cell = ws.cell_value(expected_row, 9)  # Column 9 = quantity
                
                self.log(f"Row {expected_row} verification:")
                self.log(f"  Name: '{name_cell}' (expected: '{expected_name}')")
                self.log(f"  Barcode: '{barcode_cell}' (expected: '{expected_barcode}')")
                self.log(f"  Quantity: '{quantity_cell}' (expected: {expected_quantity})")
                
                # Verify name matches
                name_match = expected_name.strip() in str(name_cell).strip() or str(name_cell).strip() in expected_name.strip()
                
                # Verify barcode matches exactly
                barcode_match = str(barcode_cell).strip() == expected_barcode
                
                # Verify quantity matches
                quantity_match = float(quantity_cell) == expected_quantity if quantity_cell else False
                
                if name_match and barcode_match and quantity_match:
                    self.log("✅ Export verification PASSED - All data in correct row")
                    return True
                else:
                    self.log("❌ Export verification FAILED", "ERROR")
                    if not name_match:
                        self.log("  - Name mismatch", "ERROR")
                    if not barcode_match:
                        self.log("  - Barcode mismatch", "ERROR")
                    if not quantity_match:
                        self.log("  - Quantity mismatch", "ERROR")
                    return False
            else:
                self.log(f"❌ Export download failed: {response.status_code}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Export verification exception: {str(e)}", "ERROR")
            return False
    
    def verify_multiple_barcodes_in_export(self, assignments):
        """Verify multiple barcode assignments in export"""
        self.log("Verifying multiple barcodes in export...")
        
        try:
            # Download Excel
            response = self.session.get(f"{self.base_url}/download")
            
            if response.status_code == 200:
                # Save exported file
                export_path = "/tmp/test_multiple_export.xls"
                with open(export_path, 'wb') as f:
                    f.write(response.content)
                
                # Verify with xlrd
                rb = xlrd.open_workbook(export_path, formatting_info=True)
                ws = rb.sheet_by_index(0)
                
                all_passed = True
                
                for assignment in assignments:
                    row = assignment['row_index']
                    expected_barcode = assignment['barcode']
                    expected_quantity = assignment['quantity']
                    expected_name = assignment['name']
                    
                    # Check row data
                    name_cell = ws.cell_value(row, 0)
                    barcode_cell = ws.cell_value(row, 8)
                    quantity_cell = ws.cell_value(row, 9)
                    
                    self.log(f"Row {row}: name='{name_cell}', barcode='{barcode_cell}', quantity='{quantity_cell}'")
                    
                    # Verify each field
                    name_match = expected_name.strip() in str(name_cell).strip()
                    barcode_match = str(barcode_cell).strip() == expected_barcode
                    quantity_match = float(quantity_cell) == expected_quantity if quantity_cell else False
                    
                    if name_match and barcode_match and quantity_match:
                        self.log(f"✅ Row {row} verification PASSED")
                    else:
                        self.log(f"❌ Row {row} verification FAILED", "ERROR")
                        all_passed = False
                
                return all_passed
            else:
                self.log(f"❌ Export download failed: {response.status_code}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Multiple export verification exception: {str(e)}", "ERROR")
            return False
    
    def run_critical_tests(self):
        """Run all critical row positioning tests"""
        self.log("=" * 80)
        self.log("CRITICAL ROW POSITIONING AND DATA ACCURACY TESTS")
        self.log("Testing barcode row positioning after header=None fix")
        self.log("=" * 80)
        
        # Upload fresh file
        if not self.upload_fresh_file():
            self.log("❌ Failed to upload file - cannot continue", "ERROR")
            return False
        
        test_results = {}
        
        # Run all critical tests
        test_results['test_1_row_index'] = self.test_1_row_index_verification()
        test_results['test_2_data_accuracy'] = self.test_2_barcode_data_accuracy()
        test_results['test_3_multiple_products'] = self.test_3_multiple_products()
        
        # Summary
        self.log("=" * 80)
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
            self.log("🎉 ALL CRITICAL TESTS PASSED! Row positioning is accurate.", "SUCCESS")
        else:
            self.log(f"❌ {total - passed} critical tests failed. Row positioning needs attention.", "ERROR")
        
        return test_results

if __name__ == "__main__":
    tester = CriticalRowPositionTester()
    results = tester.run_critical_tests()