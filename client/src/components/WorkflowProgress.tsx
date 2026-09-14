import { useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export const PROCESS_STAGES = [
  { key: "reading", label: "Reading files", progress: 22 },
  { key: "matching", label: "Matching records", progress: 58 },
  { key: "building", label: "Building Excel", progress: 88 },
] as const;

const STAGE_INTERVAL_MS = 1600;

export function useProcessingStages(active: boolean) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!active) {
      setIndex(0);
      return;
    }
    setIndex(0);
    const timer = window.setInterval(() => {
      setIndex(current => Math.min(current + 1, PROCESS_STAGES.length - 1));
    }, STAGE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [active]);
  return PROCESS_STAGES[index];
}

export function ProcessButtonContent({ active, idle }: { active: boolean; idle: ReactNode }) {
  const stage = useProcessingStages(active);
  if (!active) return <>{idle}</>;
  return <><Loader2 className="animate-spin" size={17} /> {stage.label}…</>;
}

export function WorkflowProgress({
  active,
  className = "progress-state",
  hint,
}: {
  active: boolean;
  className?: string;
  hint?: string;
}) {
  const stage = useProcessingStages(active);
  if (!active) return null;
  const activeIndex = PROCESS_STAGES.findIndex(item => item.key === stage.key);
  return (
    <div className={className} role="status" aria-live="polite">
      <ol className="process-stages">
        {PROCESS_STAGES.map((item, index) => (
          <li
            key={item.key}
            className={index === activeIndex ? "is-active" : index < activeIndex ? "is-done" : undefined}
          >
            {item.label}
          </li>
        ))}
      </ol>
      <Progress value={stage.progress} />
      <span>{stage.label}…{hint ? ` ${hint}` : ""}</span>
    </div>
  );
}
