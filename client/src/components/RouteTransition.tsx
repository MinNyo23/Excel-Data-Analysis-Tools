import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { useLocation } from "wouter";

export default function RouteTransition({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const reduceMotion = useReducedMotion();

  return <AnimatePresence initial={false} mode="wait">
    <motion.div
      key={location}
      className="route-transition"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
      transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.23, 1, 0.32, 1] }}
    >
      {children}
    </motion.div>
  </AnimatePresence>;
}
