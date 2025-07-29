// components/ChatWidget.tsx
"use client";

import { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Mic, Send, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { ref, onValue, push, serverTimestamp } from 'firebase/database';
import { database, storage } from '@/lib/firebase';
import { ref as storageRef, getDownloadURL, uploadBytes } from 'firebase/storage';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import AudioVisualizer from './AudioVisualizer';
import { toast } from 'sonner';
import CustomAudioPlayer from './CustomAudioPlayer'; // <-- IMPORTACIÓN NUEVA

interface Message {
  id: string;
  text?: string;
  audioUrl?: string;
  type: 'text' | 'audio';
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

  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const soundFileRef = storageRef(storage, 'notification.mp3'); 
    getDownloadURL(soundFileRef).then((url) => {
      if (typeof window !== "undefined") {
        audioRef.current = new Audio(url);
        audioRef.current.volume = 0.5;
      }
    }).catch((error) => console.error("Error al obtener la URL del sonido:", error));
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

        if (isInitialLoad) {
          totalMessagesRef.current = newTotalMessages;
          setIsInitialLoad(false);
          return;
        }

        if (user && totalMessagesRef.current < newTotalMessages) {
          const latestMessage = messagesData[messagesData.length - 1];
          if (latestMessage && latestMessage.username !== user.username && audioRef.current) {
            audioRef.current.play().catch(error => console.warn("La reproducción de audio fue prevenida por el navegador:", error));
          }
          if (!isOpen) {
            const newMessagesCount = newTotalMessages - totalMessagesRef.current;
            setUnreadCount((prevCount) => prevCount + newMessagesCount);
          }
        }
        totalMessagesRef.current = newTotalMessages;
      } else {
        setMessages([]); setUnreadCount(0); totalMessagesRef.current = 0;
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
    push(messagesRef, {
      type: 'text',
      text: newMessage,
      username: user.username,
      timestamp: serverTimestamp(),
    });
    setNewMessage('');
  };
  
  const handleToggleRecording = async () => {
    if (isRecording) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMediaStream(stream);
      setIsRecording(true);
      
      const options = { mimeType: 'audio/webm;codecs=opus' };
      let mediaRecorder: MediaRecorder;
      try { mediaRecorder = new MediaRecorder(stream, options); }
      catch (err) {
        console.warn('Fallback to default mimeType:', err);
        mediaRecorder = new MediaRecorder(stream);
      }
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      });
      mediaRecorder.addEventListener("stop", handleUploadAudio);
      mediaRecorder.start();
      toast.info("Grabando audio...");

    } catch (error) {
      console.error("Error al acceder al micrófono:", error);
      toast.error("Error de micrófono", {
        description: "No se pudo acceder al micrófono. Por favor, revisa los permisos.",
      });
    }
  };
  
  const handleUploadAudio = async () => {
    if (!user) return;
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    const audioId = `audio_${Date.now()}.webm`;
    const audioStorageRef = storageRef(storage, `chat-audio/${audioId}`);

    try {
      const snapshot = await uploadBytes(audioStorageRef, audioBlob);
      const audioUrl = await getDownloadURL(snapshot.ref);
      const messagesRef = ref(database, 'chat/messages');
      push(messagesRef, {
        type: 'audio',
        audioUrl: audioUrl,
        username: user.username,
        timestamp: serverTimestamp(),
      });
      toast.success("Audio enviado.");
    } catch (error) {
      console.error("Error al subir el audio:", error);
      toast.error("Error al enviar el audio.");
    } finally {
      setIsUploading(false);
      setIsRecording(false);
      mediaStream?.getTracks().forEach(track => track.stop());
      setMediaStream(null);
      audioChunksRef.current = [];
    }
  };

  const handleCancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.removeEventListener("stop", handleUploadAudio);
      mediaRecorderRef.current.stop();
    }
    mediaStream?.getTracks().forEach(track => track.stop());
    setMediaStream(null);
    setIsRecording(false);
    audioChunksRef.current = [];
  };

  const handleSendAudio = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      setIsUploading(true);
      mediaRecorderRef.current.stop();
    }
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
        <Card className={cn("w-80 h-96 flex flex-col shadow-lg bg-black/80 backdrop-blur-sm border-border/50")}>
          <CardHeader className="flex flex-row items-center justify-between p-4 border-b">
            <CardTitle className="text-lg">Chat Interno</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => { setIsOpen(false); handleCancelRecording(); }}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
           <ScrollArea className="flex-1">
            <CardContent className="p-4 space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.username === user.username ? 'items-end' : 'items-start'}`}>
                  <div className={`rounded-lg px-3 py-2 max-w-[90%] ${msg.username === user.username ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    <p className="text-xs font-semibold opacity-80">{msg.username.split('@')[0]}</p>
                    {msg.type === 'text' && msg.text ? (
                      <p className="text-sm break-words">{msg.text}</p>
                    ) : msg.type === 'audio' && msg.audioUrl ? (
                      // --- CAMBIO PRINCIPAL AQUÍ ---
                      // Usamos el nuevo componente en lugar del tag <audio>
                      <CustomAudioPlayer key={msg.id} src={msg.audioUrl} />
                    ) : null}
                  </div>
                </div>
              ))}
               <div ref={messagesEndRef} />
             </CardContent>
          </ScrollArea>
          <CardFooter className="p-2 border-t">
            {isRecording ? (
              <div className="w-full flex items-center gap-2">
                <Button variant="destructive" size="icon" onClick={handleCancelRecording} disabled={isUploading}>
                  <Trash2 className="h-4 w-4" />
                </Button>
                <div className="flex-grow w-0 min-w-0 flex items-center justify-center">
                  {isUploading ? (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : (
                      <AudioVisualizer mediaStream={mediaStream} />
                  )}
                </div>
                <Button size="icon" onClick={handleSendAudio} disabled={isUploading}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex w-full gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Escribe un mensaje..."
                  autoComplete="off"
                  onKeyDown={handleKeyDown}
                />
                <Button type="button" size="icon" variant="secondary" onClick={handleToggleRecording}><Mic className="h-4 w-4" /></Button>
                <Button type="submit" onClick={handleSendMessage}>Enviar</Button>
              </div>
            )}
          </CardFooter>
        </Card>
      ) : (
        <Button onClick={() => setIsOpen(true)} className="relative rounded-full w-16 h-16 shadow-lg">
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