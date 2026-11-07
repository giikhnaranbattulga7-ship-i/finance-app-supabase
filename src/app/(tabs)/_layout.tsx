import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { colors } from '../../lib/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// Үндсэн 3 таб. Данс, төсөв нь Бусад цэсэнд.
const tabs: { name: string; title: string; icon: IconName; hidden?: boolean }[] = [
  { name: 'home', title: 'Нүүр', icon: 'home' },
  { name: 'transactions', title: 'Гүйлгээ', icon: 'list' },
  { name: 'profile', title: 'Бусад', icon: 'menu' },
  { name: 'budgets', title: 'Төсөв', icon: 'pie-chart', hidden: true },
  { name: 'accounts', title: 'Данс', icon: 'card', hidden: true },
];

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarHideOnKeyboard: true,
        tabBarStyle: Platform.OS === 'web' ? { height: 64, paddingBottom: 8 } : undefined,
      }}
    >
      {tabs.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            href: t.hidden ? null : undefined,
            tabBarIcon: ({ color, size }) => <Ionicons name={t.icon} size={size} color={color as string} />,
          }}
        />
      ))}
    </Tabs>
  );
}
