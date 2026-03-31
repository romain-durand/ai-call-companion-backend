import { motion } from "framer-motion";
import { Bot, Wifi, WifiOff } from "lucide-react";
import { CallButton } from "@/components/CallButton";
import { AudioWave } from "@/components/AudioWave";
import { ToolCallLog } from "@/components/ToolCallLog";
import { useGeminiLive } from "@/hooks/useGeminiLive";

const Index = () => {
  const { status, isSpeaking, toolCalls, error, startSession, endSession, inputLevel, audioChunksReceived } = useGeminiLive();

  const isConnected = status === "connected";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-secondary/30" />
      
      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "linear-gradient(hsl(175 70% 50%) 1px, transparent 1px), linear-gradient(90deg, hsl(175 70% 50%) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-10 w-full max-w-md">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-3"
        >
          <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center border border-border">
            <Bot className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Assistant IA de Romain</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {isConnected ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-primary" />
                <span>En ligne — Gemini Live</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                <span>Hors ligne</span>
              </>
            )}
          </div>
        </motion.div>

        {/* Audio visualizers */}
        {isConnected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-12"
          >
            <AudioWave active={isConnected} level={inputLevel} label="Micro" />
            <AudioWave active={isSpeaking} level={isSpeaking ? 0.7 : 0} label="IA" />
          </motion.div>
        )}

        {/* Call button */}
        <CallButton
          status={status}
          isSpeaking={isSpeaking}
          onStart={startSession}
          onEnd={endSession}
        />

        {/* Status text */}
        <motion.p
          className="text-sm text-muted-foreground text-center font-mono"
          animate={{ opacity: status === "connecting" ? [0.5, 1, 0.5] : 1 }}
          transition={{ duration: 1.5, repeat: status === "connecting" ? Infinity : 0 }}
        >
          {status === "disconnected" && "Appuyez pour démarrer l'assistant"}
          {status === "connecting" && "Connexion en cours..."}
          {status === "connected" && (isSpeaking ? "L'assistant parle..." : "En écoute...")}
        </motion.p>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm text-destructive bg-destructive/10 px-4 py-2 rounded-lg border border-destructive/20"
          >
            {error}
          </motion.div>
        )}

        {/* Tool call log */}
        <ToolCallLog toolCalls={toolCalls} />
      </div>
    </div>
  );
};

export default Index;
