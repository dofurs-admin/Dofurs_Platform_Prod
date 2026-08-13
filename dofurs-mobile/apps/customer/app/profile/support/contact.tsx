import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { Screen, dofursColors } from '@dofurs/shared';

const SUPPORT_EMAIL = 'petcare@dofurs.in';
const SUPPORT_PHONE_DISPLAY = '+91 70083 65175';
const SUPPORT_PHONE_E164 = '+917008365175';
const SUPPORT_WHATSAPP_LINK =
  'https://wa.me/917008365175?text=Hello%2C%20I%20would%20like%20to%20book%20a%20Dofurs%20grooming%20session%20for%20my%20pet.';

async function openUrl(url: string) {
  await Linking.openURL(url).catch(() => null);
}

export default function CustomerSupportContactScreen() {
  const router = useRouter();

  return (
    <Screen scroll>
      <Text style={styles.title}>Contact Us</Text>
      <Text style={styles.subtitle}>
        Have a grooming question, booking issue, feedback, or partnership request? We are here to help.
      </Text>

      <View style={styles.grid}>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Email</Text>
          <Pressable onPress={() => void openUrl(`mailto:${SUPPORT_EMAIL}`)}>
            <Text style={styles.infoValueLink}>{SUPPORT_EMAIL}</Text>
          </Pressable>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Support Hours</Text>
          <Text style={styles.infoValue}>Mon - Sat, 9 AM - 7 PM</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>WhatsApp</Text>
          <Pressable onPress={() => void openUrl(SUPPORT_WHATSAPP_LINK)}>
            <Text style={styles.infoValueLink}>Chat with us on WhatsApp</Text>
          </Pressable>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Location</Text>
          <Text style={styles.infoValue}>Bengaluru</Text>
        </View>
      </View>

      <View style={styles.actionsWrap}>
        <Pressable style={styles.secondaryButton} onPress={() => void openUrl(`tel:${SUPPORT_PHONE_E164}`)}>
          <Text style={styles.secondaryButtonLabel}>Call support ({SUPPORT_PHONE_DISPLAY})</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={() => router.push('/messages')}>
          <Text style={styles.secondaryButtonLabel}>Open support messages</Text>
        </Pressable>

        <Pressable style={styles.primaryButton} onPress={() => router.push('/booking/new/service')}>
          <Text style={styles.primaryButtonLabel}>Book Now</Text>
        </Pressable>
      </View>

      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonLabel}>Back</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: dofursColors.ink,
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: '#5d5853',
    fontSize: 13,
  },
  grid: {
    gap: 10,
  },
  infoCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f2dfcf',
    backgroundColor: '#fffdfb',
    padding: 14,
    gap: 4,
  },
  infoLabel: {
    color: '#7e7065',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  infoValue: {
    color: dofursColors.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  infoValueLink: {
    color: '#186f48',
    fontSize: 15,
    fontWeight: '700',
  },
  actionsWrap: {
    gap: 10,
  },
  primaryButton: {
    borderRadius: 999,
    backgroundColor: dofursColors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  primaryButtonLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d7bda8',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  secondaryButtonLabel: {
    color: dofursColors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  backButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d7bda8',
    backgroundColor: '#fff8f0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  backButtonLabel: {
    color: dofursColors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
});
