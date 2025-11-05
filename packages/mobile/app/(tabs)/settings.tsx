import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Surface, List, Switch, Divider, Button, useTheme, Avatar } from 'react-native-paper'
import { useRouter } from 'expo-router'
import { useAuthStore } from '@/store/authStore'
import * as Haptics from 'expo-haptics'

export default function SettingsScreen() {
  const theme = useTheme()
  const router = useRouter()
  const logout = useAuthStore((state) => state.logout)
  const [isDarkMode, setIsDarkMode] = useState(false)
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
    <Surface style={styles.container}>
      <ScrollView>
        {/* Account Section */}
        <List.Section>
          <List.Subheader>Account</List.Subheader>
          <List.Item
            title="John Doe"
            description="john.doe@hamflow.app"
            left={(props) => (
              <Avatar.Text {...props} size={40} label="JD" style={{ backgroundColor: theme.colors.primary }} />
            )}
          />
        </List.Section>

        <Divider />

        {/* Appearance Section */}
        <List.Section>
          <List.Subheader>Appearance</List.Subheader>
          <List.Item
            title="Dark Mode"
            description="Use dark theme"
            left={(props) => <List.Icon {...props} icon="theme-light-dark" />}
            right={() => <Switch value={isDarkMode} onValueChange={toggleDarkMode} />}
          />
        </List.Section>

        <Divider />

        {/* Notifications Section */}
        <List.Section>
          <List.Subheader>Notifications</List.Subheader>
          <List.Item
            title="Push Notifications"
            description="Receive task reminders"
            left={(props) => <List.Icon {...props} icon="bell-outline" />}
            right={() => <Switch value={pushNotifications} onValueChange={togglePushNotifications} />}
          />
          <List.Item
            title="Email Notifications"
            description="Get weekly summaries"
            left={(props) => <List.Icon {...props} icon="email-outline" />}
            right={() => <Switch value={emailNotifications} onValueChange={toggleEmailNotifications} />}
          />
        </List.Section>

        <Divider />

        {/* Data & Sync Section */}
        <List.Section>
          <List.Subheader>Data & Sync</List.Subheader>
          <List.Item
            title="Sync Now"
            description="Last synced: 2 minutes ago"
            left={(props) => <List.Icon {...props} icon="sync" />}
            onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          />
          <List.Item
            title="Clear Cache"
            description="Free up space"
            left={(props) => <List.Icon {...props} icon="delete-outline" />}
            onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          />
        </List.Section>

        <Divider />

        {/* About Section */}
        <List.Section>
          <List.Subheader>About</List.Subheader>
          <List.Item
            title="Version"
            description="1.0.0"
            left={(props) => <List.Icon {...props} icon="information-outline" />}
          />
          <List.Item
            title="Privacy Policy"
            left={(props) => <List.Icon {...props} icon="shield-outline" />}
            onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          />
          <List.Item
            title="Terms of Service"
            left={(props) => <List.Icon {...props} icon="file-document-outline" />}
            onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          />
        </List.Section>

        <Divider />

        {/* Logout Button */}
        <View style={styles.logoutContainer}>
          <Button
            mode="contained"
            onPress={handleLogout}
            icon="logout"
            buttonColor={theme.colors.error}
            style={styles.logoutButton}
          >
            Logout
          </Button>
        </View>
      </ScrollView>
    </Surface>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  logoutContainer: {
    padding: 16,
    marginTop: 16,
    marginBottom: 32,
  },
  logoutButton: {
    paddingVertical: 4,
  },
})
