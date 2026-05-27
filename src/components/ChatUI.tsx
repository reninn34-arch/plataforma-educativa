"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Bot, User, Send } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatNotation } from "@/lib/utils";

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
    </div>
  );
}

export function ChatUI({ subject }: { subject: string }) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState("");

  const { messages, sendMessage, status } = useChat({
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
      {/* Messages Area */}
      <ScrollArea className="flex-1">
        <div className="px-4 py-4 space-y-4 min-h-full">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent mb-4 shadow-sm">
                <Bot className="h-8 w-8 text-primary" />
              </div>
              <p className="text-lg font-bold text-foreground">Tutor Socratico</p>
              <p className="mt-1 text-sm text-muted-foreground max-w-xs">
                Escribe &quot;hola&quot; o &quot;empecemos&quot; para comenzar un ejercicio practico de <strong>{subject}</strong>
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"} animate-fade-in-up`}
            >
              {/* Avatar */}
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full mt-0.5 ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-accent text-accent-foreground"
              }`}>
                {msg.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>

              {/* Bubble */}
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-md"
                    : "bg-muted text-foreground border border-border rounded-tl-md"
                }`}
              >
                {msg.parts.map((part, i) => {
                  if (part.type === "text") return <span key={i} dangerouslySetInnerHTML={{ __html: formatNotation(part.text) }} />;
                  return null;
                })}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 flex-row">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground mt-0.5">
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

      {/* Input */}
      <form onSubmit={onSubmit} className="border-t bg-card p-4">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu respuesta..."
            className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-colors"
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
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 shadow-sm"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
