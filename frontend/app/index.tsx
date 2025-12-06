import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Platform
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Session {
  id: string;
  filename: string;
  total_products: number;
  products_with_barcode: number;
}

export default function Index() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    checkExistingSession();
  }, []);

  const checkExistingSession = async () => {
    try {
      console.log('Проверка сессии на:', `${BACKEND_URL}/api/session`);
      const response = await fetch(`${BACKEND_URL}/api/session`, {
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Сервер недоступен (${response.status})`);
      }
      
      const data = await response.json();
      if (data.session) {
        setSession(data.session);
      }
    } catch (error) {
      console.error('Ошибка проверки сессии:', error);
      // Не показываем alert при проверке сессии, только логируем
    } finally {
      setCheckingSession(false);
    }
  };

  const handleFilePick = async () => {
    try {
      setLoading(true);
      
      // Выбираем файл
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        copyToCacheDirectory: true
      });

      if (result.canceled) {
        setLoading(false);
        return;
      }

      const file = result.assets[0];
      console.log('Выбран файл:', file.name);

      // Читаем файл как base64
      const fileContent = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.Base64
      });

      // Создаем FormData для отправки
      const formData = new FormData();
      
      // Декодируем base64 в бинарные данные для отправки
      const blob = await (await fetch(`data:application/vnd.ms-excel;base64,${fileContent}`)).blob();
      
      formData.append('file', {
        uri: file.uri,
        type: 'application/vnd.ms-excel',
        name: file.name
      } as any);

      // Отправляем на сервер
      console.log('Отправка файла на:', `${BACKEND_URL}/api/upload`);
      const uploadResponse = await fetch(`${BACKEND_URL}/api/upload`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('Ответ сервера:', uploadResponse.status);
      
      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('Ошибка от сервера:', errorText);
        throw new Error(`Ошибка загрузки (${uploadResponse.status}): ${errorText}`);
      }

      const uploadData = await uploadResponse.json();
      console.log('Файл загружен:', uploadData);

      Alert.alert(
        'Успешно!',
        `Загружено ${uploadData.total_products} товаров\nСо штрихкодами: ${uploadData.products_with_barcode}`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Переходим к списку товаров
              router.push('/products');
            }
          }
        ]
      );

      // Обновляем сессию
      await checkExistingSession();

    } catch (error) {
      console.error('Ошибка:', error);
      Alert.alert('Ошибка', error instanceof Error ? error.message : 'Не удалось загрузить файл');
    } finally {
      setLoading(false);
    }
  };

  const handleContinueWork = () => {
    router.push('/products');
  };

  if (checkingSession) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Ionicons name="barcode-outline" size={80} color="#007AFF" />
          <Text style={styles.title}>Штрихкоды</Text>
          <Text style={styles.subtitle}>Присвоение штрихкодов товарам</Text>
        </View>

        {session ? (
          <View style={styles.sessionCard}>
            <Text style={styles.sessionTitle}>Текущая сессия</Text>
            <Text style={styles.sessionFilename}>{session.filename}</Text>
            <View style={styles.sessionStats}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{session.total_products}</Text>
                <Text style={styles.statLabel}>Всего товаров</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{session.products_with_barcode}</Text>
                <Text style={styles.statLabel}>Со штрихкодом</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {session.total_products - session.products_with_barcode}
                </Text>
                <Text style={styles.statLabel}>Без штрихкода</Text>
              </View>
            </View>
            
            <TouchableOpacity
              style={styles.continueButton}
              onPress={handleContinueWork}
            >
              <Text style={styles.continueButtonText}>Продолжить работу</Text>
              <Ionicons name="arrow-forward" size={20} color="#FFF" />
            </TouchableOpacity>
            
            {/* Кнопка загрузить новый файл */}
            <TouchableOpacity
              style={styles.uploadNewButton}
              onPress={handleFilePick}
              disabled={loading}
            >
              <Ionicons name="cloud-upload-outline" size={20} color="#007AFF" />
              <Text style={styles.uploadNewButtonText}>Загрузить новый файл</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={80} color="#CCC" />
            <Text style={styles.emptyText}>Загрузите файл для начала работы</Text>
            
            {/* Кнопка загрузки файла */}
            <TouchableOpacity
              style={[styles.uploadButton, loading && styles.uploadButtonDisabled]}
              onPress={handleFilePick}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={24} color="#FFF" />
                  <Text style={styles.uploadButtonText}>Загрузить Excel файл</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.infoSection}>
          <View style={styles.infoItem}>
            <Ionicons name="checkmark-circle" size={20} color="#34C759" />
            <Text style={styles.infoText}>Поддержка .xls файлов</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="checkmark-circle" size={20} color="#34C759" />
            <Text style={styles.infoText}>Сохранение прогресса</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="checkmark-circle" size={20} color="#34C759" />
            <Text style={styles.infoText}>Быстрый поиск товаров</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  sessionCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  sessionTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  sessionFilename: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
  },
  sessionStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E5E5EA',
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
    textAlign: 'center',
  },
  continueButton: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  uploadNewButton: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  uploadNewButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  actionSection: {
    marginBottom: 32,
  },
  actionTitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  uploadButton: {
    backgroundColor: '#34C759',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  uploadButtonDisabled: {
    opacity: 0.6,
  },
  uploadButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  infoSection: {
    marginTop: 'auto',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
    textAlign: 'center',
  },
});
