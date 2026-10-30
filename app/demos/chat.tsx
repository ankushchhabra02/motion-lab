import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { GestureDetector, usePanGesture, useSimultaneousGestures, useTapGesture } from 'react-native-gesture-handler';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import Animated, {
  Extrapolation,
  FadeIn,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText } from '@/components/AppText';
import { DemoScreen } from '@/components/DemoScreen';
import { Icon } from '@/components/Icon';
import { PressableScale } from '@/components/PressableScale';
import { useHaptics } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { easings, scaled, spring, springs, timing } from '@/lib/motion';

type Message = {
  id: number;
  text: string;
  mine: boolean;
  time: string;
  replyTo?: string;
  liked?: boolean;
  /** Only messages created during this session animate in. */
  animate: boolean;
};

const CONTACT = 'Mina';
const TS_W = 72; // width of the timestamp column revealed by swiping left
const REPLY_THRESHOLD = 52;

const INITIAL: Message[] = [
  { id: 1, text: 'Did you try the new tilt card demo?', mine: false, time: '9:38 AM', animate: false },
  { id: 2, text: 'The glare follows your finger', mine: false, time: '9:38 AM', animate: false },
  { id: 3, text: 'Yes! It springs back flat when you let go', mine: true, time: '9:39 AM', animate: false },
  { id: 4, text: 'Swipe a bubble to the right to reply to it', mine: true, time: '9:39 AM', animate: false },
  { id: 5, text: 'And swipe left anywhere to see the times', mine: false, time: '9:40 AM', animate: false },
  { id: 6, text: 'Double-tap a message to heart it', mine: false, time: '9:40 AM', animate: false },
];

const REPLIES = [
  'Love it. Ship it!',
  'Try it again with slow motion on in Settings',
  'These bubbles use a spring, not a timing curve',
  'Haptics on every gesture, no exceptions',
  'What should we animate next?',
];

const SUGGESTIONS = ['Sounds good', 'Show me more', 'How does it work?'];

/**
 * Messages, modeled on iMessage.
 *
 * - Bubbles group by sender: 2pt apart inside a group, only the last one gets a tail.
 * - New outgoing bubbles rise out of the input field; incoming ones grow from the
 *   bottom-left corner they "come from" (transformOrigin + spring scale).
 * - Swipe left anywhere: every row slides left together to reveal timestamps,
 *   then springs back with the release velocity.
 * - Swipe a bubble right to reply, double-tap it to heart it (tapback).
 * - The composer rides the keyboard on the UI thread via keyboard-controller.
 */
