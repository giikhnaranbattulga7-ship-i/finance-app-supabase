import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { colors } from '../../lib/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const tabs: { name: string; title: string; icon: IconName; hidden?: boolean }[] = [
  { name: 'home', title: 'Нүүр', icon: 'home' },
  { name: 'transactions', title: 'Гүйлгээ', icon: 'list' },
  { name: 'budgets', title: 'Төсөв', icon: 'pie-chart' },
  { name: 'accounts', title: 'Данс', icon: 'card', hidden: true },
  { name: 'profile', title: 'Профайл', icon: 'person', hidden: true },
];

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.onAccent,
        tabBarInactiveTintColor: colors.muted,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          height: Platform.OS === 'web' ? 64 : 56,
          paddingBottom: 8,
        },
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
            tabBarActiveBackgroundColor: colors.primary,
          }}
        />
      ))}
    </Tabs>
  );
}
