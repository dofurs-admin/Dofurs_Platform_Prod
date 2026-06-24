import { Tabs } from 'expo-router';
import { dofursColors } from '@dofurs/shared';

export default function CustomerTabsLayout() {
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
      <Tabs.Screen name="services" options={{ title: 'Services' }} />
      <Tabs.Screen name="pets" options={{ title: 'Pets' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
