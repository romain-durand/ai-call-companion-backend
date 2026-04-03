import { useState } from "react";
import { motion } from "framer-motion";
import { Bot, Wifi, WifiOff, Settings, Phone, Terminal } from "lucide-react";
import { CallButton } from "@/components/CallButton";
import { AudioWave } from "@/components/AudioWave";
import { ToolCallLog } from "@/components/ToolCallLog";
import { ToolExchangeLog } from "@/components/ToolExchangeLog";
import { useGeminiLive, DEFAULT_SYSTEM_INSTRUCTION } from "@/hooks/useGeminiLive";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const Index = () => {
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_INSTRUCTION);
  const [savedPrompt, setSavedPrompt] = useState(DEFAULT_SYSTEM_INSTRUCTION);
  const { status, isSpeaking, toolCalls, toolExchanges, error, startSession, endSession, inputLevel, audioChunksReceived } = useGeminiLive(savedPrompt);

  const isConnected = status === "connected";
  const hasChanges = systemPrompt !== savedPrompt;

  return (
    <div className="flex flex-col items-center relative overflow-hidden">
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

      <div className="relative z-10 flex flex-col items-center gap-6 w-full max-w-lg pt-8">
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
        </motion.div>

        {/* Tabs */}
        <Tabs defaultValue="call" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="call" className="flex-1 gap-2">
              <Phone className="w-4 h-4" />
              Appel
            </TabsTrigger>
            <TabsTrigger value="prompt" className="flex-1 gap-2">
              <Settings className="w-4 h-4" />
              Prompt
            </TabsTrigger>
            <TabsTrigger value="tools" className="flex-1 gap-2">
              <Terminal className="w-4 h-4" />
              Outils
            </TabsTrigger>
          </TabsList>

          <TabsContent value="call">
            <div className="flex flex-col items-center gap-10 pt-4">
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
          </TabsContent>

          <TabsContent value="prompt">
            <div className="flex flex-col gap-4 pt-4">
              <p className="text-sm text-muted-foreground">
                Modifiez le prompt système utilisé par l'assistant lors des sessions Gemini Live.
              </p>
              <Textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="min-h-[300px] font-mono text-xs leading-relaxed"
                placeholder="Instructions système..."
              />
              <div className="flex gap-2 justify-end">
                {hasChanges && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSystemPrompt(savedPrompt)}
                  >
                    Annuler
                  </Button>
                )}
                <Button
                  size="sm"
                  disabled={!hasChanges || isConnected}
                  onClick={() => setSavedPrompt(systemPrompt)}
                >
                  {isConnected ? "Déconnectez d'abord" : "Sauvegarder"}
                </Button>
              </div>
              {isConnected && hasChanges && (
                <p className="text-xs text-muted-foreground">
                  Les changements seront appliqués à la prochaine session.
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="tools">
            <div className="flex flex-col gap-4 pt-4">
              <p className="text-sm text-muted-foreground">
                Appels d'outils envoyés par Gemini et réponses renvoyées après exécution.
              </p>
              <ToolExchangeLog exchanges={toolExchanges} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
