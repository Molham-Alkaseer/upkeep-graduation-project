import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

type IonName = ComponentProps<typeof Ionicons>['name'];

/** Chevron pointing in the reading-direction “forward” (e.g. list disclosure). */
export function chevronForwardReading(rtl: boolean): IonName {
  return rtl ? 'chevron-back' : 'chevron-forward';
}
