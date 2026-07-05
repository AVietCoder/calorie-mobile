import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { LanguageProvider } from './src/i18n';
import { AuthProvider } from './src/context/AuthContext';
import { ToastProvider } from './src/components/Toast';
import { ReminderProvider } from './src/context/ReminderContext';
import { AssistantProvider } from './src/context/AssistantContext';
import { AlarmModal } from './src/components/ReminderModal';
import AssistantOverlay from './src/components/AssistantOverlay';
import RootNavigator from './src/navigation/RootNavigator';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <LanguageProvider>
          <AuthProvider>
            <ToastProvider>
              <ReminderProvider>
                <AssistantProvider>
                  <StatusBar style="dark" />
                  <RootNavigator />
                  {/* Chuông báo nhắc nhở nổi trên toàn app */}
                  <AlarmModal />
                  {/* Trợ lý giọng nói nổi trên toàn app (nút mic + bảng trạng thái) */}
                  <AssistantOverlay />
                </AssistantProvider>
              </ReminderProvider>
            </ToastProvider>
          </AuthProvider>
        </LanguageProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
