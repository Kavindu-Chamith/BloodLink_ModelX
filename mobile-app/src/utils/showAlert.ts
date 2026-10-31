import { Alert, Platform } from 'react-native';

// React Native's Alert API does not display messages in react-native-web.
export function showAlert(title: string, message: string): void {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}
