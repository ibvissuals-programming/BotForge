import React, { useState, useEffect, useRef } from "react";
import { Send, Settings, Circle, Play, Loader2, ArrowRight } from "lucide-react";
import { useSendChatMessage, type BotConfig, type ChatMessage } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

const BIZ_EMOJIS: Record<string, string> = {
  "wig": "💇‍♀️",
  "fashion": "👗",
  "food": "🍽️",
  "beauty": "✨",
  "photography": "📸",
  "other": "💼"
};

const QUICK_REPLIES: Record<string, string[]> = {
  "wig": ["What are your prices?", "How do I book?", "Do you do installs?", "Where are you located?"],
  "fashion": ["See collections", "Pricing info", "Do you do custom?", "Delivery options"],
  "food": ["See menu", "Do you deliver?", "How to order?", "Pricing"],
  "beauty": ["Services & prices", "Book appointment", "Products available", "Location"],
  "photography": ["Packages & prices", "Book a shoot", "Turnaround time", "Location"],
  "other": ["What do you offer?", "Pricing info", "How to order?", "Contact details"]
};

export default function ChatPage() {
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const sendMessageMutation = useSendChatMessage();

  useEffect(() => {
    const savedConfig = localStorage.getItem("botConfig");
    if (savedConfig) {
      setConfig(JSON.parse(savedConfig));
    } else {
      setIsConfigOpen(true);
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sendMessageMutation.isPending]);

  const handleSaveConfig = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newConfig: BotConfig = {
      bizName: formData.get("bizName") as string,
      bizType: formData.get("bizType") as string,
      services: formData.get("services") as string,
      location: formData.get("location") as string,
      howToOrder: formData.get("howToOrder") as string,
      personality: formData.get("personality") as string,
      welcomeMsg: formData.get("welcomeMsg") as string,
    };
    setConfig(newConfig);
    localStorage.setItem("botConfig", JSON.stringify(newConfig));
    setIsConfigOpen(false);
    setMessages([]);
  };

  const handleSend = (text: string = input) => {
    if (!text.trim() || !config) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");

    sendMessageMutation.mutate({
      data: {
        messages: newMessages,
        config: config
      }
    }, {
      onSuccess: (data) => {
        setMessages([...newMessages, { role: "assistant", content: data.content }]);
      },
      onError: () => {
        setMessages([...newMessages, { role: "assistant", content: "Sorry, I had trouble connecting. Please try again." }]);
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!config && !isConfigOpen) return <div className="min-h-screen bg-background text-foreground flex items-center justify-center">Loading...</div>;

  return (
    <div className="flex justify-center bg-black min-h-screen dark">
      <div className="w-full max-w-[480px] h-[100dvh] flex flex-col bg-background relative shadow-2xl overflow-hidden border-x border-border">
        {/* Header */}
        {config && (
          <header className="flex-none h-16 border-b border-border flex items-center justify-between px-4 z-10 bg-background/95 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-syne font-bold text-lg">
                {config.bizName.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="font-syne font-bold text-[17px] leading-tight text-foreground">{config.bizName}</h1>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  Always online
                </div>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsConfigOpen(true)} className="text-muted-foreground hover:text-foreground rounded-full" data-testid="button-settings">
              <Settings className="w-5 h-5" />
            </Button>
          </header>
        )}

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 custom-scrollbar pb-24">
          {config && messages.length === 0 && (
            <div className="mt-8 flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="w-16 h-16 rounded-full bg-card border border-border flex items-center justify-center text-3xl mb-4 shadow-sm">
                {BIZ_EMOJIS[config.bizType || "other"] || BIZ_EMOJIS["other"]}
              </div>
              <h2 className="font-syne text-xl font-bold mb-2 text-foreground text-center">{config.bizName}</h2>
              <p className="text-muted-foreground text-center mb-6 max-w-[280px] text-sm">
                {config.welcomeMsg || "Hi there! How can I help you today?"}
              </p>
              
              <div className="w-full flex flex-col gap-2">
                {(QUICK_REPLIES[config.bizType || "other"] || QUICK_REPLIES["other"]).map((reply, i) => (
                  <Button 
                    key={i} 
                    variant="outline" 
                    className="w-full justify-start h-auto py-3 px-4 text-left border-border bg-card hover:bg-muted hover:border-primary/50 transition-colors"
                    onClick={() => handleSend(reply)}
                    data-testid={`button-quick-reply-${i}`}
                  >
                    {reply}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
              <div 
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed shadow-sm ${
                  msg.role === "user" 
                    ? "bg-primary text-primary-foreground rounded-br-sm" 
                    : "bg-card text-card-foreground border border-border rounded-bl-sm"
                }`}
              >
                {msg.content}
              </div>
              <span className="text-[10px] text-muted-foreground mt-1.5 px-1 font-medium opacity-70">
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}

          {sendMessageMutation.isPending && (
            <div className="flex flex-col items-start animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="max-w-[85%] rounded-2xl px-4 py-3.5 bg-card border border-border rounded-bl-sm flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        {config && (
          <div className="flex-none p-3 border-t border-border bg-background absolute bottom-0 left-0 right-0 z-10">
            <div className="flex items-end gap-2 bg-card border border-border rounded-[24px] p-1.5 pr-2 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                className="min-h-[40px] max-h-[100px] bg-transparent border-0 focus-visible:ring-0 resize-none py-2.5 px-3 text-[15px] scrollbar-hide"
                disabled={sendMessageMutation.isPending}
                rows={1}
                data-testid="input-message"
              />
              <Button
                size="icon"
                className="w-9 h-9 rounded-full shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                onClick={() => handleSend()}
                disabled={!input.trim() || sendMessageMutation.isPending}
                data-testid="button-send"
              >
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        <Sheet open={isConfigOpen} onOpenChange={setIsConfigOpen}>
          <SheetContent side="bottom" className="h-[90dvh] bg-background border-t border-border rounded-t-2xl sm:max-w-[480px] mx-auto p-0">
            <ScrollArea className="h-full">
              <div className="p-6">
                <SheetHeader className="mb-6 text-left">
                  <SheetTitle className="font-syne text-2xl font-bold">Bot Configuration</SheetTitle>
                  <SheetDescription>
                    Set up your business profile to customize the AI responses.
                  </SheetDescription>
                </SheetHeader>
                
                <form onSubmit={handleSaveConfig} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="bizName">Business Name *</Label>
                    <Input id="bizName" name="bizName" defaultValue={config?.bizName || ""} required placeholder="e.g. Bella's Boutique" className="bg-card border-border" />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="bizType">Business Type *</Label>
                    <Select name="bizType" defaultValue={config?.bizType || "other"}>
                      <SelectTrigger className="bg-card border-border">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="wig">Wig / Hair</SelectItem>
                        <SelectItem value="fashion">Fashion / Clothing</SelectItem>
                        <SelectItem value="food">Food / Catering</SelectItem>
                        <SelectItem value="beauty">Beauty / Skincare</SelectItem>
                        <SelectItem value="photography">Photography</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="services">Services & Prices</Label>
                    <Textarea 
                      id="services" 
                      name="services" 
                      defaultValue={config?.services || ""} 
                      placeholder="e.g. Frontal Install: $120, Box Braids: $150..." 
                      className="bg-card border-border min-h-[80px]" 
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location">Location & Availability</Label>
                    <Input id="location" name="location" defaultValue={config?.location || ""} placeholder="e.g. Atlanta GA, Mon-Sat 9am-6pm" className="bg-card border-border" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="howToOrder">How to Order / Book</Label>
                    <Input id="howToOrder" name="howToOrder" defaultValue={config?.howToOrder || ""} placeholder="e.g. Link in bio to book via Acuity" className="bg-card border-border" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="personality">Bot Personality (Optional)</Label>
                    <Input id="personality" name="personality" defaultValue={config?.personality || ""} placeholder="e.g. Friendly, professional, use heart emojis" className="bg-card border-border" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="welcomeMsg">Welcome Message</Label>
                    <Textarea 
                      id="welcomeMsg" 
                      name="welcomeMsg" 
                      defaultValue={config?.welcomeMsg || ""} 
                      placeholder="e.g. Hey babe! Welcome to Bella's Boutique. How can I assist?" 
                      className="bg-card border-border min-h-[60px]" 
                    />
                  </div>

                  <Button type="submit" className="w-full h-12 text-base font-bold font-syne rounded-xl mt-6">
                    Launch Chatbot <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </form>
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: hsl(var(--border));
          border-radius: 4px;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
