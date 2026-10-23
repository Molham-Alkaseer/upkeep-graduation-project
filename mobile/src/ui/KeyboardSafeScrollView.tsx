import { useHeaderHeight } from '@react-navigation/elements';
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  type ScrollViewProps,
  StyleSheet,
} from 'react-native';

type Props = ScrollViewProps & {
  children: ReactNode;
};

/**
 * Keeps the bottom of scrollable content reachable when the keyboard is open.
 *
 * - **Android:** rely on `softwareKeyboardLayoutMode: 'resize'` (window shrinks to the area above
 *   the keyboard). No `KeyboardAvoidingView` here — that stacked with resize and hid content /
 *   left a blank band. Use `tabBarHideOnKeyboard` on tab navigators for extra room.
 * - **iOS:** `KeyboardAvoidingView` + header offset + `automaticallyAdjustKeyboardInsets` on the
 *   scroll view so the focused field can scroll into view.
 */
export function KeyboardSafeScrollView({ children, contentContainerStyle, style, ...scrollRest }: Props) {
  const headerHeight = useHeaderHeight();

  const scrollView = (
    <ScrollView
      style={[styles.flex, style]}
      contentContainerStyle={contentContainerStyle}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      {...scrollRest}
    >
      {children}
    </ScrollView>
  );

  if (Platform.OS === 'android') {
    return scrollView;
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding" keyboardVerticalOffset={headerHeight}>
      {scrollView}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
