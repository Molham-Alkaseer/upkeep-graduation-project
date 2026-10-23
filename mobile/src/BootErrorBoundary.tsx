import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii } from './ui/theme';

type Props = { children: ReactNode };

type State = { err: Error | null };

/**
 * Catches render errors so a white/splash hang becomes a readable message in dev.
 */
export class BootErrorBoundary extends Component<Props, State> {
  state: State = { err: null };

  static getDerivedStateFromError(err: Error): State {
    return { err };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error('BootErrorBoundary', err, info.componentStack);
  }

  render() {
    if (this.state.err) {
      return (
        <View style={styles.box}>
          <Text style={styles.title}>تعطّل التطبيق عند التشغيل</Text>
          <ScrollView>
            <Text style={styles.mono}>{this.state.err.message}</Text>
          </ScrollView>
          <Pressable style={styles.btn} onPress={() => this.setState({ err: null })}>
            <Text style={styles.btnText}>إعادة المحاولة</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  box: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: colors.errorBg },
  title: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: fonts.bold,
    marginBottom: 12,
    textAlign: 'start' as any,
    color: '#991b1b',
  },
  mono: { fontSize: 13, fontFamily: fonts.regular, color: '#444', textAlign: 'start' as any },
  btn: {
    marginTop: 16,
    backgroundColor: colors.primaryBlue,
    padding: 14,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '600', fontFamily: fonts.bold },
});
