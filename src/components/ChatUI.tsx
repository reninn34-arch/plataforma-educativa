"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Bot, User, Send } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatNotation } from "@/lib/utils";

function renderFormatted(text: string) {
  const parts = text.split(/(<sub>.*?<\/sub>|<sup>.*?<\/sup>)/g);
  return parts.map((part, i) => {
    if (part.startsWith("<sub>")) return <sub key={i}>{part.replace(/<\/?sub>/g, "")}</sub>;
    if (part.startsWith("<sup>")) return <sup key={i}>{part.replace(/<\/?sup>/g, "")}</sup>;
    return <>{part}</>;
  });
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400/40 animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400/40 animate-bounce" style={{ animationDelay: "150ms" }} />
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400/40 animate-bounce" style={{ animationDelay: "300ms" }} />
    </div>
  );
}

export function ChatUI({ subject }: { subject: string }) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState("");

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { subject },
    }),
  });

  const isLoading = status === "streaming" || status === "submitted";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ role: "user", parts: [{ type: "text", text: input }] });
    setInput("");
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full bg-card">
      <ScrollArea className="flex-1 min-h-0">
        <div role="log" aria-live="polite" className="px-4 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 mb-4 shadow-sm">
                <Bot className="h-8 w-8 text-indigo-600" />
              </div>
              <p className="text-lg font-bold text-foreground">Tutor Socrático</p>
              <p className="mt-1 text-sm text-muted-foreground max-w-xs">
                Escribe &quot;hola&quot; o &quot;empecemos&quot; para comenzar un ejercicio práctico de <strong>{subject}</strong>
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 text-center">
              Error al conectar con el tutor. Intenta de nuevo.
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"} animate-fade-in-up`}
            >
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full mt-0.5 ${
                msg.role === "user"
                  ? "bg-indigo-600 text-primary-foreground"
                  : "bg-indigo-50 text-accent-foreground"
              }`}>
                {msg.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>

              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-primary-foreground rounded-tr-md"
                    : "bg-muted text-foreground border border-border rounded-tl-md"
                }`}
              >
                {msg.parts?.map((part, i) => {
                  if (part.type === "text") return <span key={i}>{renderFormatted(formatNotation(part.text))}</span>;
                  return null;
                })}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 flex-row">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-accent-foreground mt-0.5">
                <Bot className="h-4 w-4" />
              </div>
              <div className="rounded-2xl rounded-tl-md bg-muted border border-border shadow-sm">
                <TypingIndicator />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <form onSubmit={onSubmit} className="border-t bg-card p-4">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu respuesta..."
            className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-colors"
            aria-label="Mensaje"
            disabled={isLoading}
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit(e);
              }
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            aria-label="Enviar mensaje"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-primary-foreground hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 shadow-sm"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