export default function ChatScreen() {
  const t = useTheme();
  const haptics = useHaptics();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);

  const [messages, setMessages] = useState<Message[]>(INITIAL);
  const [typing, setTyping] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const nextId = useRef(100);
  const replyIndex = useRef(0);
  const minute = useRef(41);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const now = () => `9:${String(Math.min(59, minute.current++)).padStart(2, '0')} AM`;
  const scrollToEnd = () => scrollRef.current?.scrollToEnd({ animated: true });

  // --- Swipe left to reveal timestamps ----------------------------------------
  const reveal = useSharedValue(0);
  const revealPan = usePanGesture({
    activeOffsetX: [-12, 10000],
    failOffsetX: [-10000, 12],
    failOffsetY: [-10, 10],
    onUpdate: (e) => {
      'worklet';
      const raw = Math.min(0, e.translationX);
      // Rubber band: follows the finger, then resists past the column width.
      reveal.value = -TS_W * (1 - Math.exp(raw / TS_W)) * 1.15;
    },
    onDeactivate: (e) => {
      'worklet';
      reveal.value = spring(0, springs.snappy, e.velocityX);
    },
  });

  // --- Keyboard ------------------------------------------------------------------
  const { height: keyboardHeight } = useReanimatedKeyboardAnimation();
  const keyboardStyle = useAnimatedStyle(() => ({
    paddingBottom: Math.max(Math.abs(keyboardHeight.value), insets.bottom),
  }));

  // --- Composer ------------------------------------------------------------------
  const hasText = useSharedValue(0);
  const onDraftChange = (text: string) => {
    setDraft(text);
    hasText.value = spring(text.trim().length > 0 ? 1 : 0, springs.snappy);
  };
  const sendStyle = useAnimatedStyle(() => ({
    opacity: hasText.value,
    transform: [{ scale: 0.4 + hasText.value * 0.6 }],
  }));
  const micStyle = useAnimatedStyle(() => ({ opacity: 1 - hasText.value }));

  const replyOpen = useSharedValue(0);
  useEffect(() => {
    replyOpen.value = spring(replyTo ? 1 : 0, springs.stiff);
  }, [replyTo, replyOpen]);
  const replyBarStyle = useAnimatedStyle(() => ({
    height: replyOpen.value * 50,
    opacity: replyOpen.value,
  }));

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    haptics.light();
    setMessages((m) => [
      ...m,
      { id: nextId.current++, text: trimmed, mine: true, time: now(), animate: true, replyTo: replyTo?.text },
    ]);
    setDraft('');
    hasText.value = spring(0, springs.snappy);
    setReplyTo(null);
    setReceipt('Delivered');

    timers.current.push(
      setTimeout(() => {
        setReceipt(`Read ${now()}`);
        setTyping(true);
      }, 900),
    );
    timers.current.push(
      setTimeout(() => {
        setTyping(false);
        const reply = REPLIES[replyIndex.current++ % REPLIES.length] ?? REPLIES[0]!;
        setMessages((m) => [...m, { id: nextId.current++, text: reply, mine: false, time: now(), animate: true }]);
      }, 2600),
    );
  };

  const toggleLike = (id: number) => {
    setMessages((list) => list.map((m) => (m.id === id ? { ...m, liked: !m.liked } : m)));
  };

  const lastMine = messages.reduce((acc, m, i) => (m.mine ? i : acc), -1);

  return (
    <DemoScreen id="chat" background={t.colors.canvas}>
      <Animated.View style={[styles.flex, keyboardStyle]}>
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={{ paddingVertical: t.spacing.md }}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
          onContentSizeChange={scrollToEnd}
        >
          <ContactHeader />
          <GestureDetector gesture={revealPan}>
            <View collapsable={false}>
              {messages.map((message, index) => {
                const prev = messages[index - 1];
                const next = messages[index + 1];
                const first = !prev || prev.mine !== message.mine;
                const last = (!next || next.mine !== message.mine) && !(typing && !message.mine && index === messages.length - 1);
                return (
                  <View key={message.id}>
                    <Bubble
                      message={message}
                      first={first}
                      last={last}
                      reveal={reveal}
                      onReply={() => setReplyTo(message)}
                      onToggleLike={() => toggleLike(message.id)}
                    />
                    {index === lastMine && receipt ? (
                      <Animated.View key={receipt} entering={FadeIn.duration(scaled(220))}>
                        <AppText style={[styles.receipt, { color: t.colors.textSecondary }]}>{receipt}</AppText>
                      </Animated.View>
                    ) : null}
                  </View>
                );
              })}
              {typing ? <TypingBubble /> : null}
            </View>
          </GestureDetector>
        </ScrollView>

        {/* Reply preview */}
        <Animated.View style={[styles.replyBar, replyBarStyle]}>
          <View style={[styles.replyInner, { paddingHorizontal: t.spacing.lg }]}>
            <Icon name="arrow-undo" size={16} tone="secondary" />
            <View style={styles.flex}>
              <AppText style={[styles.small, { color: t.colors.textSecondary }]}>
                Reply to {replyTo?.mine ? 'yourself' : CONTACT}
              </AppText>
              <AppText numberOfLines={1} style={{ fontSize: 15 }}>
                {replyTo?.text ?? ''}
              </AppText>
            </View>
            <PressableScale onPress={() => setReplyTo(null)} scaleTo={0.85} haptic="none" hitSlop={8} accessibilityLabel="Cancel reply">
              <Icon name="close-circle" size={22} tone="tertiary" />
            </PressableScale>
          </View>
        </Animated.View>

        {/* Suggested replies */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.suggestions}
          contentContainerStyle={{ paddingHorizontal: t.spacing.md, gap: t.spacing.sm }}
          keyboardShouldPersistTaps="handled"
        >
          {SUGGESTIONS.map((text) => (
            <PressableScale
              key={text}
              onPress={() => send(text)}
              scaleTo={0.94}
              haptic="none"
              accessibilityLabel={`Send ${text}`}
              style={[styles.suggestion, { borderColor: t.colors.borderStrong }]}
            >
              <AppText style={{ fontSize: 15, color: t.colors.info }}>{text}</AppText>
            </PressableScale>
          ))}
        </ScrollView>

        {/* Composer */}
        <View style={[styles.composer, { backgroundColor: t.colors.canvas }]}>
          <PressableScale
            onPress={() => haptics.light()}
            scaleTo={0.88}
            haptic="none"
            accessibilityLabel="Apps"
            style={[styles.plus, { backgroundColor: t.colors.fill }]}
          >
            <Icon name="add" size={24} tone="secondary" />
          </PressableScale>
          <View style={[styles.field, { borderColor: t.colors.borderStrong }]}>
            <TextInput
              value={draft}
              onChangeText={onDraftChange}
              onFocus={() => setTimeout(scrollToEnd, 250)}
              placeholder="iMessage"
              placeholderTextColor={t.colors.textTertiary}
              multiline
              style={[styles.input, { color: t.colors.text }]}
              accessibilityLabel="Message"
            />
            <View style={styles.fieldAction}>
              <Animated.View style={[StyleSheet.absoluteFill, styles.center, micStyle]} pointerEvents="none">
                <Icon name="mic-outline" size={20} tone="tertiary" />
              </Animated.View>
              <Animated.View style={sendStyle}>
                <PressableScale
                  onPress={() => send(draft)}
                  disabled={draft.trim().length === 0}
                  scaleTo={0.85}
                  haptic="none"
                  accessibilityLabel="Send"
                  style={[styles.send, { backgroundColor: t.colors.info }]}
                >
                  <Icon name="arrow-up" size={18} tone="onAccent" />
                </PressableScale>
              </Animated.View>
            </View>
          </View>
        </View>
      </Animated.View>
    </DemoScreen>
  );
}

