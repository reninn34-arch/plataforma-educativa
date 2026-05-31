"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Bot, Send, X, Loader2, Sparkles, User, Wrench, Paperclip, Mic, FileText } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [attachedFile, setAttachedFile] = useState<{ name: string; content: string } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();

  const { messages, sendMessage, status, error, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/ai/assistant",
    }),
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loading = status === "submitted" || status === "streaming";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setAttachedFile({ name: file.name, content });
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      return;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("El reconocimiento de voz no está soportado en este navegador.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "es-ES";
    recognition.interimResults = false;
    
    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputText((prev) => prev ? `${prev} ${transcript}` : transcript);
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);
    
    recognition.start();
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    let text = inputText.trim();
    if ((!text && !attachedFile) || loading) return;

    if (attachedFile) {
      text = text + `\n\n[Archivo Adjunto: ${attachedFile.name}]\n${attachedFile.content}`;
    }

    sendMessage({ text: text || "Revisa el archivo adjunto y haz lo que te pido con él." });
    setInputText("");
    setAttachedFile(null);
  };

  const suggestedQueries: Record<string, string[]> = {
    teacher: [
      "Crea una tarea basada en el archivo adjunto",
      "Envía un mensaje a todos mis alumnos",
      "Registra estas notas de participación",
      "¿Qué estudiantes están en riesgo?",
    ],
    admin: [
      "Crea estudiantes desde este archivo CSV",
      "Crea un curso nuevo y asigna estudiantes",
      "Genera un examen para 3ro BGU",
      "Envía credenciales al curso por correo",
    ],
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg hover:bg-violet-700 hover:shadow-xl transition-all hover:scale-105 active:scale-95"
          aria-label="Abrir asistente IA"
        >
          <Sparkles className="h-6 w-6" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-50 flex h-[520px] w-[380px] flex-col rounded-2xl border border-violet-200 bg-white shadow-2xl animate-scale-in overflow-hidden">
          <div className="flex items-center justify-between bg-violet-600 px-4 py-3 text-white shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold">Atlas IA</h3>
                <p className="text-[10px] text-violet-200">Asistente virtual</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setMessages([]); setOpen(false); }}
                className="rounded-lg p-1.5 text-violet-200 hover:bg-white/10 hover:text-white transition-colors"
                title="Cerrar asistente"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <div ref={scrollRef} className="space-y-4 p-4">
              {messages.length === 0 && (
                <div className="space-y-4">
                  <div className="text-center py-4">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 mb-3">
                      <Sparkles className="h-6 w-6 text-violet-600" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">
                      Hola, soy Atlas IA
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Puedo ayudarte a consultar datos de la plataforma.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Prueba preguntarme algo:
                    </p>
                  </div>
                  <div className="space-y-2">
                    {(pathname?.startsWith("/admin") ? suggestedQueries.admin : suggestedQueries.teacher).slice(0, 4).map((q, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage({ text: q })}
                        className="w-full rounded-xl border border-violet-100 bg-violet-50/50 px-4 py-2.5 text-left text-xs text-violet-700 hover:bg-violet-100 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex gap-3",
                    m.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {m.role !== "user" && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 mt-0.5">
                      <Bot className="h-4 w-4 text-violet-600" />
                    </div>
                  )}

                  <div
                    className={cn(
                      "rounded-2xl px-4 py-2.5 text-sm leading-relaxed max-w-[85%]",
                      m.role === "user"
                        ? "bg-violet-600 text-white rounded-br-md"
                        : "bg-muted text-foreground rounded-bl-md"
                    )}
                  >
                    {m.parts?.map((part: any, j: number) => {
                      if (part.type === "text") {
                        return <span key={j}>{part.text}</span>;
                      }
                      if (part.type === "tool-call" || part.type === "tool-result") {
                        const isResult = part.type === "tool-result";
                        return (
                          <div
                            key={j}
                            className="my-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"
                          >
                            <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
                              <Wrench className="h-3 w-3" />
                              {isResult ? "Consultado" : "Consultando"}:{" "}
                              {part.toolName}
                            </div>
                            {isResult && part.output && (
                              <pre className="mt-1 text-[10px] text-amber-800 whitespace-pre-wrap max-h-32 overflow-y-auto">
                                {typeof part.output === "string"
                                  ? part.output
                                  : JSON.stringify(part.output, null, 1)}
                              </pre>
                            )}
                            {!isResult && (
                              <div className="flex items-center gap-1 mt-1 text-xs text-amber-600">
                                <Loader2 className="h-3 w-3 animate-spin" /> Ejecutando...
                              </div>
                            )}
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>

                  {m.role === "user" && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600 mt-0.5">
                      <User className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>
              ))}

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 text-center">
                  Error de conexion. Intenta de nuevo.
                </div>
              )}

              {loading && messages.length > 0 && messages[messages.length - 1]?.role === "user" && (
                <div className="flex gap-3 justify-start">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100">
                    <Bot className="h-4 w-4 text-violet-600" />
                  </div>
                  <div className="rounded-2xl rounded-bl-md bg-muted px-4 py-3">
                    <div className="flex gap-1">
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="border-t bg-white p-3 shrink-0 flex flex-col gap-2">
            {attachedFile && (
              <div className="flex items-center justify-between rounded-lg bg-violet-50 px-3 py-2 text-xs border border-violet-100">
                <div className="flex items-center gap-2 overflow-hidden">
                  <FileText className="h-4 w-4 text-violet-600 shrink-0" />
                  <span className="truncate text-violet-800 font-medium">
                    {attachedFile.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAttachedFile(null)}
                  className="text-violet-400 hover:text-red-500 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="flex gap-2 items-center">
              <input
                type="file"
                accept=".txt,.csv,.md"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted transition-colors"
                title="Adjuntar archivo (.txt, .csv)"
              >
                <Paperclip className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={toggleRecording}
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                  isRecording 
                    ? "bg-red-100 text-red-600 animate-pulse" 
                    : "text-muted-foreground hover:bg-muted"
                )}
                title="Dictar por voz"
              >
                <Mic className="h-4 w-4" />
              </button>

              <input
                name="message"
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Preguntame algo..."
                className="flex-1 h-10 rounded-xl border border-input bg-muted/50 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
                disabled={loading}
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={loading || (!inputText.trim() && !attachedFile)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
