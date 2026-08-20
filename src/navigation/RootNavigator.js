import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import { useI18n } from '../i18n';
import { navigationRef } from './navigationRef';

import LandingScreen from '../screens/LandingScreen';
import SignInScreen from '../screens/SignInScreen';
import SignUpScreen from '../screens/SignUpScreen';
import DietScreen from '../screens/DietScreen';
import ChatScreen from '../screens/ChatScreen';
import ScheduleScreen from '../screens/ScheduleScreen';
import GuideScreen from '../screens/GuideScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import MenuLibraryScreen from '../screens/menu/MenuLibraryScreen';
import TemplateDetailScreen from '../screens/menu/TemplateDetailScreen';
import MenuPlanScreen from '../screens/menu/MenuPlanScreen';
import ShoppingListScreen from '../screens/menu/ShoppingListScreen';
import HouseholdScreen from '../screens/menu/HouseholdScreen';

const AuthStack = createNativeStackNavigator();
const MainStack = createNativeStackNavigator();
const PlanStack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

/**
 * Tab "Kế hoạch" là một STACK chứ không phải một màn.
 *
 * Hai thứ cùng trả lời câu "tuần này ăn gì": lịch ăn do AI sinh (Schedule, gọi
 * /coach-dynamic) và thực đơn mẫu của gia đình (/family-menu). Gom vào một tab
 * thay vì thêm tab thứ sáu — 6 tab trên máy hẹp thì chữ bị nuốt hết, mà hai
 * tính năng này người dùng cũng không dùng cùng lúc.
 *
 * Schedule là màn gốc để người đang dùng lịch AI không bị đổi thói quen; lối
 * vào thực đơn nằm ngay trong đó.
 */
function PlanNavigator() {
  return (
    <PlanStack.Navigator screenOptions={{ headerShown: false }}>
      <PlanStack.Screen name="Schedule" component={ScheduleScreen} />
      <PlanStack.Screen name="MenuLibrary" component={MenuLibraryScreen} />
      <PlanStack.Screen name="TemplateDetail" component={TemplateDetailScreen} />
      <PlanStack.Screen name="MenuPlan" component={MenuPlanScreen} />
      <PlanStack.Screen name="ShoppingList" component={ShoppingListScreen} />
      <PlanStack.Screen name="Household" component={HouseholdScreen} />
    </PlanStack.Navigator>
  );
}

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      {/* Landing giới thiệu trước đăng nhập — giống web index.html */}
      <AuthStack.Screen name="Landing" component={LandingScreen} />
      <AuthStack.Screen name="SignIn" component={SignInScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
    </AuthStack.Navigator>
  );
}

function MainTabs() {
  // Lấy chiều rộng màn hình hiện tại
  const { width } = useWindowDimensions();
  const { t } = useI18n();

  /*
   * App bật edge-to-edge (android/gradle.properties: edgeToEdgeEnabled=true) nên
   * cửa sổ vẽ TRÀN xuống dưới thanh điều hướng hệ thống. React Navigation vốn tự
   * cộng insets.bottom vào chiều cao tab bar, NHƯNG ta khai báo `height` tường
   * minh ở tabBarStyle → giá trị đó ghi đè, làm tab bar nằm lọt dưới thanh điều
   * hướng (rõ nhất trên Samsung One UI: cả 3 nút lẫn thanh vuốt đều che mất tab).
   * Vì vậy phải tự cộng insets.bottom vào cả height lẫn paddingBottom.
   */
  const insets = useSafeAreaInsets();

  // Kiểm tra nếu chiều rộng bé hơn 380 thì coi là màn hình hẹp
  const isCompact = width < 400;
  const barHeight = isCompact ? 56 : 64;

  return (
    <Tabs.Navigator
      // Giống web: sau đăng nhập đưa người dùng vào trang Hướng dẫn (guide.html) trước
      initialRouteName="Guide"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        
        // Ẩn chữ nếu chiều rộng bé
        tabBarShowLabel: !isCompact,
        
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: colors.border,
          // Điều chỉnh chiều cao linh hoạt: 56px khi ẩn chữ, 64px khi hiện chữ
          // — cộng thêm vùng an toàn dưới để không bị thanh điều hướng che.
          height: barHeight + insets.bottom,
          paddingBottom: insets.bottom + (isCompact ? 0 : 8),
          paddingTop: 6,
        },
        tabBarLabelStyle: { 
          fontSize: 11, 
          fontWeight: '600' 
        },
        tabBarIcon: ({ color, size, focused }) => {
          const map = {
            Diet: focused ? 'pie-chart' : 'pie-chart-outline',
            Chat: focused ? 'chatbubbles' : 'chatbubbles-outline',
            Schedule: focused ? 'calendar' : 'calendar-outline',
            Guide: focused ? 'book' : 'book-outline',
            Profile: focused ? 'person' : 'person-outline',
          };
          
          // Khi ẩn chữ, có thể tăng nhẹ kích thước icon để dễ bấm hơn
          return <Ionicons name={map[route.name]} size={isCompact ? size + 2 : size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="Diet" component={DietScreen} options={{ title: t('m.tab_diet', 'Dinh dưỡng') }} />
      <Tabs.Screen name="Chat" component={ChatScreen} options={{ title: t('m.tab_chat', 'Hỏi đáp') }} />
      <Tabs.Screen name="Schedule" component={PlanNavigator} options={{ title: t('m.tab_plan', 'Kế hoạch') }} />
      <Tabs.Screen name="Guide" component={GuideScreen} options={{ title: t('m.tab_guide', 'Cẩm nang') }} />
      <Tabs.Screen name="Profile" component={ProfileScreen} options={{ title: t('m.tab_profile', 'Hồ sơ') }} />
    </Tabs.Navigator>
  );
}

/**
 * Stack bọc ngoài các tab.
 *
 * Cần thiết để Cài đặt mở ĐÈ LÊN tab bar và có cử chỉ vuốt quay lại — đặt nó
 * thành một tab thứ sáu sẽ phá bố cục thanh tab, mà nhét vào trong màn Hồ sơ
 * thì không quay lại được.
 */
function MainNavigator() {
  return (
    <MainStack.Navigator screenOptions={{ headerShown: false }}>
      <MainStack.Screen name="Tabs" component={MainTabs} />
      <MainStack.Screen name="Settings" component={SettingsScreen} />
    </MainStack.Navigator>
  );
}

export default function RootNavigator() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      {token ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}