import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { colors } from '../../lib/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// 5 таб: name = файлын нэр
const tabs: { name: string; title: string; icon: IconName }[] = [
  { name: 'home', title: 'Нүүр', icon: 'home' },
  { name: 'transactions', title: 'Гүйлгээ', icon: 'list' },
  { name: 'budgets', title: 'Төсөв', icon: 'pie-chart' },
  { name: 'accounts', title: 'Данс', icon: 'card' },
  { name: 'profile', title: 'Профайл', icon: 'person' },
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
            tabBarIcon: ({ color, size }) => <Ionicons name={t.icon} size={size} color={color as string} />,
          }}
        />
      ))}
    </Tabs>
  );
}