/** Contact monogram and name at the top of the thread, then the date stamp. */
function ContactHeader() {
  const t = useTheme();
  return (
    <View style={[styles.center, { marginBottom: t.spacing.lg }]}>
      <View style={[styles.monogram, { backgroundColor: t.colors.textTertiary }]}>
        <AppText style={[styles.monogramText, { color: t.colors.onAccent }]}>M</AppText>
      </View>
      <View style={styles.contactName}>
        <AppText style={{ fontSize: 12 }}>{CONTACT}</AppText>
        <Icon name="chevron-forward" size={10} tone="tertiary" />
      </View>
      <AppText style={[styles.dateStamp, { color: t.colors.textSecondary }]}>
        <AppText style={[styles.dateStamp, styles.bold, { color: t.colors.textSecondary }]}>iMessage{'\n'}</AppText>
        Today 9:38 AM
      </AppText>
    </View>
  );
}

type BubbleProps = {
  message: Message;
  first: boolean;
  last: boolean;
  reveal: SharedValue<number>;
  onReply: () => void;
  onToggleLike: () => void;
};

function Bubble({ message, first, last, reveal, onReply, onToggleLike }: BubbleProps) {
  const t = useTheme();
  const haptics = useHaptics();
  const onCross = haptics.light;
  const onLike = haptics.light;
  const { mine } = message;
  const bubbleColor = mine ? t.colors.info : t.colors.fill;
  const textColor = mine ? t.colors.onAccent : t.colors.text;

  // --- Enter ----------------------------------------------------------------------
  const enter = useSharedValue(message.animate ? 0 : 1);
  useEffect(() => {
    if (message.animate) enter.value = spring(1, mine ? springs.snappy : springs.bouncy);
  }, [enter, message.animate, mine]);

  // --- Swipe right to reply -------------------------------------------------------
  const tx = useSharedValue(0);
  const passed = useSharedValue(0);
  const replyPan = usePanGesture({
    activeOffsetX: [-10000, 14],
    failOffsetX: [-12, 10000],
    failOffsetY: [-10, 10],
    onUpdate: (e) => {
      'worklet';
      // Exponential resistance: moves freely at first, then barely.
      tx.value = 80 * (1 - Math.exp(-Math.max(0, e.translationX) / 80));
      const past = tx.value >= REPLY_THRESHOLD ? 1 : 0;
      if (past !== passed.value) {
        passed.value = past;
        if (past === 1) scheduleOnRN(onCross);
      }
    },
    onDeactivate: (e) => {
      'worklet';
      if (!e.canceled && passed.value === 1) scheduleOnRN(onReply);
      passed.value = 0;
      tx.value = spring(0, springs.snappy, e.velocityX);
    },
  });

  // --- Double-tap to heart (tapback) ---------------------------------------------
  const likePop = useSharedValue(message.liked ? 1 : 0);
  useEffect(() => {
    likePop.value = message.liked ? withSequence(timing(1.3, 120, easings.out), spring(1, springs.bouncy)) : spring(0, springs.stiff);
  }, [message.liked, likePop]);
  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    onActivate: () => {
      'worklet';
      scheduleOnRN(onLike);
      scheduleOnRN(onToggleLike);
    },
  });

  const gestures = useSimultaneousGestures(replyPan, doubleTap);

  // --- Styles ----------------------------------------------------------------------
  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: reveal.value }] }));
  const bubbleStyle = useAnimatedStyle(() => {
    const p = enter.value;
    return {
      opacity: Math.min(1, p * 1.5),
      transform: [
        { translateX: tx.value },
        { translateY: mine ? (1 - p) * 28 : 0 },
        { scale: mine ? 0.92 + 0.08 * p : 0.5 + 0.5 * p },
      ],
    };
  });
  const replyIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(tx.value, [12, REPLY_THRESHOLD], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(tx.value, [12, REPLY_THRESHOLD], [0.5, 1], Extrapolation.CLAMP) * (passed.value ? 1.1 : 1) }],
  }));
  const likeStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, likePop.value), transform: [{ scale: likePop.value }] }));

  return (
    <Animated.View style={[{ marginTop: first ? 10 : 2 }, rowStyle]}>
      {message.replyTo ? (
        <View style={[styles.quoteRow, mine ? styles.alignEnd : styles.alignStart]}>
          <View style={[styles.quote, { borderColor: t.colors.borderStrong }]}>
            <AppText numberOfLines={2} style={{ fontSize: 14, color: t.colors.textSecondary }}>
              {message.replyTo}
            </AppText>
          </View>
        </View>
      ) : null}
      <View style={[styles.row, mine ? styles.alignEnd : styles.alignStart]}>
        <View style={styles.bubbleWrap}>
          <Animated.View style={[styles.replyIcon, { backgroundColor: t.colors.fill }, replyIconStyle]}>
            <Icon name="arrow-undo" size={14} tone="secondary" />
          </Animated.View>
          <GestureDetector gesture={gestures}>
            <Animated.View
              accessible
              accessibilityLabel={`${mine ? 'You' : CONTACT}: ${message.text}${message.liked ? ', hearted' : ''}`}
              accessibilityHint="Swipe right to reply, double-tap to heart"
              style={[styles.bubble, { backgroundColor: bubbleColor, transformOrigin: mine ? 'right bottom' : 'left bottom' }, bubbleStyle]}
            >
              {last ? <Tail mine={mine} color={bubbleColor} canvas={t.colors.canvas} /> : null}
              <AppText style={[styles.bubbleText, { color: textColor }]}>{message.text}</AppText>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.tapback,
                  mine ? styles.tapbackMine : styles.tapbackTheirs,
                  { backgroundColor: t.colors.info, borderColor: t.colors.canvas },
                  likeStyle,
                ]}
              >
                <Icon name="heart" size={13} tone="onAccent" />
              </Animated.View>
            </Animated.View>
          </GestureDetector>
        </View>
      </View>
      <AppText style={[styles.timestamp, { color: t.colors.textSecondary }]}>{message.time}</AppText>
    </Animated.View>
  );
}

