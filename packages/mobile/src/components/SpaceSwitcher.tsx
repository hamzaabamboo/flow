import { View, StyleSheet } from 'react-native'
import { SegmentedButtons, useTheme } from 'react-native-paper'
import { useSpaceStore } from '@/store/spaceStore'

export const SpaceSwitcher = () => {
  const theme = useTheme()
  const { currentSpace, setSpace } = useSpaceStore()

  return (
    <View style={styles.container}>
      <SegmentedButtons
        value={currentSpace}
        onValueChange={(value) => setSpace(value as 'work' | 'personal')}
        buttons={[
          {
            value: 'work',
            label: 'Work',
            icon: 'briefcase',
            style: currentSpace === 'work' ? { backgroundColor: theme.colors.primaryContainer } : undefined,
          },
          {
            value: 'personal',
            label: 'Personal',
            icon: 'home',
            style: currentSpace === 'personal' ? { backgroundColor: theme.colors.primaryContainer } : undefined,
          },
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 8,
  },
})
