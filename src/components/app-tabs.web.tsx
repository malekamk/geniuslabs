import { Ionicons } from '@expo/vector-icons';
import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Pressable, useColorScheme, View, StyleSheet } from 'react-native';
import { useAuth } from '@/context/auth-context';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';

const PRIMARY = '#1565C0';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<string, { icon: IoniconName; activeIcon: IoniconName }> = {
  Home: { icon: 'home-outline', activeIcon: 'home' },
  Chat: { icon: 'chatbubbles-outline', activeIcon: 'chatbubbles' },
  Programmes: { icon: 'reader-outline', activeIcon: 'reader' },
  Classes: { icon: 'videocam-outline', activeIcon: 'videocam' },
  Tasks: { icon: 'checkbox-outline', activeIcon: 'checkbox' },
  Gallery: { icon: 'images-outline', activeIcon: 'images' },
  Profile: { icon: 'person-circle-outline', activeIcon: 'person-circle' },
};

export default function AppTabs() {
  const { profile } = useAuth();
  const isGuardian = profile?.role === 'guardian';

  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/(tabs)" asChild>
            <TabButton label="Home" />
          </TabTrigger>
          {isGuardian ? (
            <TabTrigger name="programs" href="/(tabs)/programs" asChild>
              <TabButton label="Programmes" />
            </TabTrigger>
          ) : (
            <TabTrigger name="chat" href="/(tabs)/chat" asChild>
              <TabButton label="Chat" />
            </TabTrigger>
          )}
          <TabTrigger name="classes" href="/(tabs)/classes" asChild>
            <TabButton label="Classes" />
          </TabTrigger>
          <TabTrigger name="tasks" href="/(tabs)/tasks" asChild>
            <TabButton label="Tasks" />
          </TabTrigger>
          <TabTrigger name="gallery" href="/(tabs)/gallery" asChild>
            <TabButton label="Gallery" />
          </TabTrigger>
          <TabTrigger name="profile" href="/(tabs)/profile" asChild>
            <TabButton label="Profile" />
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({ label, isFocused, ...props }: TabTriggerSlotProps & { label: string }) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const icons = TAB_ICONS[label];
  const iconColor = isFocused ? PRIMARY : colors.textSecondary;

  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        style={styles.tabButtonView}>
        {icons && (
          <Ionicons
            name={isFocused ? icons.activeIcon : icons.icon}
            size={16}
            color={iconColor}
          />
        )}
        <ThemedText type="small" themeColor={isFocused ? 'text' : 'textSecondary'}>
          {label}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme ?? 'light'];

  return (
    <View {...props} style={styles.tabListContainer}>
      <ThemedView type="backgroundElement" style={styles.innerContainer}>
        <ThemedText type="smallBold" style={[styles.brandText, { color: PRIMARY }]}>
          Genius Lab
        </ThemedText>
        {props.children}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
  },
  brandText: {
    marginRight: 'auto',
    fontWeight: '700',
  },
  pressed: { opacity: 0.7 },
  tabButtonView: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