/**
 * The iMessage tail: a bubble-colored curve, then a canvas-colored curve on top
 * that carves the inside of the hook. Works because the thread background is solid.
 */
function Tail({ mine, color, canvas }: { mine: boolean; color: string; canvas: string }) {
  return (
    <>
      <View pointerEvents="none" style={[styles.tail, mine ? styles.tailRight : styles.tailLeft, { backgroundColor: color }]} />
      <View pointerEvents="none" style={[styles.tailCut, mine ? styles.tailCutRight : styles.tailCutLeft, { backgroundColor: canvas }]} />
    </>
  );
}

/** iMessage typing bubble: three dots brightening in turn, with the little thought-bubble tail. */
function TypingBubble() {
  const t = useTheme();
  const reduceMotion = useReducedMotion();
  const enter = useSharedValue(0);
  const dot0 = useSharedValue(0.35);
  const dot1 = useSharedValue(0.35);
  const dot2 = useSharedValue(0.35);

  useEffect(() => {
    enter.value = spring(1, springs.bouncy);
    if (reduceMotion) return;
    [dot0, dot1, dot2].forEach((dot, i) => {
      dot.value = withDelay(
        scaled(i * 180),
        withRepeat(withSequence(timing(1, 300, easings.inOut), timing(0.35, 300, easings.inOut), timing(0.35, 240)), -1, false),
      );
    });
  }, [reduceMotion, enter, dot0, dot1, dot2]);

  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, enter.value * 1.5),
    transform: [{ scale: 0.4 + 0.6 * enter.value }],
  }));

  return (
    <View style={[styles.row, styles.alignStart, { marginTop: 10 }]}>
      <Animated.View accessibilityLabel={`${CONTACT} is typing`} style={[styles.typing, { backgroundColor: t.colors.fill, transformOrigin: 'left bottom' }, style]}>
        <Dot value={dot0} color={t.colors.textSecondary} />
        <Dot value={dot1} color={t.colors.textSecondary} />
        <Dot value={dot2} color={t.colors.textSecondary} />
        <View style={[styles.typingTailBig, { backgroundColor: t.colors.fill }]} />
        <View style={[styles.typingTailSmall, { backgroundColor: t.colors.fill }]} />
      </Animated.View>
    </View>
  );
}

