import { useRef, useState, useCallback, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Play, Pause, Pencil, Minus, RotateCcw, Triangle, X, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/* ——— types ——— */
type DrawTool = "line" | "angle";
type DrawColor = "#FACC15" | "#EF4444" | "#22C55E";

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  tool: DrawTool;
  color: DrawColor;
  points: Point[];
}

interface TelestrationPlayerProps {
  url: string;
  title?: string;
  onClose?: () => void;
  onSave?: (data: { strokes: Stroke[]; timestamp: number }) => void;
}

const SPEED_OPTIONS = [0.25, 0.5, 1] as const;

const COLOR_MAP: { label: string; value: DrawColor }[] = [
  { label: "Yellow", value: "#FACC15" },
  { label: "Red", value: "#EF4444" },
  { label: "Green", value: "#22C55E" },
];

/* ——— helpers ——— */
function angleBetween(a: Point, vertex: Point, b: Point): number {
  const v1 = { x: a.x - vertex.x, y: a.y - vertex.y };
  const v2 = { x: b.x - vertex.x, y: b.y - vertex.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const cross = v1.x * v2.y - v1.y * v2.x;
  const rad = Math.atan2(Math.abs(cross), dot);
  return Math.round((rad * 180) / Math.PI);
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, scale: number) {
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = 3 * scale;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (stroke.tool === "line" && stroke.points.length > 1) {
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
  }

  if (stroke.tool === "angle" && stroke.points.length >= 2) {
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    ctx.lineTo(stroke.points[1].x, stroke.points[1].y);
    if (stroke.points.length === 3) {
      ctx.lineTo(stroke.points[2].x, stroke.points[2].y);
    }
    ctx.stroke();

    // Draw angle arc + label
    if (stroke.points.length === 3) {
      const deg = angleBetween(stroke.points[0], stroke.points[1], stroke.points[2]);
      ctx.fillStyle = stroke.color;
      ctx.font = `bold ${14 * scale}px Inter, sans-serif`;
      ctx.fillText(`${deg}°`, stroke.points[1].x + 10, stroke.points[1].y - 10);

      // small arc
      const r = 20 * scale;
      const a1 = Math.atan2(
        stroke.points[0].y - stroke.points[1].y,
        stroke.points[0].x - stroke.points[1].x,
      );
      const a2 = Math.atan2(
        stroke.points[2].y - stroke.points[1].y,
        stroke.points[2].x - stroke.points[1].x,
      );
      ctx.beginPath();
      ctx.arc(stroke.points[1].x, stroke.points[1].y, r, a1, a2);
      ctx.stroke();
    }
  }
}

/* ——— component ——— */
export function TelestrationPlayer({ url, title, onClose, onSave }: TelestrationPlayerProps) {
  const playerRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [playing, setPlaying] = useState(false);
  const [played, setPlayed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState<number>(1);

  // drawing state
  const [tool, setTool] = useState<DrawTool>("line");
  const [color, setColor] = useState<DrawColor>("#FACC15");
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [persistDrawings, setPersistDrawings] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);

  const canDraw = !playing;

  /* ——— canvas sizing ——— */
  const syncCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  }, []);

  useEffect(() => {
    syncCanvasSize();
    window.addEventListener("resize", syncCanvasSize);
    return () => window.removeEventListener("resize", syncCanvasSize);
  }, [syncCanvasSize]);

  /* ——— sync playbackRate ——— */
  useEffect(() => {
    const vid = playerRef.current;
    if (vid) vid.playbackRate = speed;
  }, [speed]);

  /* ——— repaint ——— */
  const repaint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const shouldShow = !playing || persistDrawings;
    if (!shouldShow) return;

    const scale = canvas.width / 640; // normalise to a 640px baseline
    strokes.forEach((s) => drawStroke(ctx, s, scale));
    if (currentStroke) drawStroke(ctx, currentStroke, scale);
  }, [strokes, currentStroke, playing, persistDrawings]);

  useEffect(() => {
    repaint();
  }, [repaint]);

  /* ——— pointer helpers ——— */
  const getCanvasPoint = (e: React.PointerEvent): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!canDraw) return;
    const pt = getCanvasPoint(e);

    if (tool === "angle") {
      // build up 3 points with successive clicks
      if (!currentStroke) {
        setCurrentStroke({ tool, color, points: [pt] });
      } else if (currentStroke.points.length === 1) {
        setCurrentStroke({ ...currentStroke, points: [...currentStroke.points, pt] });
      } else if (currentStroke.points.length === 2) {
        const finished = { ...currentStroke, points: [...currentStroke.points, pt] };
        setStrokes((prev) => [...prev, finished]);
        setCurrentStroke(null);
      }
      return;
    }

    // freeform line
    setIsDrawing(true);
    setCurrentStroke({ tool, color, points: [pt] });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDrawing || !currentStroke || tool !== "line") return;
    const pt = getCanvasPoint(e);
    setCurrentStroke((prev) => (prev ? { ...prev, points: [...prev.points, pt] } : null));
  };

  const onPointerUp = () => {
    if (!isDrawing || !currentStroke) {
      setIsDrawing(false);
      return;
    }
    setStrokes((prev) => [...prev, currentStroke]);
    setCurrentStroke(null);
    setIsDrawing(false);
  };

  /* ——— playback ——— */
  const handleSeek = (val: number[]) => {
    const v = val[0];
    setPlayed(v);
    const vid = playerRef.current;
    if (vid) vid.currentTime = v * (vid.duration || 0);
  };

  const cycleSpeed = () => {
    const idx = (SPEED_OPTIONS as readonly number[]).indexOf(speed);
    setSpeed(SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length]);
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-3">
      {/* header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg truncate">{title ?? "Video Telestration"}</h3>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* player + canvas */}
      <div
        ref={wrapperRef}
        className="relative w-full rounded-lg overflow-hidden bg-black"
        style={{ aspectRatio: "16/9" }}
      >
        {/* eslint-disable-next-line jsx-a11y/media-has-caption -- coach-uploaded
            training videos have no caption track available; a placeholder
            <track /> would be misleading. WCAG concession tracked as a
            follow-up in the coach audit M11/B-series. */}
        <video
          ref={playerRef}
          src={url}
          className="absolute inset-0 w-full h-full object-contain"
          onTimeUpdate={(e) => {
            const vid = e.currentTarget;
            if (vid.duration) setPlayed(vid.currentTime / vid.duration);
          }}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />

        {/* drawing canvas overlay */}
        <canvas
          ref={canvasRef}
          className={cn(
            "absolute inset-0 z-10",
            canDraw ? "cursor-crosshair" : "pointer-events-none",
          )}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />

        {/* paused badge */}
        {!playing && (
          <Badge
            variant="secondary"
            className="absolute top-3 left-3 z-20 bg-black/60 text-white border-none text-xs"
          >
            PAUSED — Draw on frame
          </Badge>
        )}
      </div>

      {/* playback controls */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            const vid = playerRef.current;
            if (!vid) return;
            if (vid.paused) vid.play();
            else vid.pause();
          }}
          className="shrink-0"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>

        <span className="text-xs text-muted-foreground tabular-nums w-20 shrink-0">
          {formatTime(played * duration)} / {formatTime(duration)}
        </span>

        <Slider
          value={[played]}
          max={1}
          step={0.001}
          onValueChange={handleSeek}
          className="flex-1"
        />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            cycleSpeed();
            const vid = playerRef.current;
            if (vid)
              vid.playbackRate =
                SPEED_OPTIONS[
                  ((SPEED_OPTIONS as readonly number[]).indexOf(speed) + 1) % SPEED_OPTIONS.length
                ];
          }}
          className="tabular-nums shrink-0"
        >
          {speed}x
        </Button>
      </div>

      {/* Save Analysis */}
      {strokes.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 w-full"
          onClick={() => {
            const data = { strokes, timestamp: played * duration };

            if (onSave) onSave(data);
            toast.success("Analysis Saved", {
              description: `${strokes.length} annotation(s) at ${formatTime(played * duration)}`,
            });
          }}
        >
          <Save className="h-3.5 w-3.5" />
          Save Analysis
        </Button>
      )}

      {/* drawing toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2">
        <span className="text-xs font-medium text-muted-foreground mr-1">Tools</span>

        <Button
          variant={tool === "line" ? "default" : "outline"}
          size="sm"
          onClick={() => setTool("line")}
          className="gap-1.5"
        >
          <Pencil className="h-3.5 w-3.5" />
          Line
        </Button>

        <Button
          variant={tool === "angle" ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setTool("angle");
            setCurrentStroke(null);
          }}
          className="gap-1.5"
        >
          <Triangle className="h-3.5 w-3.5" />
          Angle
        </Button>

        <div className="h-5 w-px bg-border mx-1" />

        {COLOR_MAP.map((c) => (
          <button
            key={c.value}
            onClick={() => setColor(c.value)}
            className={cn(
              "h-6 w-6 rounded-full border-2 transition-transform",
              color === c.value ? "scale-125 border-foreground" : "border-transparent",
            )}
            style={{ backgroundColor: c.value }}
            title={c.label}
          />
        ))}

        <div className="h-5 w-px bg-border mx-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setStrokes([]);
            setCurrentStroke(null);
          }}
          className="gap-1.5"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Clear
        </Button>

        <div className="h-5 w-px bg-border mx-1" />

        <div className="flex items-center gap-2">
          <Switch
            id="persist-drawings"
            checked={persistDrawings}
            onCheckedChange={setPersistDrawings}
          />
          <Label htmlFor="persist-drawings" className="text-xs cursor-pointer">
            Keep on play
          </Label>
        </div>
      </div>

      {tool === "angle" && currentStroke && (
        <p className="text-xs text-muted-foreground">
          Click {3 - currentStroke.points.length} more point
          {currentStroke.points.length < 2 ? "s" : ""} to complete the angle measurement.
        </p>
      )}
    </div>
  );
}
