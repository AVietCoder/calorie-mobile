import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius } from '../theme/colors';
import { useI18n } from '../i18n';
import { LangSwitch } from '../components/HeaderWidgets';

const { width } = Dimensions.get('window');
const HERO_IMG = 'https://i.pinimg.com/736x/ca/5d/37/ca5d371c8e432a9df5f3de23b40e20ca.jpg';

export default function LandingScreen({ navigation }) {
  const { t } = useI18n();

  return (
    <LinearGradient 
      colors={[colors.primarySoft || '#eef8f2', colors.bg || '#ffffff']} 
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 0.5 }} // Vuốt nhẹ gradient ở nửa trên màn hình
      style={{ flex: 1 }}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        
        {/* Navbar tối giản: Chỉ gồm Logo và Nút chuyển ngôn ngữ */}
        <View style={styles.navbar}>
          <View style={styles.logoRow}>
            <View style={styles.logoIconBg}>
              <Ionicons name="leaf" size={18} color={colors.primary} />
            </View>
            <Text style={styles.logoText}>Calorie AI</Text>
          </View>
          
          <View style={styles.navRight}>
            <LangSwitch />
          </View>
        </View>

        {/* Hero Section — Căn giữa, phóng khoáng, nhiều khoảng trống */}
        <View style={styles.hero}>
          <View style={styles.badge}>
            <Ionicons name="sparkles" size={14} color={colors.primary} />
            <Text style={styles.badgeText}>{t('land.badge', 'Trí tuệ nhân tạo thế hệ mới')}</Text>
          </View>
          
          <Text style={styles.title}>
            {t('land.title1', 'Kiểm soát Calorie')}{'\n'}
            <Text style={styles.titleHighlight}>{t('land.title2', 'Dễ dàng hơn bao giờ hết.')}</Text>
          </Text>
          
          <Text style={styles.desc}>
            {t('land.desc', 'Chụp ảnh bữa ăn, nhận diện calo tức thì. Trải nghiệm công nghệ AI thông minh giúp bạn đạt mục tiêu sức khoẻ.')}
          </Text>

          {/* Khối hình ảnh bo góc lớn và đổ bóng sâu */}
          <View style={styles.imageContainer}>
            <Image source={{ uri: HERO_IMG }} style={styles.heroImg} resizeMode="cover" />
            
            {/* Tag nhỏ tinh tế đè lên ảnh tạo chiều sâu */}
            <View style={styles.floatingCard}>
              <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
              <Text style={styles.floatingText}>AI Powered</Text>
            </View>
          </View>

          {/* Nút CTA duy nhất to, rõ ràng, dễ bấm */}
          <Pressable style={styles.cta} onPress={() => navigation.navigate('SignUp')}>
            <Text style={styles.ctaText}>{t('land.cta', 'Bắt đầu ngay')}</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </Pressable>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>{t('land.footer', '© 2026 Calorie AI • Phân tích dinh dưỡng thông minh')}</Text>
        
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: { 
    flexGrow: 1, 
    paddingBottom: 40 
  },
  navbar: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    paddingHorizontal: 24, 
    paddingTop: 60, // Giữ khoảng cách an toàn với phần tai thỏ
    paddingBottom: 10,
  },
  logoRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 10 
  },
  logoIconBg: {
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  logoText: { 
    fontSize: 20, 
    fontWeight: '900', 
    color: colors.primaryDark || '#111',
    letterSpacing: -0.5,
  },
  navRight: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  
  hero: { 
    alignItems: 'center', 
    paddingHorizontal: 24, 
    marginTop: 30, // Tạo khoảng cách rộng rãi với Navbar
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff', 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 24,
  },
  badgeText: { 
    fontSize: 13, 
    fontWeight: '700', 
    color: colors.primary 
  },
  title: { 
    fontSize: 34, 
    fontWeight: '900', 
    textAlign: 'center', 
    color: colors.textMain || '#000', 
    lineHeight: 44,
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  titleHighlight: { 
    color: colors.primary 
  },
  desc: { 
    fontSize: 15, 
    textAlign: 'center',
    color: colors.textSub || '#666', 
    lineHeight: 24, 
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  imageContainer: {
    width: width - 48,
    borderRadius: 32,
    backgroundColor: '#fff',
    position: 'relative',
    marginBottom: 36,
    // Đổ bóng cao cấp giúp ảnh có chiều sâu tách biệt với nền
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  heroImg: { 
    width: '100%', 
    aspectRatio: 1.1 / 1, // Tỉ lệ ảnh vuông nhẹ rất sang mượt trên mobile
    borderRadius: 32,
  },
  floatingCard: {
    position: 'absolute', 
    bottom: 16, 
    right: 16, 
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.95)', 
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.1,
    shadowRadius: 8, 
    elevation: 4,
  },
  floatingText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMain,
  },
  cta: {
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.primary, 
    paddingVertical: 18, // Làm nút to, dày dặn bấm cực thích
    borderRadius: radius.xl || 18, 
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
    width: width - 48, 
  },
  ctaText: { 
    color: '#fff', 
    fontSize: 17, 
    fontWeight: '800' 
  },
  footer: { 
    textAlign: 'center', 
    fontSize: 13, 
    color: colors.muted || '#999', 
    marginTop: 48,
    fontWeight: '500' 
  },
});