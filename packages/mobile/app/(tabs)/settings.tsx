import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Surface, List, Switch, Divider, Button, useTheme, Avatar, Card, Text } from 'react-native-paper'
import { useRouter } from 'expo-router'
import { useAuthStore } from '@/store/authStore'
import * as Haptics from 'expo-haptics'

export default function SettingsScreen() {
  const theme = useTheme()
  const router = useRouter()
  const logout = useAuthStore((state) => state.logout)
  const userEmail = useAuthStore((state) => state.userEmail)
  const userName = useAuthStore((state) => state.userName)
  const [isDarkMode, setIsDarkMode] = useState(true)
  const [pushNotifications, setPushNotifications] = useState(true)
  const [emailNotifications, setEmailNotifications] = useState(false)

  const handleLogout = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    await logout()
    router.replace('/(auth)/login')
  }

  const toggleDarkMode = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setIsDarkMode(!isDarkMode)
  }

  const togglePushNotifications = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setPushNotifications(!pushNotifications)
  }

  const toggleEmailNotifications = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setEmailNotifications(!emailNotifications)
  }

  return (
    <Surface style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Account Card */}
        <Card style={[styles.accountCard, { backgroundColor: theme.colors.surface }]} mode="elevated" elevation={1}>
          <Card.Content style={styles.accountContent}>
            <Avatar.Text
              size={64}
              label={userName ? userName.substring(0, 2).toUpperCase() : 'U'}
              style={{ backgroundColor: theme.colors.primary }}
              labelStyle={{ fontSize: 24, fontWeight: '700', color: '#000' }}
            />
            <View style={styles.accountInfo}>
              <Text variant="headlineSmall" style={{ fontWeight: '700', color: theme.colors.onSurface }}>
                {userName || 'User'}
              </Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                {userEmail || 'Not logged in'}
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Appearance Section */}
        <View style={styles.section}>
          <Text variant="titleSmall" style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
            APPEARANCE
          </Text>
          <Card style={{ backgroundColor: theme.colors.surface }} mode="elevated" elevation={1}>
            <List.Item
              title="Dark Mode"
              titleStyle={{ fontWeight: '600', color: theme.colors.onSurface }}
              description="Use dark theme"
              descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
              left={(props) => <List.Icon {...props} icon="theme-light-dark" color={theme.colors.primary} />}
              right={() => <Switch value={isDarkMode} onValueChange={toggleDarkMode} />}
            />
          </Card>
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text variant="titleSmall" style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
            NOTIFICATIONS
          </Text>
          <Card style={{ backgroundColor: theme.colors.surface }} mode="elevated" elevation={1}>
            <List.Item
              title="Push Notifications"
              titleStyle={{ fontWeight: '600', color: theme.colors.onSurface }}
              description="Receive task reminders"
              descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
              left={(props) => <List.Icon {...props} icon="bell-outline" color={theme.colors.primary} />}
              right={() => <Switch value={pushNotifications} onValueChange={togglePushNotifications} />}
            />
            <Divider />
            <List.Item
              title="Email Notifications"
              titleStyle={{ fontWeight: '600', color: theme.colors.onSurface }}
              description="Get weekly summaries"
              descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
              left={(props) => <List.Icon {...props} icon="email-outline" color={theme.colors.primary} />}
              right={() => <Switch value={emailNotifications} onValueChange={toggleEmailNotifications} />}
            />
          </Card>
        </View>

        {/* Data & Sync Section */}
        <View style={styles.section}>
          <Text variant="titleSmall" style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
            DATA & SYNC
          </Text>
          <Card style={{ backgroundColor: theme.colors.surface }} mode="elevated" elevation={1}>
            <List.Item
              title="Sync Now"
              titleStyle={{ fontWeight: '600', color: theme.colors.onSurface }}
              description="Last synced: 2 minutes ago"
              descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
              left={(props) => <List.Icon {...props} icon="sync" color={theme.colors.primary} />}
              onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            />
            <Divider />
            <List.Item
              title="Clear Cache"
              titleStyle={{ fontWeight: '600', color: theme.colors.onSurface }}
              description="Free up space"
              descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
              left={(props) => <List.Icon {...props} icon="delete-outline" color={theme.colors.primary} />}
              onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            />
          </Card>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text variant="titleSmall" style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
            ABOUT
          </Text>
          <Card style={{ backgroundColor: theme.colors.surface }} mode="elevated" elevation={1}>
            <List.Item
              title="Version"
              titleStyle={{ fontWeight: '600', color: theme.colors.onSurface }}
              description="1.0.0"
              descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
              left={(props) => <List.Icon {...props} icon="information-outline" color={theme.colors.primary} />}
            />
            <Divider />
            <List.Item
              title="Privacy Policy"
              titleStyle={{ fontWeight: '600', color: theme.colors.onSurface }}
              descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
              left={(props) => <List.Icon {...props} icon="shield-outline" color={theme.colors.primary} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" color={theme.colors.onSurfaceVariant} />}
              onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            />
            <Divider />
            <List.Item
              title="Terms of Service"
              titleStyle={{ fontWeight: '600', color: theme.colors.onSurface }}
              descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
              left={(props) => <List.Icon {...props} icon="file-document-outline" color={theme.colors.primary} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" color={theme.colors.onSurfaceVariant} />}
              onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
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
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 24,
    paddingBottom: 40,
  },
  accountCard: {
    borderRadius: 16,
  },
  accountContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 8,
  },
  accountInfo: {
    flex: 1,
    gap: 2,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontWeight: '700',
    letterSpacing: 0.8,
    paddingLeft: 4,
  },
  logoutButton: {
    borderRadius: 12,
    marginTop: 8,
  },
  logoutButtonContent: {
    paddingVertical: 8,
  },
  logoutButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
})
