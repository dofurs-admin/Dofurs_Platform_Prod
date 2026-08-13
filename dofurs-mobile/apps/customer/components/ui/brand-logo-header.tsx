import { Image, StyleSheet, View } from 'react-native';

const DOFURS_LOGO = require('../../assets/brand-logo.png');

export function BrandLogoHeader() {
  return (
    <View style={styles.container}>
      <Image source={DOFURS_LOGO} style={styles.logo} resizeMode="contain" accessibilityLabel="Dofurs logo" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  logo: {
    width: 156,
    height: 50,
  },
});
