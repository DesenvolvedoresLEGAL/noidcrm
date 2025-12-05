import { useEffect, useRef, useState } from "react";
import { motion, useInView, useSpring, useTransform } from "framer-motion";

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
  formatOptions?: Intl.NumberFormatOptions;
}

export function AnimatedNumber({
  value,
  duration = 1.5,
  prefix = "",
  suffix = "",
  decimals = 0,
  className = "",
  formatOptions,
}: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const [hasAnimated, setHasAnimated] = useState(false);

  const spring = useSpring(0, {
    duration: duration * 1000,
    bounce: 0,
  });

  const display = useTransform(spring, (current) => {
    const formatted = formatOptions
      ? new Intl.NumberFormat("pt-BR", formatOptions).format(current)
      : current.toLocaleString("pt-BR", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        });
    return `${prefix}${formatted}${suffix}`;
  });

  useEffect(() => {
    if (isInView && !hasAnimated) {
      spring.set(value);
      setHasAnimated(true);
    }
  }, [isInView, hasAnimated, spring, value]);

  return (
    <motion.span ref={ref} className={className}>
      {display}
    </motion.span>
  );
}

// Simplified version for currency
export function AnimatedCurrency({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) {
  return (
    <AnimatedNumber
      value={value}
      prefix="R$ "
      className={className}
      formatOptions={{
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }}
    />
  );
}

// Simplified version for percentages
export function AnimatedPercentage({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) {
  return (
    <AnimatedNumber
      value={value}
      suffix="%"
      decimals={1}
      className={className}
    />
  );
}
