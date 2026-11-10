import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';

const ReducedMotion = createContext(true);
const nativeDriver = Platform.OS !== 'web';

// One subscription for the whole app. Native motion stays off until the preference is known.
export function MotionProvider({ children }: { children: React.ReactNode }) {
  const [reduced, setReduced] = useState(() => Platform.OS === 'web' && typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : true);
  useEffect(() => {
    if (Platform.OS === 'web') {
      const query = window.matchMedia('(prefers-reduced-motion: reduce)');
      const update = () => setReduced(query.matches);
      update();
      query.addEventListener('change', update);
      return () => query.removeEventListener('change', update);
    }
    let active = true;
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
      changed = true;
      if (active) setReduced(value);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (active && !changed) setReduced(value);
    }).catch(() => {});
    return () => { active = false; subscription.remove(); };
  }, []);
  return <ReducedMotion.Provider value={reduced}>{children}</ReducedMotion.Provider>;
}

export function CardEntrance({ children, style, delay = 0 }: {
  children: React.ReactNode; style?: StyleProp<ViewStyle>; delay?: number;
}) {
  const reduced = useContext(ReducedMotion);
  const progress = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduced) { progress.setValue(1); return; }
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1, duration: 300, delay: Math.min(delay, 160), easing: Easing.out(Easing.cubic),
      useNativeDriver: nativeDriver, isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [delay, progress, reduced]);
  return <Animated.View testID="card-entrance" style={[style, {
    opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }),
    transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
  }]}>{children}</Animated.View>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// A single short lift when selection or status changes; no timers remain running.
export function IconPop({ children, active = true, value }: {
  children: React.ReactNode; active?: boolean; value?: string | boolean;
}) {
  const reduced = useContext(ReducedMotion);
  const progress = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduced || !active) { progress.setValue(1); return; }
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1, duration: 260, easing: Easing.out(Easing.back(1.2)),
      useNativeDriver: nativeDriver, isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [active, progress, reduced, value]);
  return <Animated.View testID="icon-pop" style={{ transform: [
    { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) },
    { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [2, 0] }) },
  ] }}>{children}</Animated.View>;
}

// Animate only transforms/opacity, with no React updates on animation frames.
export function TactilePressable({ style, onPressIn, onPressOut, ...props }: PressableProps) {
  const reduced = useContext(ReducedMotion);
  const [pressed, setPressed] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => { progress.stopAnimation(); progress.setValue(0); return () => progress.stopAnimation(); }, [progress, reduced]);
  const move = (toValue: number) => {
    progress.stopAnimation();
    Animated.timing(progress, {
      toValue, duration: reduced ? 0 : toValue ? 90 : 170,
      easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver, isInteraction: false,
    }).start();
  };
  return <AnimatedPressable {...props}
    onPressIn={event => { setPressed(true); move(1); onPressIn?.(event); }}
    onPressOut={event => { setPressed(false); move(0); onPressOut?.(event); }}
    style={[typeof style === 'function' ? style({ pressed }) : style, pressed && { opacity: 0.9 }, {
      transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, reduced ? 1 : 0.98] }) }],
    }]}
  />;
}
