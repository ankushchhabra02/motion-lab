import { StyleSheet, TextInput, type StyleProp, type TextInputProps, type TextStyle } from 'react-native';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

type Props = {
  text: SharedValue<string>;
  style?: StyleProp<TextStyle>;
};

/**
 * Text that updates from a shared value without a React re-render.
 *
 * A read-only TextInput accepts a `text` prop on the native side, so we can
 * set it from the UI thread with `useAnimatedProps`. This is the standard trick
 * for timers, counters and prices that change every frame.
 */
export function ReText({ text, style }: Props) {
  const animatedProps = useAnimatedProps(() => ({ text: text.value }) as unknown as TextInputProps);
  return (
    <AnimatedTextInput
      editable={false}
      underlineColorAndroid="transparent"
      style={[styles.input, style]}
      animatedProps={animatedProps}
      accessibilityLiveRegion="polite"
    />
  );
}

const styles = StyleSheet.create({
  input: {
    padding: 0,
    margin: 0,
  },
});
