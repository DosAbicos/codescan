import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  TextInput,
  FlatList,
  Modal,
  ActivityIndicator
} from 'react-native';
import { Camera, CameraView, BarcodeScanningResult } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Product {
  id: string;
  name: string;
  barcode: string | null;
  quantity_warehouse: number | null;
  quantity_actual: number | null;
}

export default function Scanner() {
  const router = useRouter();
  const { editProductId } = useLocalSearchParams();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [showQuantityInput, setShowQuantityInput] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantityValue, setQuantityValue] = useState('');
  const isEditMode = !!editProductId;

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  useEffect(() => {
    if (searchQuery.length > 0) {
      searchProducts();
    }
  }, [searchQuery]);

  const searchProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${BACKEND_URL}/api/products?has_barcode=false&search=${encodeURIComponent(searchQuery)}&limit=50`
      );
      
      if (!response.ok) {
        console.error('Server error:', response.status);
        setProducts([]);
        return;
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('Response is not JSON:', contentType);
        setProducts([]);
        return;
      }
      
      const data = await response.json();
      setProducts(data.products || []);
    } catch (error) {
      console.error('Ошибка поиска:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleBarCodeScanned = ({ type, data }: BarcodeScanningResult) => {
    setScannedBarcode(data);
    
    // Если режим редактирования - сразу применяем штрихкод
    if (isEditMode) {
      applyBarcodeToEditProduct(data);
    } else {
      setShowProductSelector(true);
    }
  };

  const handleManualBarcodeSubmit = () => {
    if (manualBarcode.trim()) {
      const barcode = manualBarcode.trim();
      setScannedBarcode(barcode);
      setShowManualInput(false);
      setManualBarcode('');
      
      if (isEditMode) {
        applyBarcodeToEditProduct(barcode);
      } else {
        setShowProductSelector(true);
      }
    }
  };

  const applyBarcodeToEditProduct = async (barcode: string) => {
    try {
      // Получаем текущий товар
      const response = await fetch(
        `${BACKEND_URL}/api/products?has_barcode=true&limit=1000`
      );
      const data = await response.json();
      const product = data.products.find((p: Product) => p.id === editProductId);
      
      if (!product) {
        Alert.alert('Ошибка', 'Товар не найден');
        return;
      }

      // Применяем новый штрихкод
      const updateResponse = await fetch(
        `${BACKEND_URL}/api/products/${editProductId}/barcode`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            barcode: barcode,
            quantity_actual: product.quantity_actual
          })
        }
      );

      if (updateResponse.ok) {
        Alert.alert(
          'Штрихкод обновлён!',
          `Новый штрихкод ${barcode} присвоен товару`,
          [
            {
              text: 'OK',
              onPress: () => {
                // Используем replace вместо back для избежания проблем с навигацией
                router.replace('/products');
              }
            }
          ]
        );
      } else {
        Alert.alert('Ошибка', 'Не удалось обновить штрихкод');
      }
    } catch (error) {
      console.error('Apply barcode error:', error);
      Alert.alert('Ошибка', 'Не удалось обновить штрихкод');
    }
  };

  const assignBarcodeToProduct = (product: Product) => {
    // Открываем модальное окно для ввода количества
    setSelectedProduct(product);
    setQuantityValue(product.quantity_warehouse?.toString() || '');
    setShowProductSelector(false);
    setShowQuantityInput(true);
  };

  const confirmBarcodeAssignment = async () => {
    if (!selectedProduct) return;

    try {
      const quantity_actual = quantityValue ? parseFloat(quantityValue) : null;
      
      const response = await fetch(
        `${BACKEND_URL}/api/products/${selectedProduct.id}/barcode`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            barcode: scannedBarcode,
            quantity_actual
          })
        }
      );

      if (response.ok) {
        setShowQuantityInput(false);
        Alert.alert(
          'Успешно!',
          `Штрихкод ${scannedBarcode} присвоен товару:\n"${selectedProduct.name}"\n\nКоличество: ${quantity_actual || 'не указано'}`,
          [
            {
              text: 'OK',
              onPress: () => {
                setScannedBarcode(null);
                setSearchQuery('');
                setProducts([]);
                setSelectedProduct(null);
                setQuantityValue('');
              }
            }
          ]
        );
      } else {
        Alert.alert('Ошибка', 'Не удалось присвоить штрихкод');
      }
    } catch (error) {
      console.error('Assign barcode error:', error);
      Alert.alert('Ошибка', 'Не удалось присвоить штрихкод');
    }
  };

  const renderProduct = ({ item }: { item: Product }) => (
    <TouchableOpacity
      style={styles.productItem}
      onPress={() => assignBarcodeToProduct(item)}
    >
      <View style={styles.productItemContent}>
        <Text style={styles.productItemName} numberOfLines={2}>
          {item.name}
        </Text>
        <Ionicons name="chevron-forward" size={20} color="#999" />
      </View>
    </TouchableOpacity>
  );

  if (hasPermission === null) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </SafeAreaView>
    );
  }

  if (hasPermission === false) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={80} color="#999" />
          <Text style={styles.permissionText}>
            Нет доступа к камере
          </Text>
          <Text style={styles.permissionSubtext}>
            Разрешите доступ к камере в настройках
          </Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Назад</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Сканирование</Text>
        <TouchableOpacity 
          onPress={() => setShowManualInput(true)} 
          style={styles.headerButton}
        >
          <Ionicons name="keypad-outline" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Camera */}
      {!showProductSelector && (
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ['ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e'],
          }}
          onBarcodeScanned={scannedBarcode ? undefined : handleBarCodeScanned}
        >
          <View style={styles.overlay}>
            <View style={styles.scanArea}>
              <View style={[styles.corner, styles.cornerTopLeft]} />
              <View style={[styles.corner, styles.cornerTopRight]} />
              <View style={[styles.corner, styles.cornerBottomLeft]} />
              <View style={[styles.corner, styles.cornerBottomRight]} />
            </View>
            <Text style={styles.instructionText}>
              Наведите камеру на штрихкод
            </Text>
          </View>
        </CameraView>
      )}

      {/* Product Selector Modal */}
      <Modal
        visible={showProductSelector}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowProductSelector(false);
          setScannedBarcode(null);
          setSearchQuery('');
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                setShowProductSelector(false);
                setScannedBarcode(null);
                setSearchQuery('');
              }}
            >
              <Text style={styles.modalCancelText}>Отмена</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Выберите товар</Text>
            <View style={{ width: 60 }} />
          </View>

          {/* Scanned Barcode Display */}
          <View style={styles.barcodeDisplay}>
            <Ionicons name="barcode-outline" size={32} color="#007AFF" />
            <Text style={styles.barcodeDisplayText}>{scannedBarcode}</Text>
          </View>

          {/* Search Input */}
          <View style={styles.modalSearchContainer}>
            <Ionicons name="search" size={20} color="#999" />
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Поиск товара..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              autoCorrect={false}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Products List */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
            </View>
          ) : (
            <FlatList
              data={products}
              renderItem={renderProduct}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.modalListContent}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="search-outline" size={64} color="#CCC" />
                  <Text style={styles.emptyText}>
                    {searchQuery ? 'Товары не найдены' : 'Начните вводить название товара'}
                  </Text>
                </View>
              }
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* Manual Barcode Input Modal */}
      <Modal
        visible={showManualInput}
        animationType="slide"
        transparent
        onRequestClose={() => setShowManualInput(false)}
      >
        <View style={styles.manualInputOverlay}>
          <View style={styles.manualInputContainer}>
            <Text style={styles.manualInputTitle}>Ввести штрихкод вручную</Text>
            
            <TextInput
              style={styles.manualInput}
              placeholder="Введите цифры штрихкода"
              value={manualBarcode}
              onChangeText={setManualBarcode}
              keyboardType="number-pad"
              autoFocus
            />

            <View style={styles.manualInputButtons}>
              <TouchableOpacity
                style={[styles.manualInputButton, styles.manualInputButtonCancel]}
                onPress={() => {
                  setShowManualInput(false);
                  setManualBarcode('');
                }}
              >
                <Text style={styles.manualInputButtonText}>Отмена</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.manualInputButton, styles.manualInputButtonSubmit]}
                onPress={handleManualBarcodeSubmit}
              >
                <Text style={[styles.manualInputButtonText, { color: '#FFF' }]}>
                  Продолжить
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Quantity Input Modal */}
      <Modal
        visible={showQuantityInput}
        animationType="slide"
        transparent
        onRequestClose={() => setShowQuantityInput(false)}
      >
        <View style={styles.quantityInputOverlay}>
          <View style={styles.quantityInputContainer}>
            <Text style={styles.quantityInputTitle}>Укажите количество</Text>
            
            {selectedProduct && (
              <>
                <Text style={styles.quantityProductName} numberOfLines={2}>
                  {selectedProduct.name}
                </Text>
                <Text style={styles.quantityWarehouse}>
                  На складе: {selectedProduct.quantity_warehouse || 0}
                </Text>
              </>
            )}

            <TextInput
              style={styles.quantityInput}
              placeholder="Введите количество"
              value={quantityValue}
              onChangeText={setQuantityValue}
              keyboardType="numeric"
              autoFocus
            />

            <View style={styles.quantityInputButtons}>
              <TouchableOpacity
                style={[styles.quantityInputButton, styles.quantityInputButtonCancel]}
                onPress={() => {
                  setShowQuantityInput(false);
                  setShowProductSelector(true);
                }}
              >
                <Text style={styles.quantityInputButtonText}>Отмена</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quantityInputButton, styles.quantityInputButtonSubmit]}
                onPress={confirmBarcodeAssignment}
              >
                <Text style={[styles.quantityInputButtonText, { color: '#FFF' }]}>
                  Сохранить
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  headerButton: {
    padding: 8,
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: 280,
    height: 280,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 12,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#FFF',
  },
  cornerTopLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  cornerTopRight: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  cornerBottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  cornerBottomRight: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  instructionText: {
    marginTop: 24,
    fontSize: 16,
    color: '#FFF',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F2F2F7',
  },
  permissionText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginTop: 16,
  },
  permissionSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  backButton: {
    marginTop: 24,
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#007AFF',
    width: 60,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  barcodeDisplay: {
    backgroundColor: '#FFF',
    padding: 20,
    margin: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  barcodeDisplayText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#007AFF',
    marginLeft: 12,
  },
  modalSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 12,
    borderRadius: 10,
    height: 44,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    marginLeft: 8,
  },
  modalListContent: {
    padding: 16,
  },
  productItem: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  productItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  productItemName: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
    textAlign: 'center',
  },
  manualInputOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  manualInputContainer: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  manualInputTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
    textAlign: 'center',
  },
  manualInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  manualInputButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  manualInputButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  manualInputButtonCancel: {
    backgroundColor: '#E5E5EA',
  },
  manualInputButtonSubmit: {
    backgroundColor: '#007AFF',
  },
  manualInputButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  quantityInputOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  quantityInputContainer: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  quantityInputTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
    textAlign: 'center',
  },
  quantityProductName: {
    fontSize: 15,
    color: '#333',
    marginBottom: 8,
  },
  quantityWarehouse: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  quantityInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  quantityInputButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  quantityInputButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  quantityInputButtonCancel: {
    backgroundColor: '#E5E5EA',
  },
  quantityInputButtonSubmit: {
    backgroundColor: '#007AFF',
  },
  quantityInputButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
});
