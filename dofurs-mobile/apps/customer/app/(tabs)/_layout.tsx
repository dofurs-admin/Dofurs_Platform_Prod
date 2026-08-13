import { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { isCustomerAppRole, useAuthStore } from '@dofurs/shared';

export default function CustomerTabsLayout() {
  const router = useRouter();
  const status = useAuthStore((state) => state.status);
  const accessToken = useAuthStore((state) => state.accessToken);
  const role = useAuthStore((state) => state.role);

  useEffect(() => {
    if (status === 'loading' || status === 'idle') {
      return;
    }

    if (!accessToken) {
      router.replace('/(auth)/sign-in');
      return;
    }

    if (role === null) {
      router.replace('/');
      return;
    }

    if (!isCustomerAppRole(role)) {
      router.replace('/(auth)/sign-in');
    }
  }, [accessToken, role, router, status]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          display: 'none',
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Bookings',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-clear-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: 'Services',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'sparkles' : 'sparkles-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="pets"
        options={{
          title: 'Pets',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'paw' : 'paw-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
          title: 'Account',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
