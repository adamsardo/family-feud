import { useEffect, useState } from "react";

export function useNumberCounter(
  target: number,
  options: {
    duration?: number;
    startFrom?: number;
  } = {}
) {
  const { duration = 600, startFrom = 0 } = options;
  const [current, setCurrent] = useState(startFrom);

  useEffect(() => {
    if (target === current) return;

    const startTime = Date.now();
    const startValue = current;
    const delta = target - startValue;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out)
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextValue = Math.round(startValue + delta * eased);

      setCurrent(nextValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [target, duration, current]);

  return current;
}
