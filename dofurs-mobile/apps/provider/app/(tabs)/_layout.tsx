import { Tabs } from 'expo-router';
import { dofursColors } from '@dofurs/shared';

export default function ProviderTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: dofursColors.coral,
        tabBarInactiveTintColor: '#7d736c',
        tabBarStyle: {
          backgroundColor: '#fff8f0',
          borderTopColor: '#e7c4a7',
        },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="bookings" options={{ title: 'Bookings' }} />
      <Tabs.Screen name="schedule" options={{ title: 'Schedule' }} />
      <Tabs.Screen name="reviews" options={{ title: 'Reviews' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
