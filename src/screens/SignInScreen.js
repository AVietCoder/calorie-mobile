import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, Field } from '../components/UI';
import { colors, radius, spacing } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

export default function SignInScreen({ navigation }) {
  const { login } = useAuth();
  const toast = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!username || !password) {
      toast.show('Vui lòng nhập đủ thông tin', 'warning');
      return;
    }
    setLoading(true);
    try {
      await login(username.trim(), password);
      toast.show('Đăng nhập thành công!', 'success');
    } catch (e) {
      toast.show(e.message || 'Đăng nhập thất bại', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <LinearGradient colors={[colors.primarySoft, colors.bg]} style={styles.hero}>
          <View style={styles.logoBadge}>
            <Ionicons name="leaf" size={28} color={colors.primary} />
          </View>
          <Text style={styles.brand}>Calorie AI</Text>
          <Text style={styles.welcome}>Chào mừng trở lại 👋</Text>
          <Text style={styles.sub}>Tiếp tục theo dõi sức khỏe của bạn</Text>
        </LinearGradient>

        <View style={styles.card}>
          <Field label="Tên đăng nhập" placeholder="Nhập username" value={username}
            onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} />
          <Field label="Mật khẩu" placeholder="••••••••" value={password}
            onChangeText={setPassword} secureTextEntry />

          <Button title="Đăng nhập" onPress={onSubmit} loading={loading} style={{ marginTop: 8 }} />

          <View style={styles.footer}>
            <Text style={{ color: colors.textSub }}>Chưa có tài khoản? </Text>
            <Pressable onPress={() => navigation.navigate('SignUp')}>
              <Text style={styles.link}>Đăng ký ngay</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: 40 },
  hero: { paddingTop: 80, paddingBottom: 40, alignItems: 'center', borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  logoBadge: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  brand: { fontSize: 26, fontWeight: '800', color: colors.primaryDark, letterSpacing: 0.3 },
  welcome: { fontSize: 22, fontWeight: '700', color: colors.textMain, marginTop: 18 },
  sub: { color: colors.textSub, marginTop: 4 },
  card: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: -20, borderRadius: radius.xl, padding: 22,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 4 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 18 },
  link: { color: colors.primary, fontWeight: '700' },
});
