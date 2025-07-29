// components/ChatWidget.tsx
"use client";

import { useState, useEffect, useRef } from 'react';
import { MessageSquare, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { ref, onValue, push, serverTimestamp } from 'firebase/database';
import { database, storage } from '@/lib/firebase';
import { ref as storageRef, getDownloadURL } from 'firebase/storage';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  text: string;
  username: string;
  timestamp: number;
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const { user } = useAuth();
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  
  const [unreadCount, setUnreadCount] = useState(0);
  const totalMessagesRef = useRef<number>(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const soundFileRef = storageRef(storage, 'notification.mp3'); 

    getDownloadURL(soundFileRef)
      .then((url) => {
        if (typeof window !== "undefined") {
          audioRef.current = new Audio(url);
          audioRef.current.volume = 0.5;
        }
      })
      .catch((error) => {
        console.error("Error al obtener la URL del sonido:", error);
      });
  }, []);

  useEffect(() => {
    const chatRef = ref(database, 'chat/messages');
    const unsubscribe = onValue(chatRef, (snapshot) => {
      const messagesData: Message[] = [];
      let newTotalMessages = 0;
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          messagesData.push({ id: child.key!, ...child.val() });
          newTotalMessages++;
        });
        messagesData.sort((a, b) => a.timestamp - b.timestamp);
        setMessages(messagesData);

        // --- LÓGICA DE NOTIFICACIÓN MODIFICADA ---
        
        if (isInitialLoad) {
          // En la carga inicial, solo establecemos el número total de mensajes para evitar notificaciones viejas
          totalMessagesRef.current = newTotalMessages;
          setIsInitialLoad(false);
          return; // Salimos para no ejecutar el resto de la lógica en la primera carga
        }

        // Si hay mensajes nuevos, procesamos las notificaciones
        if (user && totalMessagesRef.current < newTotalMessages) {
          const latestMessage = messagesData[messagesData.length - 1];

          // 1. Reproducir sonido SIEMPRE que el mensaje sea de OTRO usuario
          if (latestMessage && latestMessage.username !== user.username && audioRef.current) {
            audioRef.current.play().catch(error => {
              console.warn("La reproducción de audio fue prevenida por el navegador:", error);
            });
          }

          // 2. Actualizar el contador de no leídos SOLO si el chat está cerrado
          if (!isOpen) {
            const newMessagesCount = newTotalMessages - totalMessagesRef.current;
            setUnreadCount((prevCount) => prevCount + newMessagesCount);
          }
        }
        
        totalMessagesRef.current = newTotalMessages;

      } else {
        // Resetea todo si no hay mensajes
        setMessages([]);
        setUnreadCount(0);
        totalMessagesRef.current = 0;
      }
    });

    return () => unsubscribe();
  }, [isOpen, user, isInitialLoad]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setUnreadCount(0);
    }
  }, [messages, isOpen]);


  const handleSendMessage = () => {
    if (newMessage.trim() === '' || !user) return;

    const messagesRef = ref(database, 'chat/messages');
    const messageData = {
      text: newMessage,
      username: user.username,
      timestamp: serverTimestamp(),
    };

    push(messagesRef, messageData);
    setNewMessage('');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  if (!user) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isOpen ? (
        <Card className={cn("w-80 h-96 flex flex-col shadow-lg bg-background/90 backdrop-blur-sm border-border/50", isOpen && "border-gray-200")}>
          <CardHeader className="flex flex-row items-center justify-between p-4 border-b">
            <CardTitle className="text-lg">Chat Interno</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
           <ScrollArea className="flex-1">
            <CardContent className="p-4 space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.username === user.username ? 'items-end' : 'items-start'}`}>
                  <div className={`rounded-lg px-3 py-2 max-w-[90%] ${msg.username === user.username ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    <p className="text-xs font-semibold opacity-80">{msg.username.split('@')[0]}</p>
                    <p className="text-sm break-words">{msg.text}</p>
                  </div>
                </div>
              ))}
               <div ref={messagesEndRef} />
             </CardContent>
          </ScrollArea>
          <CardFooter className="p-2 border-t">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex w-full gap-2"
            >
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Escribe un mensaje..."
                autoComplete="off"
                onKeyDown={handleKeyDown}
              />
              <Button type="submit">Enviar</Button>
            </form>
          </CardFooter>
        </Card>
      ) : (
        <Button
          onClick={() => setIsOpen(true)}
          className="relative rounded-full w-16 h-16 shadow-lg"
        >
          <MessageSquare className="h-8 w-8" />
          {unreadCount > 0 && (
            <div className="absolute top-0 right-0 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </div>
          )}
        </Button>
      )}
    </div>
  );
}