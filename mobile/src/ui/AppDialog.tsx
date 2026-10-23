import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fonts, gradientPrimary, radii, shadows } from './theme';

export type AppDialogButtonStyle = 'default' | 'cancel' | 'destructive';

export type AppDialogButton = {
  text: string;
  style?: AppDialogButtonStyle;
  onPress?: () => void;
};

export type ShowAppDialogOptions = {
  title: string;
  message?: string;
  buttons?: AppDialogButton[];
};

type AppDialogContextValue = {
  showDialog: (opts: ShowAppDialogOptions) => void;
};

const AppDialogContext = createContext<AppDialogContextValue | null>(null);

export function AppDialogProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [options, setOptions] = useState<ShowAppDialogOptions | null>(null);

  const hide = useCallback(() => {
    setVisible(false);
    setOptions(null);
  }, []);

  const showDialog = useCallback((opts: ShowAppDialogOptions) => {
    setOptions(opts);
    setVisible(true);
  }, []);

  const buttons: AppDialogButton[] =
    options?.buttons && options.buttons.length > 0
      ? options.buttons
      : [{ text: t('dialog.button.ok'), style: 'cancel' }];

  const handleButton = (btn: AppDialogButton) => {
    const fn = btn.onPress;
    hide();
    if (fn) {
      setTimeout(fn, 0);
    }
  };

  const value = useMemo(() => ({ showDialog }), [showDialog]);

  return (
    <AppDialogContext.Provider value={value}>
      {children}
      <Modal
        visible={visible && options != null}
        transparent
        animationType="fade"
        onRequestClose={hide}
        statusBarTranslucent
      >
        <View style={styles.overlay}>
          <View style={styles.card} accessibilityRole="alert">
            <Text style={styles.title}>{options?.title ?? ''}</Text>
            {options?.message ? (
              <ScrollView
                style={styles.messageScroll}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
              >
                <Text style={styles.message}>{options.message}</Text>
              </ScrollView>
            ) : null}
            <View
              style={[styles.buttonRow, buttons.length === 1 && styles.buttonRowSingle]}
            >
              {buttons.map((btn, i) =>
                (btn.style ?? 'default') === 'default' ? (
                  <Pressable
                    key={`${btn.text}-${i}`}
                    style={({ pressed }) => [
                      styles.gradientBtnWrap,
                      shadows.primaryBtn,
                      buttons.length > 1 ? styles.btnMulti : styles.btnFull,
                      pressed && styles.btnPressed,
                    ]}
                    onPress={() => handleButton(btn)}
                  >
                    <LinearGradient
                      colors={[...gradientPrimary]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.gradientBtnInner}
                    >
                      <Text style={[styles.btnText, styles.btnTextPrimary]}>{btn.text}</Text>
                    </LinearGradient>
                  </Pressable>
                ) : (
                  <Pressable
                    key={`${btn.text}-${i}`}
                    style={({ pressed }) => [
                      styles.btn,
                      buttonVariantStyle(btn.style),
                      buttons.length > 1 ? styles.btnMulti : styles.btnFull,
                      pressed && styles.btnPressed,
                    ]}
                    onPress={() => handleButton(btn)}
                  >
                    <Text style={[styles.btnText, buttonTextStyle(btn.style)]}>{btn.text}</Text>
                  </Pressable>
                )
              )}
            </View>
          </View>
        </View>
      </Modal>
    </AppDialogContext.Provider>
  );
}

function buttonVariantStyle(style: AppDialogButtonStyle | undefined) {
  const s = style ?? 'default';
  if (s === 'cancel') return styles.btnCancel;
  if (s === 'destructive') return styles.btnDestructive;
  return styles.btnPrimary;
}

function buttonTextStyle(style: AppDialogButtonStyle | undefined) {
  const s = style ?? 'default';
  if (s === 'cancel') return styles.btnTextCancel;
  if (s === 'destructive') return styles.btnTextDestructive;
  return styles.btnTextPrimary;
}

export function useAppDialog(): AppDialogContextValue {
  const ctx = useContext(AppDialogContext);
  if (!ctx) {
    throw new Error('useAppDialog must be used within AppDialogProvider');
  }
  return ctx;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: colors.bgSurface,
    borderRadius: radii.lg,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    zIndex: 1,
    borderWidth: 1,
    borderColor: colors.borderCard,
    ...shadows.modal,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    textAlign: 'start' as any,
    marginBottom: 8,
  },
  messageScroll: {
    maxHeight: 280,
  },
  message: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'start' as any,
    lineHeight: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 18,
  },
  buttonRowSingle: {
    flexDirection: 'column-reverse',
    alignItems: 'stretch',
  },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  btnMulti: {
    flex: 1,
    minWidth: 120,
  },
  btnFull: {
    alignSelf: 'stretch',
  },
  btnPressed: { opacity: 0.88 },
  gradientBtnWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 48,
  },
  gradientBtnInner: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  btnPrimary: {
    backgroundColor: colors.primaryBlue,
  },
  btnCancel: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  btnDestructive: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  btnText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: fonts.bold,
    textAlign: 'center',
  },
  btnTextPrimary: { color: '#fff' },
  btnTextCancel: { color: '#334155' },
  btnTextDestructive: { color: '#b91c1c' },
});
