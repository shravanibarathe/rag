"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Send, 
  Plus, 
  FileText, 
  Upload, 
  MessageSquare, 
  History, 
  User, 
  Sparkles,
  Loader2,
  X,
  Menu,
  ChevronDown
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const API_BASE = "http://localhost:8000";

type Message = {
  role: "user" | "ai";
  content: string;
  timestamp?: string;
};

type Session = string;

type DocumentStatus = {
  filename: string;
  status: "success" | "processing" | "error";
  chunks?: number;
};

export default function DocuMindApp() {
  // State
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [documents, setDocuments] = useState<DocumentStatus[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"history" | "chat" | "docs">("chat");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize session
  useEffect(() => {
    let savedSession = localStorage.getItem("documind_session");
    if (!savedSession) {
      savedSession = crypto.randomUUID();
      localStorage.setItem("documind_session", savedSession);
    }
    setActiveSession(savedSession);
    fetchSessions();
    fetchDocuments();

    const interval = setInterval(() => {
        fetchSessions();
        fetchDocuments();
    }, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  // Fetch history when session changes
  useEffect(() => {
    if (activeSession) {
      fetchHistory(activeSession);
    }
  }, [activeSession]);

  // Scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const fetchSessions = async () => {
    try {
      const resp = await fetch(`${API_BASE}/sessions`);
      const data = await resp.json();
      setSessions(data.sessions || []);
    } catch (error) {
      console.error("Failed to fetch sessions", error);
    }
  };

  const fetchDocuments = async () => {
    try {
      const resp = await fetch(`${API_BASE}/documents`);
      const data = await resp.json();
      setDocuments(data || []);
    } catch (error) {
      console.error("Failed to fetch documents", error);
    }
  };

  const fetchHistory = async (sessionId: string) => {
    try {
      const resp = await fetch(`${API_BASE}/history/${sessionId}`);
      const data = await resp.json();
      setMessages(data);
    } catch (error) {
      console.error("Failed to fetch history", error);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || isTyping) return;

    const userMessage: Message = { role: "user", content: inputText };
    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsTyping(true);

    try {
      const response = await fetch(
        `${API_BASE}/chat?query=${encodeURIComponent(inputText)}&session_id=${activeSession}`
      );
      const data = await response.json();
      
      const aiMessage: Message = { role: "ai", content: data.answer };
      setMessages((prev) => [...prev, aiMessage]);
      
      // Update session list if new
      if (!sessions.includes(activeSession)) {
        setSessions([activeSession, ...sessions]);
      }
    } catch (error) {
      console.error("Chat error", error);
      // Handle error display
    } finally {
      setIsTyping(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
        if (files[i].size > 10 * 1024 * 1024) {
            alert(`File ${files[i].name} is too large (>10MB).`);
            continue;
        }
        if (files[i].type !== "application/pdf") {
            continue;
        }
      formData.append("files", files[i]);
      
      // Temporary optimistic update
      setDocuments(prev => [...prev, { filename: files[i].name, status: "processing" }]);
    }

    setIsUploading(true);
    try {
      const resp = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await resp.json();
      
      // Update statuses from backend
      setDocuments(prev => 
        prev.map(doc => {
            const result = data.details.find((d: any) => d.filename === doc.filename);
            return result ? { ...doc, status: "success", chunks: result.chunks } : doc;
        })
      );
    } catch (error) {
      console.error("Upload error", error);
    } finally {
      setIsUploading(false);
    }
  };

  const startNewChat = () => {
    const newId = crypto.randomUUID();
    localStorage.setItem("documind_session", newId);
    setActiveSession(newId);
    setMessages([]);
    setActiveTab("chat");
  };

  const handleDeleteDocument = async (filename: string) => {
    try {
        await fetch(`${API_BASE}/documents/${encodeURIComponent(filename)}`, {
            method: "DELETE"
        });
        fetchDocuments();
    } catch (error) {
        console.error("Delete error", error);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden text-slate-200">
      {/* TOPBAR */}
      <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-panel/50 backdrop-blur-md z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center border border-primary/30">
            <Sparkles className="text-primary w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            DocuMind AI
          </h1>
        </div>

        <div className="hidden md:flex items-center gap-4 bg-slate-800/50 rounded-lg px-3 py-1.5 border border-border">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            SESSION:
          </div>
          <span className="text-xs font-mono text-slate-300 truncate max-w-[150px]">
            {activeSession}
          </span>
          <ChevronDown className="w-4 h-4 text-slate-500" />
        </div>

        <button 
          className="md:hidden p-2 hover:bg-slate-800 rounded-lg"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          <Menu className="w-6 h-6" />
        </button>
      </header>

      {/* MOBILE TABS (Responsive) */}
      <div className="md:hidden flex h-12 border-b border-border bg-panel">
        <button 
          onClick={() => setActiveTab("history")}
          className={cn("flex-1 text-sm font-medium", activeTab === "history" ? "text-primary border-b-2 border-primary" : "text-slate-500")}
        >
          History
        </button>
        <button 
          onClick={() => setActiveTab("chat")}
          className={cn("flex-1 text-sm font-medium", activeTab === "chat" ? "text-primary border-b-2 border-primary" : "text-slate-500")}
        >
          Chat
        </button>
        <button 
          onClick={() => setActiveTab("docs")}
          className={cn("flex-1 text-sm font-medium", activeTab === "docs" ? "text-primary border-b-2 border-primary" : "text-slate-500")}
        >
          Documents
        </button>
      </div>

      {/* DASHBOARD CONTENT */}
      <main className="flex-1 flex overflow-hidden relative">
        
        {/* LEFT PANEL - Session History */}
        <aside className={cn(
          "w-72 border-r border-border bg-slate-900/30 flex flex-col transition-all duration-300",
          "fixed inset-y-16 left-0 z-20 md:relative md:inset-0",
          activeTab !== "history" && "hidden md:flex",
          isMobileMenuOpen ? "translate-x-0" : "md:translate-x-0"
        )}>
          <div className="p-4">
            <button 
              onClick={startNewChat}
              className="w-full btn-primary group"
            >
              <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
              New Chat
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto px-4 py-2 custom-scrollbar">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-2">
              Recent Conversations
            </div>
            <div className="space-y-2">
              {sessions.length === 0 ? (
                <div className="text-slate-600 text-sm px-2 italic">No history yet</div>
              ) : (
                sessions.map((s) => (
                    <button
                        key={s}
                        onClick={() => { setActiveSession(s); setActiveTab("chat"); }}
                        className={cn(
                            "w-full text-left px-3 py-3 rounded-xl flex items-center gap-3 transition-all",
                            activeSession === s ? "bg-primary/20 border border-primary/30 text-white" : "hover:bg-slate-800 text-slate-400"
                        )}
                    >
                        <MessageSquare className={cn("w-4 h-4", activeSession === s ? "text-primary" : "text-slate-600")} />
                        <span className="text-sm truncate font-medium">Chat {s.slice(0, 8)}</span>
                    </button>
                ))
              )}
            </div>
          </div>
          
          <div className="p-4 border-t border-border mt-auto">
            <div className="flex items-center gap-3 px-2 py-3 rounded-xl bg-slate-800/40 border border-border">
                <div className="w-8 h-8 rounded-full bg-primary/30 flex items-center justify-center text-xs font-bold text-primary">
                    JD
                </div>
                <div className="flex-1 overflow-hidden">
                    <p className="text-xs font-bold truncate">John Doe</p>
                    <p className="text-[10px] text-slate-500">Free Tier</p>
                </div>
            </div>
          </div>
        </aside>

        {/* CENTER PANEL - Chat Area */}
        <section className={cn(
          "flex-1 flex flex-col bg-background relative",
          activeTab !== "chat" && "hidden md:flex"
        )}>
          {/* TOP FADE EFFECT */}
          <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-background to-transparent z-10 pointer-events-none" />
          
          <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar space-y-6">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                    <Sparkles className="w-10 h-10 text-primary/40 animate-pulse" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Welcome to DocuMind AI</h3>
                <p className="text-slate-400 max-w-sm">
                  Upload PDF documents on the right and ask questions about them. 
                  Our AI will analyze the content and provide accurate answers.
                </p>
                <div className="mt-8 flex gap-3">
                    <div className="px-4 py-2 bg-slate-800/50 rounded-lg text-xs border border-border">Summarize my notes</div>
                    <div className="px-4 py-2 bg-slate-800/50 rounded-lg text-xs border border-border">Find key insights</div>
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <motion.div
                  key={msg.timestamp || i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex flex-col max-w-[85%] md:max-w-[70%]",
                    msg.role === "user" ? "ml-auto items-end" : "items-start"
                  )}
                >
                  <div className={cn(
                    "flex items-center gap-2 mb-1.5",
                    msg.role === "user" ? "flex-row-reverse" : ""
                  )}>
                    <div className={cn(
                        "w-6 h-6 rounded-md flex items-center justify-center",
                        msg.role === "user" ? "bg-slate-700" : "bg-primary"
                    )}>
                        {msg.role === "user" ? <User className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        {msg.role === "user" ? "You" : "DocuMind"}
                    </span>
                  </div>

                  <div className={cn(
                    "px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-xl",
                    msg.role === "user" 
                      ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-tr-none" 
                      : "bg-slate-800 border border-slate-700/50 text-slate-200 rounded-tl-none"
                  )}>
                    {msg.content}
                    
                    {msg.role === "ai" && (
                        <div className="mt-4 pt-4 border-t border-slate-700/50 flex flex-col gap-2">
                             <div className="flex items-center justify-between">
                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1.5">
                                    <FileText className="w-3 h-3" /> Sources
                                </span>
                                <button className="text-[10px] text-primary hover:underline">View Citations</button>
                             </div>
                             <div className="flex gap-2">
                                <div className="w-2 h-2 rounded-full bg-accent/40" />
                                <div className="w-2 h-2 rounded-full bg-slate-700" />
                             </div>
                        </div>
                    )}
                  </div>
                </motion.div>
              ))
            )}

            {isTyping && (
              <div className="flex flex-col items-start space-y-2">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center text-white">
                        <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">DocuMind</span>
                </div>
                <div className="bg-slate-800 px-4 py-3 rounded-2xl rounded-tl-none border border-slate-700/50 flex items-center gap-1.5">
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="p-4 md:p-8 bg-gradient-to-t from-background via-background to-transparent pt-10">
            <form 
              onSubmit={handleSendMessage}
              className="max-w-4xl mx-auto flex items-end gap-3 glass-card p-2 pr-4 focus-within:ring-2 ring-primary/50 transition-all"
            >
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                    }
                }}
                placeholder="Ask me anything about your documents..."
                className="flex-1 bg-transparent border-none focus:ring-0 resize-none max-h-32 text-sm p-3 custom-scrollbar"
                rows={1}
              />
              <button 
                type="submit"
                disabled={!inputText.trim() || isTyping}
                className="w-10 h-10 rounded-xl bg-primary hover:bg-white text-white hover:text-primary transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed group shadow-lg"
              >
                {isTyping ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />}
              </button>
            </form>
            <p className="text-center text-[10px] text-slate-600 mt-4 font-medium uppercase tracking-[0.2em]">
              AI responses can be inaccurate. Always verify source documents.
            </p>
          </div>
        </section>

        {/* RIGHT PANEL - Documents */}
        <aside className={cn(
          "w-80 border-l border-border bg-slate-900/10 flex flex-col p-6 overflow-hidden",
          activeTab !== "docs" && "hidden md:flex",
          "fixed inset-y-16 right-0 z-20 md:relative md:inset-0"
        )}>
          <h2 className="text-sm font-bold mb-6 flex items-center gap-2">
            <FileText className="w-5 h-5 text-accent" />
            Knowledge Base
          </h2>

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            multiple 
            accept=".pdf" 
            className="hidden" 
          />

          <div 
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed border-slate-700/50 rounded-2xl p-6 flex flex-col items-center justify-center hover:border-accent hover:bg-accent/5 transition-all cursor-pointer group mb-8",
              isUploading && "pointer-events-none opacity-50"
            )}
          >
            <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Upload className="w-6 h-6 text-slate-400 group-hover:text-accent" />
            </div>
            <p className="text-sm font-bold text-center">Add PDF Files</p>
            <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Up to 10MB per file</p>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
            <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Uploaded Assets ({documents.length})
                </span>
            </div>

            <AnimatePresence>
                {documents.map((doc, i) => (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        key={i} 
                        className="p-3 bg-slate-800/40 border border-border rounded-xl group hover:border-slate-600 transition-all flex items-start gap-3"
                    >
                        <div className="w-8 h-8 shrink-0 bg-blue-500/10 rounded-lg flex items-center justify-center">
                            <FileText className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold truncate group-hover:text-white transition-colors">
                                {doc.filename}
                            </p>
                            <div className="flex items-center gap-2 mt-1.5">
                                {doc.status === "processing" ? (
                                    <div className="flex items-center gap-1.5">
                                        <Loader2 className="w-3 h-3 animate-spin text-primary" />
                                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Parsing...</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                                        <span className="text-[9px] text-accent font-bold uppercase tracking-widest leading-none">
                                            {doc.chunks} Chunks indexed
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <button 
                            onClick={() => handleDeleteDocument(doc.filename)}
                            className="text-slate-600 hover:text-red-400 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </motion.div>
                ))}
            </AnimatePresence>

            {documents.length === 0 && !isUploading && (
                <div className="flex flex-col items-center justify-center pt-8 text-center px-4">
                    <History className="w-8 h-8 text-slate-700 mb-4" />
                    <p className="text-xs text-slate-500 leading-relaxed font-medium">
                        Your indexed library is empty. Upload a PDF to start building your knowledge base.
                    </p>
                </div>
            )}
          </div>
        </aside>

        {/* OVERLAYS FOR MOBILE */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-10 md:hidden"
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
