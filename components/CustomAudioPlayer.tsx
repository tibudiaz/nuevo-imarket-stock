// components/CustomAudioPlayer.tsx
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

interface CustomAudioPlayerProps {
  src: string;
}

const CustomAudioPlayer: React.FC<CustomAudioPlayerProps> = ({ src }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const animationFrameRef = useRef<number>();

  const playbackRates = [1, 1.5, 2];

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const setAudioData = () => {
      setDuration(audio.duration);
      setCurrentTime(audio.currentTime);
    };

    const handleTimeUpdate = () => {
        // Usamos requestAnimationFrame para una actualización más suave
    };
    
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('loadedmetadata', setAudioData);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', setAudioData);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      if(animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      if(animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    } else {
      audio.play().then(() => {
        setIsPlaying(true);
        animateProgress();
      });
    }
  };

  const animateProgress = () => {
    const audio = audioRef.current;
    if (audio) {
      setCurrentTime(audio.currentTime);
      animationFrameRef.current = requestAnimationFrame(animateProgress);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const progressBar = e.currentTarget;
    const clickPosition = e.clientX - progressBar.getBoundingClientRect().left;
    const newTime = (clickPosition / progressBar.offsetWidth) * duration;
    
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };
  
  const togglePlaybackRate = () => {
    const audio = audioRef.current;
    if (!audio) return;

    const currentIndex = playbackRates.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % playbackRates.length;
    const newRate = playbackRates[nextIndex];
    
    setPlaybackRate(newRate);
    audio.playbackRate = newRate;
  };


  const formatTime = (time: number) => {
    if (isNaN(time) || time === 0) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-2 w-full max-w-[200px]">
      <audio ref={audioRef} src={src} preload="metadata" />
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={togglePlayPause}>
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <div className="flex-grow flex items-center gap-2">
        <div 
          className="w-full h-1.5 bg-muted-foreground/30 rounded-full cursor-pointer relative"
          onClick={handleProgressClick}
        >
          <div 
            className="h-1.5 bg-primary rounded-full"
            style={{ width: `${progress}%` }}
          />
          <div 
            className="absolute top-1/2 -translate-y-1/2 h-3 w-3 bg-primary rounded-full"
            style={{ left: `calc(${progress}% - 6px)` }}
          />
        </div>
        <Button variant="outline" className="h-6 px-1.5 text-xs" onClick={togglePlaybackRate}>
            {playbackRate}x
        </Button>
      </div>
    </div>
  );
};

export default CustomAudioPlayer;