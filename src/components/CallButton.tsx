import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff } from "lucide-react";
import type { ConnectionStatus } from "@/hooks/useGeminiLive";

interface CallButtonProps {
  status: ConnectionStatus;
  isSpeaking: boolean;
  onStart: () => void;
  onEnd: () => void;
}

export function CallButton({ status, isSpeaking, onStart, onEnd }: CallButtonProps) {
  const isActive = status === "connected";
  const isConnecting = status === "connecting";

  return (
    <div className="relative flex items-center justify-center">
      {/* Pulse rings when connected */}
      <AnimatePresence>
        {isActive && (
          <>
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="absolute rounded-full border-2 border-primary"
                initial={{ width: 96, height: 96, opacity: 0.6 }}
                animate={{
                  width: [96, 200],
                  height: [96, 200],
                  opacity: [0.4, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.6,
                  ease: "easeOut",
                }}
              />
            ))}
          </>
        )}
      </AnimatePresence>

      {/* Glow behind button */}
      {isActive && (
        <motion.div
          className="absolute w-28 h-28 rounded-full bg-primary/20 blur-xl"
          animate={{
            scale: isSpeaking ? [1, 1.3, 1] : 1,
          }}
          transition={{ duration: 0.8, repeat: isSpeaking ? Infinity : 0 }}
        />
      )}

      {/* Main button */}
      <motion.button
        onClick={isActive ? onEnd : onStart}
        disabled={isConnecting}
        className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center transition-colors ${
          isActive
            ? "bg-destructive glow-danger"
            : isConnecting
            ? "bg-muted cursor-wait"
            : "bg-primary glow-primary"
        }`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        animate={isConnecting ? { rotate: [0, 5, -5, 0] } : {}}
        transition={isConnecting ? { duration: 0.5, repeat: Infinity } : {}}
      >
        {isActive ? (
          <PhoneOff className="w-10 h-10 text-destructive-foreground" />
        ) : (
          <Phone className="w-10 h-10 text-primary-foreground" />
        )}
      </motion.button>
    </div>
  );
}
