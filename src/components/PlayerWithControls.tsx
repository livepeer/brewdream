"use client";

import { cn } from "@/lib/utils";
import {
  EnterFullscreenIcon, ExitFullscreenIcon, LoadingIcon,
  MuteIcon,
  PauseIcon, PlayIcon,
  UnmuteIcon,
} from "@livepeer/react/assets";
import * as Player from "@livepeer/react/player";
import React from "react";
import { Src } from "@livepeer/react";


export function PlayerWithControls(props: { src: Src[] | null }) {
    if (!props.src) {
      return (
        <PlayerLoading
          title="Invalid source"
          description="We could not fetch valid playback information for the playback ID you provided. Please check and try again."
        />  
      );
    }
  
    return (
      <Player.Root src={props.src}
        autoPlay={true}
        volume={0}
        lowLatency="force"
        backoffMax={1000}
        aspectRatio={null}
        storage={null}
        ingestPlayback={true}
        
      >
        <Player.Container className="group  h-full w-full overflow-hidden bg-black outline-none transition">
          <Player.Video
            title="Clip playback"
            loop
            muted
            playsInline
            className={cn("h-full w-full transition")}
          />
  
          <Player.LoadingIndicator className="w-full relative h-full bg-black/50 backdrop-blur data-[visible=true]:animate-in data-[visible=false]:animate-out data-[visible=false]:fade-out-0 data-[visible=true]:fade-in-0">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <LoadingIcon className="w-8 h-8 animate-spin" />
            </div>
            <PlayerLoading />
          </Player.LoadingIndicator>
  
          <Player.ErrorIndicator
            matcher="all"
            className="absolute select-none inset-0 text-center bg-black/40 backdrop-blur-lg flex flex-col items-center justify-center gap-4 duration-1000 data-[visible=true]:animate-in data-[visible=false]:animate-out data-[visible=false]:fade-out-0 data-[visible=true]:fade-in-0"
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <LoadingIcon className="w-8 h-8 animate-spin" />
            </div>
            <PlayerLoading />
          </Player.ErrorIndicator>
  
          <Player.ErrorIndicator
            matcher="offline"
            className="absolute select-none animate-in fade-in-0 inset-0 text-center bg-black/40 backdrop-blur-lg flex flex-col items-center justify-center gap-4 duration-1000 data-[visible=true]:animate-in data-[visible=false]:animate-out data-[visible=false]:fade-out-0 data-[visible=true]:fade-in-0"
          >
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1">
                <div className="text-lg sm:text-2xl font-bold">
                  Stream is offline
                </div>
                <div className="text-xs sm:text-sm text-gray-100">
                  Playback will start automatically once the stream has started
                </div>
              </div>
              <LoadingIcon className="w-6 h-6 md:w-8 md:h-8 mx-auto animate-spin" />
            </div>
          </Player.ErrorIndicator>
  
          <Player.ErrorIndicator
            matcher="access-control"
            className="absolute select-none inset-0 text-center bg-black/40 backdrop-blur-lg flex flex-col items-center justify-center gap-4 duration-1000 data-[visible=true]:animate-in data-[visible=false]:animate-out data-[visible=false]:fade-out-0 data-[visible=true]:fade-in-0"
          >
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1">
                <div className="text-lg sm:text-2xl font-bold">
                  Stream is private
                </div>
                <div className="text-xs sm:text-sm text-gray-100">
                  It looks like you don't have permission to view this content
                </div>
              </div>
              <LoadingIcon className="w-6 h-6 md:w-8 md:h-8 mx-auto animate-spin" />
            </div>
          </Player.ErrorIndicator>
  
          <Player.Controls     
           className={cn(
                "opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto",
                "bg-gradient-to-b gap-1 px-3 md:px-3 py-2 flex-col-reverse flex from-black/5 via-80% via-black/30 to-black/60 transition-opacity duration-300"
            )}>
            <div className="flex justify-between gap-4">
              <div className="flex flex-1 items-center gap-3">
                <Player.PlayPauseTrigger className="w-6 h-6 hover:scale-110 transition flex-shrink-0">
                  <Player.PlayingIndicator asChild matcher={false}>
                    <PlayIcon className="w-full h-full" />
                  </Player.PlayingIndicator>
                  <Player.PlayingIndicator asChild>
                    <PauseIcon className="w-full h-full" />
                  </Player.PlayingIndicator>
                </Player.PlayPauseTrigger>
  
                <Player.LiveIndicator className="gap-2 flex items-center">
                  <div className="bg-red-600 h-1.5 w-1.5 rounded-full" />
                  <span className="text-sm select-none">LIVE</span>
                </Player.LiveIndicator>
                <Player.LiveIndicator
                  matcher={false}
                  className="flex gap-2 items-center"
                >
                  <Player.Time className="text-sm tabular-nums select-none" />
                </Player.LiveIndicator>
  
                <Player.MuteTrigger className="w-6 h-6 hover:scale-110 transition flex-shrink-0">
                  <Player.VolumeIndicator asChild matcher={false}>
                    <MuteIcon className="w-full h-full" />
                  </Player.VolumeIndicator>
                  <Player.VolumeIndicator asChild matcher={true}>
                    <UnmuteIcon className="w-full h-full" />
                  </Player.VolumeIndicator>
                </Player.MuteTrigger>
                <Player.Volume className="relative mr-1 flex-1 group flex cursor-pointer items-center select-none touch-none max-w-[120px] h-5">
                  <Player.Track className="bg-white/30 relative grow rounded-full transition h-[2px] md:h-[3px] group-hover:h-[3px] group-hover:md:h-[4px]">
                    <Player.Range className="absolute bg-white rounded-full h-full" />
                  </Player.Track>
                  <Player.Thumb className="block transition group-hover:scale-110 w-3 h-3 bg-white rounded-full" />
                </Player.Volume>
              </div>
              <div className="flex sm:flex-1 md:flex-[1.5] justify-end items-center gap-2.5">
                <Player.FullscreenTrigger className="w-6 h-6 hover:scale-110 transition flex-shrink-0">
                  <Player.FullscreenIndicator asChild>
                    <ExitFullscreenIcon className="w-full h-full" />
                  </Player.FullscreenIndicator>
  
                  <Player.FullscreenIndicator matcher={false} asChild>
                    <EnterFullscreenIcon className="w-full h-full" />
                  </Player.FullscreenIndicator>
                </Player.FullscreenTrigger>
              </div>
            </div>
            <Player.Seek className="relative group flex cursor-pointer items-center select-none touch-none w-full h-5">
              <Player.Track className="bg-white/30 relative grow rounded-full transition h-[2px] md:h-[3px] group-hover:h-[3px] group-hover:md:h-[4px]">
                <Player.SeekBuffer className="absolute bg-black/30 transition duration-1000 rounded-full h-full" />
                <Player.Range className="absolute bg-white rounded-full h-full" />
              </Player.Track>
              <Player.Thumb className="block group-hover:scale-110 w-3 h-3 bg-white transition rounded-full" />
            </Player.Seek>
          </Player.Controls>
        </Player.Container>
      </Player.Root>
    );
  }
  
 
export const PlayerLoading = ({
  title,
  description,
}: { title?: React.ReactNode; description?: React.ReactNode }) => (
  <div className="relative w-full h-full px-3 py-2 gap-3 flex-col-reverse flex aspect-video bg-white/10 overflow-hidden rounded-sm">
    <div className="flex justify-between">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 animate-pulse bg-white/5 overflow-hidden rounded-lg" />
        <div className="w-16 h-6 md:w-20 md:h-7 animate-pulse bg-white/5 overflow-hidden rounded-lg" />
      </div>
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 animate-pulse bg-white/5 overflow-hidden rounded-lg" />
        <div className="w-6 h-6 animate-pulse bg-white/5 overflow-hidden rounded-lg" />
      </div>
    </div>
    <div className="w-full h-2 animate-pulse bg-white/5 overflow-hidden rounded-lg" />
    {title && (
      <div className="absolute flex flex-col gap-1 inset-10 text-center justify-center items-center">
        <span className="text-white text-lg font-medium">{title}</span>
        {description && <span className="text-sm text-white/80">{description}</span>}
      </div>
    )}
  </div>
);

