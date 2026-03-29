import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#000000' },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen
          name="history"
          options={{
            animation: 'slide_from_left',
          }}
        />

        <Stack.Screen
          name="settings"
          options={{
            animation: 'slide_from_right',
          }}
        />
      </Stack>
    </>
  );
}