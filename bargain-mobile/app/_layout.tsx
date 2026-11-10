// Root layout — keeps the native splash up while the keychain session is
// restored, then mounts the router. Dark-only app; light status bar chrome.

import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { NavigationBar } from 'expo-navigation-bar';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { colors } from '../theme/colors';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootStack() {
  const { status } = useAuth();

  useEffect(() => {
    if (status !== 'restoring') {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [status]);

  return (
    <>
      <StatusBar style="light" />
      <NavigationBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootStack />
    </AuthProvider>
  );
}