function Dot({ value, color }: { value: SharedValue<number>; color: string }) {
  const style = useAnimatedStyle(() => ({ opacity: value.value }));
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  bold: { fontWeight: '600' },
  small: { fontSize: 13 },
  monogram: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramText: {
    fontSize: 24,
    fontWeight: '600',
  },
  contactName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 4,
  },
  dateStamp: {
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
    marginTop: 16,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  alignStart: { justifyContent: 'flex-start' },
  alignEnd: { justifyContent: 'flex-end' },
  bubbleWrap: {
    maxWidth: '78%',
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  bubbleText: {
    fontSize: 17,
    lineHeight: 22,
  },
  replyIcon: {
    position: 'absolute',
    left: 0,
    top: '50%',
    marginTop: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tail: {
    position: 'absolute',
    bottom: 0,
    width: 20,
    height: 22,
  },
  tailRight: { right: -8, borderBottomLeftRadius: 16 },
  tailLeft: { left: -8, borderBottomRightRadius: 16 },
  tailCut: {
    position: 'absolute',
    bottom: -4,
    width: 20,
    height: 28,
  },
  tailCutRight: { right: -20, borderBottomLeftRadius: 12 },
  tailCutLeft: { left: -20, borderBottomRightRadius: 12 },
  tapback: {
    position: 'absolute',
    top: -14,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapbackMine: { left: -12 },
  tapbackTheirs: { right: -12 },
  quoteRow: {
    flexDirection: 'row',
    paddingHorizontal: 22,
    marginBottom: 3,
  },
  quote: {
    maxWidth: '70%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  timestamp: {
    position: 'absolute',
    right: -TS_W,
    width: TS_W,
    bottom: 6,
    fontSize: 11,
    paddingLeft: 4,
  },
  receipt: {
    fontSize: 11,
    textAlign: 'right',
    paddingRight: 18,
    marginTop: 3,
    fontWeight: '500',
  },
  typing: {
    flexDirection: 'row',
    gap: 5,
    height: 36,
    paddingHorizontal: 13,
    borderRadius: 18,
    alignItems: 'center',
  },
  typingTailBig: {
    position: 'absolute',
    left: -2,
    bottom: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  typingTailSmall: {
    position: 'absolute',
    left: -7,
    bottom: -7,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  replyBar: {
    overflow: 'hidden',
    justifyContent: 'center',
  },
  replyInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  suggestions: {
    flexGrow: 0,
    marginBottom: 6,
  },
  suggestion: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  plus: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: {
    flex: 1,
    minHeight: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingLeft: 14,
    paddingRight: 3,
  },
  input: {
    flex: 1,
    fontSize: 17,
    lineHeight: 22,
    paddingTop: 7,
    paddingBottom: 7,
    maxHeight: 120,
  },
  fieldAction: {
    width: 30,
    height: 30,
    marginBottom: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  send: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
