import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Whether the OS asks for reduced motion.
 *
 * The design's rule: with reduced motion the card appears already seated and
 * the seal is static — but HAPTICS ARE UNCHANGED. The movement is decoration;
 * the haptic is signal, and someone who turns off animation still needs to
 * know a verdict landed.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setReduced(value);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  return reduced;
}
