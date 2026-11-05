import { Alert, Platform } from 'react-native';

// Баталгаажуулах цонх. Утсан дээр Alert.alert, web дээр window.confirm ашиглана
// (учир нь web дээр Alert товчтой цонх ажилладаггүй)
export function confirmAction(title: string, message: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(title + '\n\n' + message)) onYes();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Болих', style: 'cancel' },
    { text: 'Тийм', style: 'destructive', onPress: onYes },
  ]);
}

// Энгийн мэдэгдэл (OK товчтой)
export function showMessage(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(title + '\n\n' + message);
    return;
  }
  Alert.alert(title, message);
}
