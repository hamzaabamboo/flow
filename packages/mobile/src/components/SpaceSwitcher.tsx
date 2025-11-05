import { StyleSheet, Pressable } from 'react-native'
import { Text, useTheme } from 'react-native-paper'
import { useSpaceStore } from '@/store/spaceStore'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import * as Haptics from 'expo-haptics'

export const SpaceSwitcher = () => {
  const theme = useTheme()
  const { currentSpace, setSpace } = useSpaceStore()

  const handleToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setSpace(currentSpace === 'work' ? 'personal' : 'work')
  }

  return (
    <Pressable
      style={[
        styles.button,
        {
          backgroundColor: theme.colors.primary,
        }
      ]}
      onPress={handleToggle}
    >
      <MaterialCommunityIcons
        name={currentSpace === 'work' ? 'briefcase' : 'home'}
        size={24}
        color="#000"
      />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
})
