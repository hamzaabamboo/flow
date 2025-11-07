import { useState } from 'react';
import { ScrollView, StyleSheet, View, Linking } from 'react-native';
import {
  Surface,
  List,
  Switch,
  Divider,
  Button,
  useTheme,
  Avatar,
  Card,
  Text,
  SegmentedButtons,
  Menu
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { useSpaceStore } from '@/store/spaceStore';
import * as Haptics from 'expo-haptics';
import type { Space } from '@/types';

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const userEmail = useAuthStore((state) => state.userEmail);
  const userName = useAuthStore((state) => state.userName);
  const themeMode = useThemeStore((state) => state.themeMode);
  const setThemeMode = useThemeStore((state) => state.setThemeMode);
  const currentSpace = useSpaceStore((state) => state.currentSpace);
  const setSpace = useSpaceStore((state) => state.setSpace);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [spaceMenuVisible, setSpaceMenuVisible] = useState(false);

  // Get app version from Constants
  const appVersion = Constants.expoConfig?.version || '1.0.0';

  const handleLogout = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await logout();
    router.replace('/(auth)/login');
  };

  const handleThemeChange = async (value: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setThemeMode(value as 'light' | 'dark' | 'auto');
  };

  const handleSpaceChange = async (space: Space) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setSpace(space);
    setSpaceMenuVisible(false);
  };

  const togglePushNotifications = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPushNotifications(!pushNotifications);
  };

  const toggleEmailNotifications = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEmailNotifications(!emailNotifications);
  };

  const openPrivacyPolicy = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // TODO: Replace with actual privacy policy URL
    Linking.openURL('https://hamflow.app/privacy');
  };

  const openTermsOfService = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // TODO: Replace with actual terms URL
    Linking.openURL('https://hamflow.app/terms');
  };

  return (
    <Surface style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Account Card */}
        <Card
          style={[styles.accountCard, { backgroundColor: theme.colors.surface }]}
          mode="elevated"
          elevation={1}
        >
          <Card.Content style={styles.accountContent}>
            <Avatar.Text
              size={64}
              label={userName ? userName.substring(0, 2).toUpperCase() : 'U'}
              style={{ backgroundColor: theme.colors.primary }}
              labelStyle={{ fontSize: 24, fontWeight: '700', color: '#000' }}
            />
            <View style={styles.accountInfo}>
              <Text
                variant="headlineSmall"
                style={{ fontWeight: '700', color: theme.colors.onSurface }}
              >
                {userName || 'User'}
              </Text>
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}
              >
                {userEmail || 'Not logged in'}
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Appearance Section */}
        <View style={styles.section}>
          <Text
            variant="titleSmall"
            style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}
          >
            APPEARANCE
          </Text>
          <Card style={{ backgroundColor: theme.colors.surface }} mode="elevated" elevation={1}>
            <View style={styles.themeSection}>
              <View style={styles.themeSectionHeader}>
                <List.Icon icon="theme-light-dark" color={theme.colors.primary} />
                <View style={styles.themeSectionText}>
                  <Text
                    variant="bodyLarge"
                    style={{ fontWeight: '600', color: theme.colors.onSurface }}
                  >
                    Theme
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    Choose your preferred appearance
                  </Text>
                </View>
              </View>
              <SegmentedButtons
                value={themeMode}
                onValueChange={handleThemeChange}
                buttons={[
                  {
                    value: 'light',
                    label: 'Light',
                    icon: 'weather-sunny'
                  },
                  {
                    value: 'dark',
                    label: 'Dark',
                    icon: 'weather-night'
                  },
                  {
                    value: 'auto',
                    label: 'Auto',
                    icon: 'theme-light-dark'
                  }
                ]}
                style={styles.segmentedButtons}
              />
            </View>
          </Card>
        </View>

        {/* Preferences Section */}
        <View style={styles.section}>
          <Text
            variant="titleSmall"
            style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}
          >
            PREFERENCES
          </Text>
          <Card style={{ backgroundColor: theme.colors.surface }} mode="elevated" elevation={1}>
            <Menu
              visible={spaceMenuVisible}
              onDismiss={() => setSpaceMenuVisible(false)}
              anchor={
                <List.Item
                  title="Default Space"
                  titleStyle={{ fontWeight: '600', color: theme.colors.onSurface }}
                  description={currentSpace === 'work' ? '💼 Work' : '🏠 Personal'}
                  descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
                  left={(props) => (
                    <List.Icon
                      {...props}
                      icon="view-dashboard-outline"
                      color={theme.colors.primary}
                    />
                  )}
                  right={(props) => (
                    <List.Icon
                      {...props}
                      icon="chevron-right"
                      color={theme.colors.onSurfaceVariant}
                    />
                  )}
                  onPress={() => setSpaceMenuVisible(true)}
                />
              }
            >
              <Menu.Item
                onPress={() => handleSpaceChange('work')}
                title="💼 Work"
                leadingIcon={currentSpace === 'work' ? 'check' : undefined}
              />
              <Menu.Item
                onPress={() => handleSpaceChange('personal')}
                title="🏠 Personal"
                leadingIcon={currentSpace === 'personal' ? 'check' : undefined}
              />
            </Menu>
          </Card>
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text
            variant="titleSmall"
            style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}
          >
            NOTIFICATIONS
          </Text>
          <Card style={{ backgroundColor: theme.colors.surface }} mode="elevated" elevation={1}>
            <List.Item
              title="Push Notifications"
              titleStyle={{ fontWeight: '600', color: theme.colors.onSurface }}
              description="Receive task reminders"
              descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
              left={(props) => (
                <List.Icon {...props} icon="bell-outline" color={theme.colors.primary} />
              )}
              right={() => (
                <Switch value={pushNotifications} onValueChange={togglePushNotifications} />
              )}
            />
            <Divider />
            <List.Item
              title="Email Notifications"
              titleStyle={{ fontWeight: '600', color: theme.colors.onSurface }}
              description="Get weekly summaries"
              descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
              left={(props) => (
                <List.Icon {...props} icon="email-outline" color={theme.colors.primary} />
              )}
              right={() => (
                <Switch value={emailNotifications} onValueChange={toggleEmailNotifications} />
              )}
            />
          </Card>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text
            variant="titleSmall"
            style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}
          >
            ABOUT
          </Text>
          <Card style={{ backgroundColor: theme.colors.surface }} mode="elevated" elevation={1}>
            <List.Item
              title="Version"
              titleStyle={{ fontWeight: '600', color: theme.colors.onSurface }}
              description={`v${appVersion}`}
              descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
              left={(props) => (
                <List.Icon {...props} icon="information-outline" color={theme.colors.primary} />
              )}
            />
            <Divider />
            <List.Item
              title="Privacy Policy"
              titleStyle={{ fontWeight: '600', color: theme.colors.onSurface }}
              descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
              left={(props) => (
                <List.Icon {...props} icon="shield-outline" color={theme.colors.primary} />
              )}
              right={(props) => (
                <List.Icon {...props} icon="chevron-right" color={theme.colors.onSurfaceVariant} />
              )}
              onPress={openPrivacyPolicy}
            />
            <Divider />
            <List.Item
              title="Terms of Service"
              titleStyle={{ fontWeight: '600', color: theme.colors.onSurface }}
              descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
              left={(props) => (
                <List.Icon {...props} icon="file-document-outline" color={theme.colors.primary} />
              )}
              right={(props) => (
                <List.Icon {...props} icon="chevron-right" color={theme.colors.onSurfaceVariant} />
              )}
              onPress={openTermsOfService}
            />
          </Card>
        </View>

        {/* Logout Button */}
        <Button
          mode="contained"
          onPress={handleLogout}
          icon="logout"
          buttonColor={theme.colors.error}
          contentStyle={styles.logoutButtonContent}
          labelStyle={styles.logoutButtonLabel}
          style={styles.logoutButton}
        >
          Logout
        </Button>
      </ScrollView>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  scrollContent: {
    padding: 20,
    gap: 24,
    paddingBottom: 40
  },
  accountCard: {
    borderRadius: 16
  },
  accountContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 8
  },
  accountInfo: {
    flex: 1,
    gap: 2
  },
  section: {
    gap: 12
  },
  sectionTitle: {
    fontWeight: '700',
    letterSpacing: 0.8,
    paddingLeft: 4
  },
  themeSection: {
    padding: 16,
    gap: 16
  },
  themeSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  themeSectionText: {
    flex: 1,
    gap: 2
  },
  segmentedButtons: {
    marginTop: 4
  },
  logoutButton: {
    borderRadius: 12,
    marginTop: 8
  },
  logoutButtonContent: {
    paddingVertical: 8
  },
  logoutButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff'
  }
});
