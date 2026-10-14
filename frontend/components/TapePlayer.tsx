"use client";
import { useEffect, useRef, useState } from "react";

export default function TapePlayer({
  title = "A CV that gets shortlisted",
  sub = "Track 1 · free preview, 2 minutes",
  src = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
}: {
  title?: string;
  sub?: string;
  src?: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setT(a.currentTime);
    const onMeta = () => setDur(a.duration || 0);
    const onEnd = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd);
    };
  }, []);

  const toggle = async () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      await a.play();
      setPlaying(true);
    }
  };

  const fmt = (s: number) => {
    if (!isFinite(s) || s < 0) return "0:00";
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return `${m}:${String(r).padStart(2, "0")}`;
  };

  return (
    <div className={`tape ${playing ? "playing" : ""}`}>
      <div className="tape-top">
        <span className="tape-side">Track 1</span>
        <span className="tape-dots" aria-hidden="true">
          <i className="on" /><i /><i />
        </span>
      </div>
      <div className="tape-window" aria-hidden="true">
        <div className="reel"><span /></div>
        <div className="tape-line" />
        <div className="reel"><span /></div>
      </div>
      <p className="tape-title">{title}</p>
      <p className="tape-sub">{sub}</p>
      <div className="tape-controls">
        <button className="play-btn" onClick={toggle} aria-label={playing ? "Pause preview" : "Play preview"}>
          {playing ? "❚❚" : "▶"}
        </button>
        <div className="tape-progress">
          <input
            type="range"
            min={0}
            max={dur || 100}
            value={t}
            onChange={(e) => {
              const a = audioRef.current;
              if (!a) return;
              a.currentTime = Number(e.target.value);
              setT(a.currentTime);
            }}
            aria-label="Seek preview"
          />
          <div className="tape-time">
            <span>{fmt(t)}</span>
            <span>{fmt(dur)}</span>
          </div>
        </div>
      </div>
      <audio ref={audioRef} src={src} preload="metadata" />
      <div className="tape-foot">
        <span>Press play. No account needed.</span>
        <span>Full book: 3 hrs 26 min</span>
      </div>
    </div>
  );
}
