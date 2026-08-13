import { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { dofursColors, isProviderAppRole, useAuthStore } from '@dofurs/shared';

export default function ProviderTabsLayout() {
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

    if (!isProviderAppRole(role)) {
      router.replace('/(auth)/sign-in');
    }
  }, [accessToken, role, router, status]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: dofursColors.coral,
        tabBarInactiveTintColor: '#7a6a5b',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          marginTop: -2,
        },
        tabBarHideOnKeyboard: true,
        tabBarItemStyle: {
          borderRadius: 14,
          marginHorizontal: 2,
        },
        tabBarStyle: {
          position: 'absolute',
          left: 12,
          right: 12,
          bottom: 12,
          height: 72,
          paddingTop: 8,
          paddingBottom: 10,
          backgroundColor: '#fff7ee',
          borderTopColor: '#e3c7ad',
          borderTopWidth: 1,
          borderRadius: 22,
          shadowColor: '#956038',
          shadowOpacity: 0.2,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 10 },
          elevation: 9,
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
        name="schedule"
        options={{
          title: 'Schedule',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'time' : 'time-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="reviews"
        options={{
          title: 'Reviews',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
