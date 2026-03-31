import { motion } from "framer-motion";

interface AudioWaveProps {
  active: boolean;
  level: number;
  label: string;
}

export function AudioWave({ active, level, label }: AudioWaveProps) {
  const bars = 12;
  
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
        {label}
      </span>
      <div className="flex items-center gap-1 h-12">
        {Array.from({ length: bars }).map((_, i) => {
          const centerDist = Math.abs(i - bars / 2) / (bars / 2);
          const baseHeight = active ? 0.3 + (1 - centerDist) * 0.7 * Math.max(level, 0.15) : 0.1;
          
          return (
            <motion.div
              key={i}
              className="w-1 rounded-full bg-primary"
              animate={{
                height: active ? `${baseHeight * 48}px` : "4px",
                opacity: active ? 0.6 + level * 0.4 : 0.2,
              }}
              transition={{
                duration: 0.15,
                delay: i * 0.02,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
