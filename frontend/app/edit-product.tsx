import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView
} from 'react-native';
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

export default function EditProduct() {
  const router = useRouter();
  const { productId } = useLocalSearchParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [quantity, setQuantity] = useState('');

  useEffect(() => {
    loadProduct();
  }, []);

  const loadProduct = async () => {
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/products?has_barcode=true&limit=1000`
      );
      const data = await response.json();
      const foundProduct = data.products.find((p: Product) => p.id === productId);
      
      if (foundProduct) {
        setProduct(foundProduct);
        setQuantity(foundProduct.quantity_actual?.toString() || '');
      }
    } catch (error) {
      console.error('Ошибка загрузки товара:', error);
      Alert.alert('Ошибка', 'Не удалось загрузить товар');
    } finally {
      setLoading(false);
    }
  };

  const handleRescanBarcode = () => {
    // Переход к сканеру с передачей ID товара
    Alert.alert(
      'Пересканировать штрихкод',
      'Хотите присвоить новый штрихкод этому товару?',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Сканировать',
          onPress: () => {
            router.push({
              pathname: '/scanner',
              params: { editProductId: productId }
            });
          }
        }
      ]
    );
  };

  const handleSaveQuantity = async () => {
    if (!product) return;
    
    try {
      setSaving(true);
      const quantity_actual = quantity ? parseFloat(quantity) : null;
      
      const response = await fetch(
        `${BACKEND_URL}/api/products/${product.id}/barcode`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            barcode: product.barcode,
            quantity_actual
          })
        }
      );

      if (response.ok) {
        Alert.alert(
          'Успешно',
          'Количество сохранено',
          [
            {
              text: 'OK',
              onPress: () => router.back()
            }
          ]
        );
      } else {
        Alert.alert('Ошибка', 'Не удалось сохранить');
      }
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Товар не найден</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Редактировать</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content}>
          {/* Product Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Товар</Text>
            <View style={styles.card}>
              <Text style={styles.productName}>{product.name}</Text>
            </View>
          </View>

          {/* Barcode */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Штрихкод</Text>
            <View style={styles.card}>
              <View style={styles.barcodeRow}>
                <View style={styles.barcodeInfo}>
                  <Ionicons name="barcode-outline" size={24} color="#007AFF" />
                  <Text style={styles.barcodeText}>{product.barcode}</Text>
                </View>
                <TouchableOpacity
                  style={styles.rescanButton}
                  onPress={handleRescanBarcode}
                >
                  <Ionicons name="scan" size={20} color="#007AFF" />
                  <Text style={styles.rescanText}>Пересканировать</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Quantities */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Количество</Text>
            <View style={styles.card}>
              {/* Warehouse Quantity */}
              <View style={styles.quantityRow}>
                <Text style={styles.quantityLabel}>На складе:</Text>
                <Text style={styles.quantityValue}>
                  {product.quantity_warehouse || 0}
                </Text>
              </View>

              <View style={styles.divider} />

              {/* Actual Quantity */}
              <View style={styles.inputRow}>
                <Text style={styles.quantityLabel}>По факту:</Text>
                <TextInput
                  style={styles.quantityInput}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="numeric"
                  placeholder="Введите количество"
                  placeholderTextColor="#999"
                />
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Save Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSaveQuantity}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={24} color="#FFF" />
                <Text style={styles.saveButtonText}>Сохранить</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  productName: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },
  barcodeRow: {
    gap: 12,
  },
  barcodeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  barcodeText: {
    fontSize: 18,
    color: '#007AFF',
    fontWeight: '600',
    marginLeft: 8,
  },
  rescanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F7',
    padding: 12,
    borderRadius: 8,
  },
  rescanText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
    marginLeft: 6,
  },
  quantityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  quantityLabel: {
    fontSize: 15,
    color: '#666',
  },
  quantityValue: {
    fontSize: 16,
    color: '#000',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E5EA',
    marginVertical: 8,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  quantityInput: {
    flex: 1,
    marginLeft: 16,
    fontSize: 16,
    color: '#000',
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    textAlign: 'right',
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  saveButton: {
    backgroundColor: '#34C759',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginTop: 60,
  },
});
