import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  TextInput,
  FlatList,
  Alert,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Product {
  id: string;
  name: string;
  barcode: string | null;
  row_index: number;
  quantity_warehouse: number | null;
  quantity_actual: number | null;
}

export default function Products() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'without' | 'with'>('without');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ total: 0, withBarcode: 0, withoutBarcode: 0 });

  useEffect(() => {
    loadProducts();
    loadStats();
  }, [activeTab, searchQuery]);

  const loadStats = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/session`);
      const data = await response.json();
      if (data.session) {
        setStats({
          total: data.session.total_products,
          withBarcode: data.session.products_with_barcode,
          withoutBarcode: data.session.total_products - data.session.products_with_barcode
        });
      }
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error);
    }
  };

  const loadProducts = async () => {
    try {
      const hasBarcode = activeTab === 'with';
      let url = `${BACKEND_URL}/api/products?has_barcode=${hasBarcode}&limit=100`;
      
      if (searchQuery) {
        url += `&search=${encodeURIComponent(searchQuery)}`;
      }

      const response = await fetch(url);
      const data = await response.json();
      
      setProducts(data.products);
      setTotal(data.total);
    } catch (error) {
      console.error('Ошибка загрузки товаров:', error);
      Alert.alert('Ошибка', 'Не удалось загрузить список товаров');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadProducts();
    loadStats();
  }, [activeTab, searchQuery]);

  const handleScanBarcode = () => {
    router.push('/scanner');
  };

  const handleDeleteBarcode = async (product: Product) => {
    Alert.alert(
      'Удалить штрихкод?',
      `Удалить штрихкод ${product.barcode} у товара "${product.name}"?`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(
                `${BACKEND_URL}/api/products/${product.id}/barcode`,
                {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ barcode: null })
                }
              );

              if (response.ok) {
                Alert.alert('Успешно', 'Штрихкод удалён');
                loadProducts();
                loadStats();
              }
            } catch (error) {
              Alert.alert('Ошибка', 'Не удалось удалить штрихкод');
            }
          }
        }
      ]
    );
  };

  const handleExport = async () => {
    Alert.alert(
      'Выгрузить Excel?',
      'Создать новый Excel файл со всеми присвоенными штрихкодами?',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Выгрузить',
          onPress: async () => {
            try {
              // Открываем URL для скачивания
              const downloadUrl = `${BACKEND_URL}/api/download`;
              Alert.alert(
                'Готово',
                'Файл готов к скачиванию. Откройте эту ссылку в браузере:\n\n' + downloadUrl,
                [
                  { text: 'OK' }
                ]
              );
            } catch (error) {
              Alert.alert('Ошибка', 'Не удалось выгрузить файл');
            }
          }
        }
      ]
    );
  };

  const renderProduct = ({ item }: { item: Product }) => (
    <View style={styles.productCard}>
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>
          {item.name}
        </Text>
        {item.barcode && (
          <View style={styles.barcodeContainer}>
            <Ionicons name="barcode-outline" size={16} color="#007AFF" />
            <Text style={styles.barcodeText}>{item.barcode}</Text>
          </View>
        )}
      </View>
      
      {item.barcode && (
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteBarcode(item)}
        >
          <Ionicons name="trash-outline" size={20} color="#FF3B30" />
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Товары</Text>
        <TouchableOpacity onPress={handleExport} style={styles.exportButton}>
          <Ionicons name="download-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Всего</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: '#34C759' }]}>{stats.withBarcode}</Text>
          <Text style={styles.statLabel}>Со штрихкодом</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: '#FF9500' }]}>{stats.withoutBarcode}</Text>
          <Text style={styles.statLabel}>Без штрихкода</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'without' && styles.activeTab]}
          onPress={() => setActiveTab('without')}
        >
          <Text style={[styles.tabText, activeTab === 'without' && styles.activeTabText]}>
            Без штрихкода ({stats.withoutBarcode})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'with' && styles.activeTab]}
          onPress={() => setActiveTab('with')}
        >
          <Text style={[styles.tabText, activeTab === 'with' && styles.activeTabText]}>
            Со штрихкодом ({stats.withBarcode})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Поиск товара..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Products List */}
      <FlatList
        data={products}
        renderItem={renderProduct}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={64} color="#CCC" />
            <Text style={styles.emptyText}>
              {searchQuery ? 'Товары не найдены' : 'Нет товаров в этой категории'}
            </Text>
          </View>
        }
      />

      {/* Scan Button */}
      <TouchableOpacity
        style={styles.scanButton}
        onPress={handleScanBarcode}
      >
        <Ionicons name="scan" size={28} color="#FFF" />
        <Text style={styles.scanButtonText}>Сканировать</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
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
  exportButton: {
    padding: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    padding: 16,
    marginBottom: 8,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    margin: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
    marginBottom: 4,
  },
  barcodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  barcodeText: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 4,
    fontWeight: '500',
  },
  deleteButton: {
    padding: 8,
    marginLeft: 12,
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
  },
  scanButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#007AFF',
    borderRadius: 30,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  scanButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
});
