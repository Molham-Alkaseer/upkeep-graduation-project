import { ServiceLocationMapPicker } from '../ServiceLocationMapPicker';

jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MapView = ({ children, ...rest }: { children?: React.ReactNode }) =>
    React.createElement(View, { testID: 'mock-map-view', ...rest }, children);
  MapView.displayName = 'MapView';
  const Marker = (props: Record<string, unknown>) => React.createElement(View, { testID: 'mock-marker', ...props });
  return {
    __esModule: true,
    default: MapView,
    Marker,
  };
});

describe('ServiceLocationMapPicker', () => {
  it('exports the map picker component', () => {
    expect(ServiceLocationMapPicker).toBeDefined();
    expect(typeof ServiceLocationMapPicker).toBe('function');
  });
});
