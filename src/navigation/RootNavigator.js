import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

import SignInScreen from '../screens/SignInScreen';
import SignUpScreen from '../screens/SignUpScreen';
import DietScreen from '../screens/DietScreen';
import ChatScreen from '../screens/ChatScreen';
import ScheduleScreen from '../screens/ScheduleScreen';
import GuideScreen from '../screens/GuideScreen';
import ProfileScreen from '../screens/ProfileScreen';

const AuthStack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="SignIn" component={SignInScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
    </AuthStack.Navigator>
  );
}

function MainTabs() {
  // Lấy chiều rộng màn hình hiện tại
  const { width } = useWindowDimensions();
  
  // Kiểm tra nếu chiều rộng bé hơn 380 thì coi là màn hình hẹp
  const isCompact = width < 400;

  return (
    <Tabs.Navigator
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
          height: isCompact ? 56 : 64,
          paddingBottom: isCompact ? 0 : 8,
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
      <Tabs.Screen name="Diet" component={DietScreen} options={{ title: 'Dinh dưỡng' }} />
      <Tabs.Screen name="Chat" component={ChatScreen} options={{ title: 'Hỏi đáp' }} />
      <Tabs.Screen name="Schedule" component={ScheduleScreen} options={{ title: 'Kế hoạch' }} />
      <Tabs.Screen name="Guide" component={GuideScreen} options={{ title: 'Cẩm nang' }} />
      <Tabs.Screen name="Profile" component={ProfileScreen} options={{ title: 'Hồ sơ' }} />
    </Tabs.Navigator>
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
    <NavigationContainer>
      {token ? <MainTabs /> : <AuthNavigator />}
    </NavigationContainer>
  );
}