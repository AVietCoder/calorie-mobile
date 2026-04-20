import { Platform } from 'react-native';

// Tự động đổi base URL theo môi trường
// - Dev (Android emulator): 10.0.2.2 maps tới host's localhost
// - Dev (iOS sim / web):    localhost
// - Production:              Vercel deploy
const PROD_URL = 'https://tht-d3.vercel.app/api';

const DEV_URL = Platform.select({
  android: 'http://10.0.2.2:3000/api',
  ios: 'http://localhost:3000/api',
  default: 'http://localhost:3000/api',
});

export const API_BASE_URL = __DEV__ ? DEV_URL : PROD_URL;
