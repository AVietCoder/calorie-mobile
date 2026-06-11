import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, Field } from '../components/UI';
import { colors, radius } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { useI18n } from '../i18n';
import { LangSwitch } from '../components/HeaderWidgets';

export default function SignUpScreen({ navigation }) {
  const { register } = useAuth();
  const toast = useToast();
  const { t } = useI18n();
  const [form, setForm] = useState({ username: '', password: '', birthYear: '', weight: '', height: '' });
  const [loading, setLoading] = useState(false);
  const set = (k) => (v) => setForm((s) => ({ ...s, [k]: v }));

  const onSubmit = async () => {
    const { username, password, birthYear, weight, height } = form;
    if (!username || !password || !birthYear || !weight || !height) {
      toast.show(t('m.fill_all', 'Vui lòng nhập đầy đủ'), 'warning');
      return;
    }
    setLoading(true);
    try {
      await register(form);
      toast.show(t('m.reg_ok', 'Đăng ký thành công! Hãy đăng nhập'), 'success');
      setTimeout(() => navigation.navigate('SignIn'), 700);
    } catch (e) {
      toast.show(e.message || t('m.reg_fail', 'Đăng ký thất bại'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <LinearGradient colors={[colors.primarySoft, colors.bg]} style={styles.hero}>
          <View style={{ position: 'absolute', top: 50, right: 16 }}><LangSwitch /></View>
          <View style={styles.logoBadge}><Ionicons name="leaf" size={28} color={colors.primary} /></View>
          <Text style={styles.brand}>Calorie AI</Text>
          <Text style={styles.welcome}>{t('auth.signup_title', 'Tạo tài khoản mới')}</Text>
          <Text style={styles.sub}>{t('auth.signup_sub', 'Bắt đầu hành trình dinh dưỡng của bạn')}</Text>
        </LinearGradient>

        <View style={styles.card}>
          <Field label={t('auth.username', 'Tên đăng nhập')} placeholder={t('auth.username_ph_signup', 'Ví dụ: nva123')} value={form.username}
            onChangeText={set('username')} autoCapitalize="none" autoCorrect={false} />
          <Field label={t('auth.password', 'Mật khẩu')} placeholder="••••••••" value={form.password}
            onChangeText={set('password')} secureTextEntry />
          <Field label={t('auth.birth', 'Năm sinh')} placeholder="1995" value={form.birthYear}
            onChangeText={set('birthYear')} keyboardType="number-pad" />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Field label={t('auth.weight', 'Cân nặng (kg)')} placeholder="65" value={form.weight}
                onChangeText={set('weight')} keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label={t('auth.height', 'Chiều cao (cm)')} placeholder="170" value={form.height}
                onChangeText={set('height')} keyboardType="number-pad" />
            </View>
          </View>

          <Button title={t('auth.signup_btn', 'Đăng ký ngay')} onPress={onSubmit} loading={loading} style={{ marginTop: 4 }} />

          <View style={styles.footer}>
            <Text style={{ color: colors.textSub }}>{t('auth.have_account', 'Đã có tài khoản?')} </Text>
            <Pressable onPress={() => navigation.navigate('SignIn')}>
              <Text style={styles.link}>{t('auth.signin_link', 'Đăng nhập')}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hero: { paddingTop: 70, paddingBottom: 40, alignItems: 'center', borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  logoBadge: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  brand: { fontSize: 26, fontWeight: '800', color: colors.primaryDark },
  welcome: { fontSize: 22, fontWeight: '700', color: colors.textMain, marginTop: 18 },
  sub: { color: colors.textSub, marginTop: 4 },
  card: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: -20, borderRadius: radius.xl, padding: 22,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 4 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 18 },
  link: { color: colors.primary, fontWeight: '700' },
});
