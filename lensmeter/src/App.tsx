import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Info,
  Crosshair,
  HelpCircle,
  PlusCircle,
  XCircle,
  User,
  GraduationCap,
  Settings,
  PlayCircle,
} from "lucide-react";

// Custom Infinite Spring Slider for Wheels
const SpringSlider = ({ value, onChange, label, sensitivity = 40 }) => {
  const trackRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [offset, setOffset] = useState(0);
  const accumulator = useRef(0);
  const requestRef = useRef(null);

  const handlePointerDown = (e) => {
    setIsDragging(true);
    trackRef.current.setPointerCapture(e.pointerId);
    accumulator.current = 0;
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const rect = trackRef.current.getBoundingClientRect();
    const center = rect.width / 2;
    const x = e.clientX - rect.left;
    const maxOffset = rect.width / 2 - 16;
    let newOffset = x - center;
    newOffset = Math.max(-maxOffset, Math.min(maxOffset, newOffset));
    setOffset(newOffset);
  };

  const handlePointerUp = (e) => {
    setIsDragging(false);
    setOffset(0);
    if (trackRef.current) trackRef.current.releasePointerCapture(e.pointerId);
  };

  useEffect(() => {
    if (isDragging && offset !== 0) {
      const tick = () => {
        const speed = offset / sensitivity;
        accumulator.current += speed;
        if (Math.abs(accumulator.current) >= 1) {
          const step = Math.trunc(accumulator.current);
          accumulator.current -= step;
          onChange(step);
        }
        requestRef.current = requestAnimationFrame(tick);
      };
      requestRef.current = requestAnimationFrame(tick);
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [isDragging, offset, onChange, sensitivity]);

  return (
    <div
      ref={trackRef}
      className="relative w-full h-10 bg-slate-200 rounded-lg cursor-ew-resize select-none overflow-hidden shadow-inner border border-slate-300"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ touchAction: "none" }}
      title={`Drag to spin ${label}`}
    >
      <div className="absolute inset-0 flex justify-between items-center px-4 opacity-40 pointer-events-none">
        {[...Array(15)].map((_, i) => (
          <div key={i} className="w-0.5 h-4 bg-slate-600" />
        ))}
      </div>
      <div
        className="absolute top-1/2 w-8 h-12 bg-blue-600 rounded-md shadow-[0_0_10px_rgba(0,0,0,0.3)] transform -translate-y-1/2 flex items-center justify-center transition-transform duration-75 border border-blue-800"
        style={{
          left: `calc(50% + ${offset}px)`,
          transform: `translate(-50%, -50%)`,
        }}
      >
        <div className="w-1 h-5 bg-white opacity-60 rounded-full" />
      </div>
    </div>
  );
};

// Helper component for one row in the results comparison table
const ResultRow = ({ label, actual, student, match }) => (
  <tr>
    <td className="py-2 pr-3 font-medium text-slate-600 text-sm whitespace-nowrap">
      {label}
    </td>
    <td className="py-2 px-3 text-center font-mono font-bold text-slate-800 text-sm">
      {actual}
    </td>
    <td
      className={`py-2 px-3 text-center font-mono text-sm ${
        match === true
          ? "text-emerald-700"
          : match === false
          ? "text-red-600"
          : "text-slate-400"
      }`}
    >
      {student || "-"}
    </td>
    <td className="py-2 pl-2 text-center">
      {match === true ? (
        <span className="text-emerald-600 font-bold text-base">✓</span>
      ) : match === false ? (
        <span className="text-red-500 font-bold text-base">✗</span>
      ) : (
        <span className="text-slate-300 text-base">-</span>
      )}
    </td>
  </tr>
);

const App = () => {
  // Ensure Tailwind CSS is loaded
  useEffect(() => {
    if (!document.getElementById("tailwind-cdn")) {
      const script = document.createElement("script");
      script.id = "tailwind-cdn";
      script.src = "https://cdn.tailwindcss.com";
      document.head.appendChild(script);
    }
  }, []);

  const canvasRef = useRef(null);

  // App State: "setup" | "running" | "completed"
  const [appState, setAppState] = useState("setup");

  // Student Session State
  const [sessionInfo, setSessionInfo] = useState({
    name: "",
    section: "",
    mode: "practice", // "practice" or "quiz"
    totalLenses: 5,
  });

  const [currentLensIndex, setCurrentLensIndex] = useState(1);
  const [quizScore, setQuizScore] = useState(0);
  const [hasCheckedCurrent, setHasCheckedCurrent] = useState(false);

  // Practice Settings State
  const [practiceOptions, setPracticeOptions] = useState({
    type: "sphere",
    prism: "none",
    prismDirection: "cardinal",
  });

  // Instrument Settings State
  const [powerStep, setPowerStep] = useState(0.25);
  const [backgroundDarkness, setBackgroundDarkness] = useState(5);
  const [wheelSpeed, setWheelSpeed] = useState(5);
  const [illumination, setIllumination] = useState(6);
  const [mireColor, setMireColor] = useState("green");

  // Simulation State
  const [lensInserted, setLensInserted] = useState(false);
  const [actualRx, setActualRx] = useState({
    sphere: 0,
    cylinder: 0,
    axis: 0,
    prism: 0,
    prismBase: 0,
    eye: "OD",
  });
  const [userDial, setUserDial] = useState({
    power: 0.0,
    axis: 0,
    reticle: 0,
  });

  // Target State
  const [targetType, setTargetType] = useState("crossline");

  // Assessment State
  const [studentInput, setStudentInput] = useState({
    sphere: "",
    cylinder: "",
    axis: "",
    prism: "",
    prismBaseDir: "",
    prismMeridian: "",
  });
  const [feedback, setFeedback] = useState(null);
  const [showInstructions, setShowInstructions] = useState(false);

  // Per-session results accumulator + lightweight per-lens tracking refs
  const [lensResults, setLensResults] = useState([]);
  const firstAttemptRef = useRef(null); // "correct" | "incorrect" | null
  const revealedRef = useRef(false);

  // Constants
  const CANVAS_SIZE = 500;
  const CENTER = CANVAS_SIZE / 2;
  const PRISM_SCALE = 35;

  const getPrismDirections = (deg, eye) => {
    let base = "";
    if (eye === "OD") {
      switch (deg) {
        case 0:
          base = "Base IN";
          break;
        case 45:
          base = "Base IN & UP";
          break;
        case 90:
          base = "Base UP";
          break;
        case 135:
          base = "Base OUT & UP";
          break;
        case 180:
          base = "Base OUT";
          break;
        case 225:
          base = "Base OUT & DOWN";
          break;
        case 270:
          base = "Base DOWN";
          break;
        case 315:
          base = "Base IN & DOWN";
          break;
        default:
          base = "";
      }
    } else {
      switch (deg) {
        case 0:
          base = "Base OUT";
          break;
        case 45:
          base = "Base OUT & UP";
          break;
        case 90:
          base = "Base UP";
          break;
        case 135:
          base = "Base IN & UP";
          break;
        case 180:
          base = "Base IN";
          break;
        case 225:
          base = "Base IN & DOWN";
          break;
        case 270:
          base = "Base DOWN";
          break;
        case 315:
          base = "Base OUT & DOWN";
          break;
        default:
          base = "";
      }
    }
    return { base };
  };

  const generateRandomRx = useCallback(() => {
    const maxSteps = 40;
    const sphere =
      (Math.floor(Math.random() * (maxSteps * 2 + 1)) - maxSteps) * powerStep;
    let cylinder = 0;
    let axis = 0;

    if (practiceOptions.type === "spherocylinder") {
      cylinder = (Math.floor(Math.random() * 16) + 1) * -powerStep;
      axis = Math.floor(Math.random() * 180);
    }

    let prism = 0;
    let prismBase = 0;
    if (practiceOptions.prism === "prism") {
      prism = Math.floor(Math.random() * 8 + 1) * 0.5;
      if (practiceOptions.prismDirection === "cardinal") {
        const cardinalAngles = [0, 90, 180, 270];
        prismBase =
          cardinalAngles[Math.floor(Math.random() * cardinalAngles.length)];
      } else {
        const obliqueAngles = [45, 135, 225, 315];
        prismBase =
          obliqueAngles[Math.floor(Math.random() * obliqueAngles.length)];
      }
    }

    const eye = Math.random() > 0.5 ? "OD" : "OS";

    setActualRx({ sphere, cylinder, axis, prism, prismBase, eye });
    setStudentInput({
      sphere: "",
      cylinder: "",
      axis: "",
      prism: "",
      prismBaseDir: "",
      prismMeridian: "",
    });
    setFeedback(null);
    setLensInserted(true);
    setHasCheckedCurrent(false);

    firstAttemptRef.current = null;
    revealedRef.current = false;
  }, [practiceOptions, powerStep]);

  const removeLens = () => {
    setLensInserted(false);
    setStudentInput({
      sphere: "",
      cylinder: "",
      axis: "",
      prism: "",
      prismBaseDir: "",
      prismMeridian: "",
    });
    setFeedback(null);
    setHasCheckedCurrent(false);
  };

  const handleNextLens = () => {
    const result = {
      lensNumber: currentLensIndex,
      eye: actualRx.eye,
      actual: {
        sphere: actualRx.sphere,
        cylinder: actualRx.cylinder,
        axis: actualRx.axis,
        prism: actualRx.prism,
        prismBase: actualRx.prismBase,
      },
      student: { ...studentInput },
      finalCorrect: feedback?.type === "success",
      firstAttemptCorrect: firstAttemptRef.current === "correct",
      checked: hasCheckedCurrent,
      revealed: revealedRef.current,
      prescriptionType: practiceOptions.type,
      hasPrism: practiceOptions.prism === "prism",
    };

    setLensResults((prev) => [...prev, result]);

    if (currentLensIndex < sessionInfo.totalLenses) {
      setCurrentLensIndex((prev) => prev + 1);
      generateRandomRx();
    } else {
      setAppState("completed");
    }
  };

  const activeRx = lensInserted
    ? actualRx
    : { sphere: 0, cylinder: 0, axis: 0, prism: 0, prismBase: 0, eye: "OD" };

  // Render Canvas
  useEffect(() => {
    if (appState !== "running") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const darknessOffset = backgroundDarkness - 5;
    const innerLightness = Math.max(10, Math.min(95, 77 - darknessOffset * 10));
    const outerLightness = Math.max(2, Math.min(60, 27 - darknessOffset * 5));

    // 1. Draw Illuminated Background
    const bgGradient = ctx.createRadialGradient(
      CENTER,
      CENTER,
      0,
      CENTER,
      CENTER,
      CENTER
    );
    bgGradient.addColorStop(0, `hsl(168, 51%, ${innerLightness}%)`);
    bgGradient.addColorStop(1, `hsl(168, 76%, ${outerLightness}%)`);
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // 2. Draw Reticle
    ctx.save();
    ctx.translate(CENTER, CENTER);
    ctx.rotate((-userDial.reticle * Math.PI) / 180);

    ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i <= 5; i++) {
      ctx.arc(0, 0, i * PRISM_SCALE, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
    }

    ctx.strokeStyle = "rgba(255, 0, 0, 0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const pointerLen = CENTER - 35;
    ctx.moveTo(-pointerLen, 0);
    ctx.lineTo(pointerLen, 0);
    ctx.stroke();

    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.font = '12px "Courier New", monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 1; i <= 5; i++) {
      ctx.fillText(i.toString(), i * PRISM_SCALE, -10);
    }
    ctx.restore();

    // 3. Protractor Scale
    ctx.strokeStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = '11px "Courier New", monospace';

    const protractorRadius = CANVAS_SIZE / 2 - 25;
    for (let vAngle = 0; vAngle < 360; vAngle += 5) {
      const rad = (-vAngle * Math.PI) / 180;
      const cosA = Math.cos(rad);
      const sinA = Math.sin(rad);

      const isMajor = vAngle % 30 === 0;
      const isMinor = vAngle % 10 === 0;
      const tickLength = isMajor ? 14 : isMinor ? 8 : 4;

      const startX = CENTER + cosA * protractorRadius;
      const startY = CENTER + sinA * protractorRadius;
      const endX = CENTER + cosA * (protractorRadius + tickLength);
      const endY = CENTER + sinA * (protractorRadius + tickLength);

      ctx.beginPath();
      ctx.lineWidth = isMajor ? 2 : 1;
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      if (isMajor) {
        const textX = CENTER + cosA * (protractorRadius - 14);
        const textY = CENTER + sinA * (protractorRadius - 14);
        let displayAngle = vAngle % 180;
        if (vAngle === 180) displayAngle = 180;
        if (vAngle === 0) displayAngle = 0;
        ctx.fillText(displayAngle.toString(), textX, textY);
      }
    }

    // 4. Optical Math for Target
    const theta_rad = (activeRx.axis - userDial.axis) * (Math.PI / 180);
    const reqPowerPrimary =
      activeRx.sphere + activeRx.cylinder * Math.pow(Math.sin(theta_rad), 2);
    const reqPowerSecondary =
      activeRx.sphere + activeRx.cylinder * Math.pow(Math.cos(theta_rad), 2);

    const offAxisDistortion =
      Math.abs(activeRx.cylinder) * Math.abs(Math.sin(2 * theta_rad)) * 0.7;

    const errorPrimary =
      Math.abs(userDial.power - reqPowerPrimary) + offAxisDistortion;
    const errorSecondary =
      Math.abs(userDial.power - reqPowerSecondary) + offAxisDistortion;

    const BLUR_MULTIPLIER = 15;
    const blurPrimary = Math.max(0, errorPrimary * BLUR_MULTIPLIER);
    const blurSecondary = Math.max(0, errorSecondary * BLUR_MULTIPLIER);

    const filterPrimary = blurPrimary < 0.1 ? "none" : `blur(${blurPrimary}px)`;
    const filterSecondary =
      blurSecondary < 0.1 ? "none" : `blur(${blurSecondary}px)`;

    const alphaPrimary = Math.max(0, 1.2 - errorPrimary * 0.4);
    const alphaSecondary = Math.max(0, 1.2 - errorSecondary * 0.4);

    const stretchFactor = 18;
    const thickPrimary = Math.max(6.0, 6.0 + errorPrimary * stretchFactor);
    const thickSecondary = Math.max(6.0, 6.0 + errorSecondary * stretchFactor);

    // Apply Illumination and Color Settings
    const mireAlphaMultiplier = 0.2 + (illumination - 1) * (0.8 / 9);
    const hexColor = mireColor === "yellow" ? "#FFFF00" : "#39FF14";

    ctx.save();
    const prismX =
      activeRx.prism *
      Math.cos((-activeRx.prismBase * Math.PI) / 180) *
      PRISM_SCALE;
    const prismY =
      activeRx.prism *
      Math.sin((-activeRx.prismBase * Math.PI) / 180) *
      PRISM_SCALE;

    ctx.translate(CENTER + prismX, CENTER + prismY);

    if (targetType === "crossline") {
      ctx.save();
      ctx.rotate((-userDial.axis * Math.PI) / 180);

      const innerGap = 30;
      const sphereStart = innerGap;
      const sphereEnd = 3 * PRISM_SCALE;
      const sphereOffset = 6;

      const cylStart = sphereStart + 2;
      const cylEndOuter = protractorRadius - 4;
      const cylEndSide = 5 * PRISM_SCALE;
      const cylOffset = 9;

      const drawSphereLines = (y0, y1, alpha, filterStyle, thick) => {
        if (alpha <= 0) return;
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = Math.min(1, alpha * mireAlphaMultiplier);
        ctx.filter = filterStyle;
        ctx.fillStyle = hexColor;
        ctx.shadowColor = hexColor;
        ctx.shadowBlur = filterStyle === "none" ? 0 : 3;

        [-sphereOffset, sphereOffset].forEach((dx) => {
          ctx.fillRect(dx - thick / 2, -y1, thick, y1 - y0);
          ctx.fillRect(dx - thick / 2, y0, thick, y1 - y0);
        });
        ctx.restore();
      };

      const drawCylinderLines = (
        x0,
        xCenterEnd,
        xSideEnd,
        alpha,
        filterStyle,
        thick
      ) => {
        if (alpha <= 0) return;
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = Math.min(1, alpha * mireAlphaMultiplier);
        ctx.filter = filterStyle;
        ctx.fillStyle = hexColor;
        ctx.shadowColor = hexColor;
        ctx.shadowBlur = filterStyle === "none" ? 0 : 3;

        const tipLen = Math.max(thick, 10);

        ctx.beginPath();
        ctx.moveTo(-xCenterEnd, 0);
        ctx.lineTo(-xCenterEnd + tipLen, thick / 2);
        ctx.lineTo(-x0, thick / 2);
        ctx.lineTo(-x0, -thick / 2);
        ctx.lineTo(-xCenterEnd + tipLen, -thick / 2);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(xCenterEnd, 0);
        ctx.lineTo(xCenterEnd - tipLen, thick / 2);
        ctx.lineTo(x0, thick / 2);
        ctx.lineTo(x0, -thick / 2);
        ctx.lineTo(xCenterEnd - tipLen, -thick / 2);
        ctx.closePath();
        ctx.fill();

        [-cylOffset, cylOffset].forEach((dy) => {
          ctx.fillRect(-xSideEnd, dy - thick / 2, xSideEnd - x0, thick);
          ctx.fillRect(x0, dy - thick / 2, xSideEnd - x0, thick);
        });
        ctx.restore();
      };

      drawSphereLines(
        sphereStart,
        sphereEnd,
        alphaPrimary,
        filterPrimary,
        thickPrimary
      );
      drawCylinderLines(
        cylStart,
        cylEndOuter,
        cylEndSide,
        alphaSecondary,
        filterSecondary,
        thickSecondary
      );

      // Axis Independent Central Corona
      {
        ctx.save();
        ctx.rotate((userDial.axis * Math.PI) / 180);

        const focusErrorSphere = userDial.power - activeRx.sphere;
        const focusErrorCyl =
          userDial.power - (activeRx.sphere + activeRx.cylinder);
        const minFocusError = Math.min(
          Math.abs(focusErrorSphere),
          Math.abs(focusErrorCyl)
        );

        const alphaCorona = Math.max(0, 1.2 - minFocusError * 0.4);

        if (alphaCorona > 0) {
          ctx.rotate((-activeRx.axis * Math.PI) / 180);
          ctx.globalCompositeOperation = "screen";
          ctx.globalAlpha = Math.min(1, alphaCorona * mireAlphaMultiplier);
          ctx.fillStyle = hexColor;
          ctx.shadowColor = hexColor;

          const rX = Math.max(
            2.0,
            2.0 + Math.abs(focusErrorSphere) * stretchFactor
          );
          const rY = Math.max(
            2.0,
            2.0 + Math.abs(focusErrorCyl) * stretchFactor
          );

          const opticalBlur = Math.max(0, minFocusError * 15);
          ctx.filter = opticalBlur < 0.1 ? "none" : `blur(${opticalBlur}px)`;
          ctx.shadowBlur = opticalBlur < 0.1 ? 0 : 3;

          const crownR = 24;
          const crownDots = 20;

          for (let i = 0; i < crownDots; i++) {
            const a = (i / crownDots) * Math.PI * 2;
            const dx = crownR * Math.cos(a);
            const dy = crownR * Math.sin(a);
            ctx.beginPath();
            ctx.ellipse(dx, dy, rX, rY, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }

      ctx.restore();
    } else if (targetType === "corona") {
      ctx.save();
      const focusErrorSphere = userDial.power - activeRx.sphere;
      const focusErrorCyl =
        userDial.power - (activeRx.sphere + activeRx.cylinder);
      const minFocusError = Math.min(
        Math.abs(focusErrorSphere),
        Math.abs(focusErrorCyl)
      );

      const alphaCorona = Math.max(0, 1.2 - minFocusError * 0.4);

      if (alphaCorona > 0) {
        ctx.globalAlpha = Math.min(1, alphaCorona * mireAlphaMultiplier);
        ctx.fillStyle = hexColor;
        ctx.shadowColor = hexColor;

        const rX = Math.max(
          2.0,
          2.0 + Math.abs(focusErrorSphere) * stretchFactor
        );
        const rY = Math.max(2.0, 2.0 + Math.abs(focusErrorCyl) * stretchFactor);

        const opticalBlur = Math.max(0, minFocusError * 15);
        ctx.filter = opticalBlur < 0.1 ? "none" : `blur(${opticalBlur}px)`;
        ctx.shadowBlur = opticalBlur < 0.1 ? 0 : 3;

        ctx.rotate((-activeRx.axis * Math.PI) / 180);

        const radius = 24;
        const count = 20;
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2;
          const dx = radius * Math.cos(angle);
          const dy = radius * Math.sin(angle);
          ctx.beginPath();
          ctx.ellipse(dx, dy, rX, rY, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    ctx.restore();

    // 6. Power Drum Viewfinder Window
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.filter = "none";
    ctx.shadowBlur = 0;
    ctx.setLineDash([]);

    const winW = 150;
    const winH = 70;
    const winX = CENTER - winW / 2;
    const winY = CANVAS_SIZE - winH - 30;

    const drawRoundRect = (x, y, w, h, r) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };

    ctx.fillStyle = "rgba(0,0,0,0.35)";
    drawRoundRect(winX, winY, winW, winH, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(214, 158, 46, 0.92)";
    drawRoundRect(winX + 3, winY + 3, winW - 6, winH - 6, 6);
    ctx.fill();

    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = 1.5;
    drawRoundRect(winX + 3, winY + 3, winW - 6, winH - 6, 6);
    ctx.stroke();

    ctx.fillStyle = "rgba(40,25,0,0.9)";
    const dotX = winX + 18;

    [winY + 22, winY + 35, winY + 48].forEach((cy) => {
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        ctx.arc(dotX, cy + k * 4.5, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    const p = userDial.power;
    const fmt = (v) => {
      const r = Math.round(v * 1000) / 1000;
      return (r > 0 ? "+" : r < 0 ? "" : " ") + r.toFixed(3).replace(/0$/, "");
    };

    const above = fmt(p + powerStep);
    const center = fmt(p);
    const below = fmt(p - powerStep);

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const valX = dotX + 14;

    ctx.font = '13px "Courier New", monospace';
    ctx.fillStyle = "rgba(60,40,0,0.6)";
    ctx.fillText(above, valX, winY + 22);
    ctx.fillText(below, valX, winY + 48);

    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.fillStyle = "rgba(20,12,0,0.95)";
    ctx.fillText(center, valX, winY + 35);

    ctx.font = '10px "Courier New", monospace';
    ctx.fillStyle = "rgba(40,25,0,0.7)";
    ctx.textAlign = "right";
    ctx.fillText("D", winX + winW - 10, winY + 35);

    ctx.restore();
  }, [
    appState,
    activeRx,
    userDial,
    targetType,
    backgroundDarkness,
    powerStep,
    lensInserted,
    illumination,
    mireColor,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || appState !== "running") return;

    const handleWheel = (e) => {
      e.preventDefault();
      setUserDial((prev) => {
        const step = e.deltaY > 0 ? -powerStep : powerStep;
        let newPower = prev.power + step;
        newPower = Math.round(newPower * 1000) / 1000;
        newPower = Math.min(20, Math.max(-20, newPower));
        return { ...prev, power: newPower };
      });
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, [powerStep, appState]);

  const formatPower = (power) => {
    return power > 0
      ? `+${power.toFixed(3).replace(/0$/, "")}`
      : power.toFixed(3).replace(/0$/, "");
  };

  const handlePowerChange = (delta) => {
    setUserDial((p) => {
      let newPower = p.power + delta;
      newPower = Math.round(newPower * 1000) / 1000;
      return { ...p, power: Math.min(20, Math.max(-20, newPower)) };
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setStudentInput((prev) => ({ ...prev, [name]: value }));
  };

  const checkAnswer = () => {
    const errors = [];
    const sSph = parseFloat(studentInput.sphere);
    const sCyl =
      practiceOptions.type === "spherocylinder"
        ? parseFloat(studentInput.cylinder)
        : 0;
    const sAxis = parseInt(studentInput.axis);

    const sPrism =
      practiceOptions.prism === "prism"
        ? parseFloat(studentInput.prism) || 0
        : 0;

    if (isNaN(sSph) || Math.abs(sSph - activeRx.sphere) > 0.05)
      errors.push("Sphere");

    if (practiceOptions.type === "spherocylinder") {
      if (isNaN(sCyl) || Math.abs(sCyl - activeRx.cylinder) > 0.05)
        errors.push("Cylinder");

      if (isNaN(sAxis)) {
        errors.push("Axis");
      } else {
        let aDiff = Math.abs(sAxis - activeRx.axis) % 180;
        if (aDiff > 90) aDiff = 180 - aDiff;
        if (aDiff > 3) errors.push("Axis");
      }
    }

    if (practiceOptions.prism === "prism") {
      if (Math.abs(sPrism - activeRx.prism) > 0.25) {
        errors.push("a. Prism Power");
      } else if (activeRx.prism > 0) {
        const expected = getPrismDirections(activeRx.prismBase, activeRx.eye);
        if (studentInput.prismBaseDir !== expected.base)
          errors.push("b. Prism Base Direction");
        const sMeridian = parseInt(studentInput.prismMeridian);
        if (isNaN(sMeridian) || sMeridian !== activeRx.prismBase)
          errors.push("c. Meridian");
      }
    }

    if (errors.length === 0) {
      if (!hasCheckedCurrent && sessionInfo.mode === "quiz" && lensInserted) {
        setQuizScore((prev) => prev + 1);
      }
      if (!hasCheckedCurrent) firstAttemptRef.current = "correct";
      setFeedback({
        type: "success",
        text: !lensInserted
          ? "Perfect! Calibration confirmed (Plano reading)."
          : "Perfect measurement! Your readings are correct.",
      });
    } else {
      if (!hasCheckedCurrent) firstAttemptRef.current = "incorrect";
      setFeedback({
        type: "error",
        text: `Needs review. Check your measurements for: ${errors.join(", ")}`,
      });
    }

    setHasCheckedCurrent(true);
  };

  const revealAnswer = () => {
    const expected = getPrismDirections(activeRx.prismBase, activeRx.eye);
    setStudentInput({
      sphere: formatPower(activeRx.sphere),
      cylinder:
        practiceOptions.type === "spherocylinder"
          ? formatPower(activeRx.cylinder)
          : "",
      axis:
        practiceOptions.type === "spherocylinder"
          ? activeRx.axis.toString().padStart(3, "0")
          : "",
      prism: practiceOptions.prism === "prism" ? activeRx.prism.toFixed(2) : "",
      prismBaseDir: practiceOptions.prism === "prism" ? expected.base : "",
      prismMeridian:
        practiceOptions.prism === "prism" ? activeRx.prismBase.toString() : "",
    });

    revealedRef.current = true;
    setFeedback({ type: "info", text: "Answers revealed." });
  };

  const startSimulation = () => {
    setAppState("running");
    setCurrentLensIndex(1);
    setQuizScore(0);
    setLensResults([]);
    firstAttemptRef.current = null;
    revealedRef.current = false;
    generateRandomRx();
  };

  const sliderSensitivity = 80 - (wheelSpeed - 1) * 7.7;

  // --- RENDERS ---
  if (appState === "setup") {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6 font-sans text-slate-800">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
          <div className="bg-emerald-700 p-8 text-center text-white">
            <Crosshair className="w-16 h-16 mx-auto mb-4 opacity-90" />
            <h1 className="text-3xl font-bold mb-2">Lensmeter Simulation</h1>
            <p className="text-emerald-100 font-medium">
              Created by: LearnOptix
            </p>
          </div>
          <div className="p-8">
            <h2 className="text-lg font-bold mb-6 text-slate-700 flex items-center gap-2">
              <Settings className="w-5 h-5 text-emerald-600" /> Session Setup
            </h2>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">
                  Mode
                </label>
                <select
                  value={sessionInfo.mode}
                  onChange={(e) =>
                    setSessionInfo({ ...sessionInfo, mode: e.target.value })
                  }
                  className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-emerald-500 bg-white"
                >
                  <option value="practice">Practice Mode</option>
                  <option value="quiz">Quiz Mode</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">
                  Number of Lenses
                </label>
                <select
                  value={sessionInfo.totalLenses}
                  onChange={(e) =>
                    setSessionInfo({
                      ...sessionInfo,
                      totalLenses: parseInt(e.target.value),
                    })
                  }
                  className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-emerald-500 bg-white"
                >
                  <option value={1}>1 Lens</option>
                  <option value={3}>3 Lenses</option>
                  <option value={5}>5 Lenses</option>
                  <option value={10}>10 Lenses</option>
                </select>
              </div>
            </div>

            <button
              onClick={startSimulation}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl transition flex items-center justify-center gap-2 shadow-md shadow-emerald-200"
            >
              <PlayCircle className="w-6 h-6" /> Start Simulation
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ENHANCED COMPLETED SCREEN
  if (appState === "completed") {
    const totalLenses = sessionInfo.totalLenses;
    const practiceCorrectCount = lensResults.filter(
      (r) => r.finalCorrect
    ).length;

    return (
      <div className="min-h-screen bg-slate-100 p-4 md:p-6 font-sans text-slate-800">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
            <div className="bg-emerald-700 p-8 text-white text-center">
              <GraduationCap className="w-16 h-16 mx-auto mb-4 opacity-90" />
              <h1 className="text-3xl font-bold">Session Complete!</h1>
            </div>

            <div className="p-6 md:p-8">
              {sessionInfo.mode === "quiz" && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mb-6 text-center">
                  <p className="text-sm text-slate-500 font-bold uppercase tracking-wider mb-2">
                    Final Score
                  </p>
                  <p className="text-5xl font-extrabold text-emerald-600">
                    {quizScore}{" "}
                    <span className="text-2xl text-slate-400">
                      / {totalLenses}
                    </span>
                  </p>
                  <p className="text-slate-500 text-sm mt-2">
                    {totalLenses > 0
                      ? `${Math.round((quizScore / totalLenses) * 100)}% `
                      : ""}
                    {quizScore === totalLenses
                      ? "  Perfect Score!"
                      : quizScore >= totalLenses * 0.8
                      ? "Excellent work!"
                      : quizScore >= totalLenses * 0.6
                      ? "Good effort. Keep practicing!"
                      : "More practice needed."}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Points are awarded on the first correct attempt only.
                  </p>
                </div>
              )}

              {sessionInfo.mode === "practice" && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 mb-6 text-center">
                  <p className="text-sm text-emerald-700 font-bold uppercase tracking-wider mb-2">
                    Practice Summary
                  </p>
                  <p className="text-5xl font-extrabold text-emerald-600">
                    {practiceCorrectCount}{" "}
                    <span className="text-2xl text-slate-400">
                      / {totalLenses}
                    </span>
                  </p>
                  <p className="text-slate-500 text-sm mt-2">
                    lenses read correctly
                  </p>
                </div>
              )}

              <div className="border-t pt-6 mb-6">
                <h2 className="text-lg font-bold mb-4 text-slate-700 flex items-center gap-2">
                  <Info className="w-5 h-5 text-slate-400" />
                  Detailed Results by Lens
                </h2>
                <div className="space-y-4">
                  {lensResults.map((result, idx) => {
                    const sphMatch = result.student.sphere
                      ? Math.abs(
                          parseFloat(result.student.sphere) -
                            result.actual.sphere
                        ) <= 0.05
                      : null;

                    const cylMatch =
                      result.prescriptionType === "spherocylinder" &&
                      result.student.cylinder
                        ? Math.abs(
                            parseFloat(result.student.cylinder) -
                              result.actual.cylinder
                          ) <= 0.05
                        : null;

                    const axisMatch =
                      result.prescriptionType === "spherocylinder" &&
                      result.student.axis
                        ? (() => {
                            let d =
                              Math.abs(
                                parseInt(result.student.axis) -
                                  result.actual.axis
                              ) % 180;
                            if (d > 90) d = 180 - d;
                            return d <= 3;
                          })()
                        : null;

                    const prismMatch =
                      result.hasPrism && result.student.prism
                        ? Math.abs(
                            parseFloat(result.student.prism) -
                              result.actual.prism
                          ) <= 0.25
                        : null;

                    const expectedDir = result.hasPrism
                      ? getPrismDirections(result.actual.prismBase, result.eye)
                          .base
                      : "";

                    const prismDirMatch =
                      result.hasPrism && result.student.prismBaseDir
                        ? result.student.prismBaseDir === expectedDir
                        : null;

                    const meridianMatch =
                      result.hasPrism && result.student.prismMeridian
                        ? parseInt(result.student.prismMeridian) ===
                          result.actual.prismBase
                        : null;

                    const borderClass = result.finalCorrect
                      ? "border-emerald-300"
                      : result.checked
                      ? "border-red-300"
                      : "border-slate-300";

                    const headerBg = result.finalCorrect
                      ? "bg-emerald-50"
                      : result.checked
                      ? "bg-red-50"
                      : "bg-slate-50";

                    const fmtAxis = (v) =>
                      v ? `${parseInt(v).toString().padStart(3, "0")} ` : "";

                    return (
                      <div
                        key={idx}
                        className={`rounded-xl border overflow-hidden ${borderClass}`}
                      >
                        <div
                          className={`px-5 py-3 flex flex-wrap justify-between items-center gap-2 ${headerBg}`}
                        >
                          <div className="flex items-center gap-2">
                            {result.finalCorrect ? (
                              <CheckCircle className="w-5 h-5 text-emerald-600" />
                            ) : result.checked ? (
                              <AlertCircle className="w-5 h-5 text-red-500" />
                            ) : (
                              <HelpCircle className="w-5 h-5 text-slate-400" />
                            )}
                            <span className="font-bold text-slate-800">
                              Lens {result.lensNumber}
                            </span>
                            <span
                              className={`text-xs font-bold px-2 py-0.5 rounded ${
                                result.eye === "OD"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-violet-100 text-violet-700"
                              }`}
                            >
                              {result.eye}
                            </span>
                            <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                              {result.prescriptionType === "spherocylinder"
                                ? "Spherocylinder"
                                : "Sphere Only"}
                              {result.hasPrism ? " + Prism" : ""}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-1.5 items-center">
                            {result.finalCorrect ? (
                              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
                                Correct
                              </span>
                            ) : result.checked ? (
                              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">
                                Incorrect
                              </span>
                            ) : (
                              <span className="text-xs bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full font-medium">
                                Not Checked
                              </span>
                            )}
                            {result.revealed && (
                              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                                Answer Revealed
                              </span>
                            )}
                            {sessionInfo.mode === "quiz" && (
                              <span
                                className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                  result.firstAttemptCorrect
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-slate-100 text-slate-500"
                                }`}
                              >
                                {result.firstAttemptCorrect
                                  ? "+1 Point"
                                  : "0 Points"}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="bg-white p-4 overflow-x-auto">
                          <table className="w-full min-w-[320px]">
                            <thead>
                              <tr className="text-xs text-slate-400 uppercase tracking-wide border-b border-slate-100">
                                <th className="text-left pb-2 pr-3 font-semibold">
                                  Parameter
                                </th>
                                <th className="text-center pb-2 px-3 font-semibold">
                                  Actual Rx
                                </th>
                                <th className="text-center pb-2 px-3 font-semibold">
                                  Your Reading
                                </th>
                                <th className="text-center pb-2 pl-2 font-semibold">
                                  Match
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              <ResultRow
                                label="Sphere"
                                actual={formatPower(result.actual.sphere)}
                                student={result.student.sphere}
                                match={sphMatch}
                              />
                              {result.prescriptionType === "spherocylinder" && (
                                <>
                                  <ResultRow
                                    label="Cylinder"
                                    actual={formatPower(result.actual.cylinder)}
                                    student={result.student.cylinder}
                                    match={cylMatch}
                                  />
                                  <ResultRow
                                    label="Axis"
                                    actual={`${result.actual.axis
                                      .toString()
                                      .padStart(3, "0")} `}
                                    student={fmtAxis(result.student.axis)}
                                    match={axisMatch}
                                  />
                                </>
                              )}
                              {result.hasPrism && (
                                <>
                                  <ResultRow
                                    label="Prism Power"
                                    actual={`${result.actual.prism.toFixed(
                                      2
                                    )} `}
                                    student={
                                      result.student.prism
                                        ? `${result.student.prism} `
                                        : ""
                                    }
                                    match={prismMatch}
                                  />
                                  <ResultRow
                                    label="Base Direction"
                                    actual={expectedDir}
                                    student={result.student.prismBaseDir}
                                    match={prismDirMatch}
                                  />
                                  <ResultRow
                                    label="Meridian"
                                    actual={`${result.actual.prismBase} `}
                                    student={
                                      result.student.prismMeridian
                                        ? `${result.student.prismMeridian} `
                                        : ""
                                    }
                                    match={meridianMatch}
                                  />
                                </>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={() => setAppState("setup")}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-xl transition"
              >
                Return to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6 font-sans text-slate-800">
      <div className="max-w-6xl mx-auto">
        {/* App Header */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-4 md:mb-0 w-full md:w-auto">
            <Crosshair className="text-emerald-600 w-8 h-8 hidden sm:block" />
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Lensmeter Simulation
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                <span className="uppercase text-emerald-600 font-bold">
                  {sessionInfo.mode} Mode
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
            <div className="text-right border-r pr-4 mr-1 border-slate-200 hidden lg:block">
              <p className="text-sm font-bold text-slate-700">
                Created by: LearnOptix
              </p>
            </div>
            <div className="bg-slate-100 px-4 py-2 rounded-lg border border-slate-200 font-bold text-slate-700 flex items-center gap-2">
              Lens {currentLensIndex} of {sessionInfo.totalLenses}
            </div>
            <button
              onClick={() => setShowInstructions(!showInstructions)}
              className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors font-medium whitespace-nowrap"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
          </div>
        </div>

        {showInstructions && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-5 shadow-sm">
            <h3 className="font-bold text-blue-900 flex items-center gap-2 mb-2">
              <Info className="w-5 h-5" /> How to use the Lensmeter
            </h3>
            <ul className="list-decimal list-inside text-sm text-blue-800 space-y-1">
              <li>
                Use the <strong>Power Dial</strong> (or scroll wheel) to bring
                target lines into focus.
              </li>
              <li>
                Pull the <strong>Axis Wheel</strong> or{" "}
                <strong>Reticle Wheel</strong> left or right to seamlessly spin
                the rotation.
              </li>
              <li>
                Focus target until the corona dots or lines are completely sharp
                and clear.
              </li>
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 flex flex-col items-center">
            <div className="mb-4 bg-emerald-100 text-emerald-800 px-4 py-2 rounded-full font-bold shadow-sm border border-emerald-200">
              <span className="uppercase tracking-wider text-sm">
                Lens on Stage:
              </span>{" "}
              {lensInserted
                ? activeRx.eye === "OD"
                  ? "Right Eye (OD)"
                  : "Left Eye (OS)"
                : "None (Plano)"}
            </div>

            <div className="relative p-3 bg-slate-800 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.3)] border-4 border-slate-700">
              <div className="rounded-full overflow-hidden border-8 border-black relative bg-black">
                <canvas
                  ref={canvasRef}
                  width={CANVAS_SIZE}
                  height={CANVAS_SIZE}
                  className="block cursor-ns-resize"
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col gap-6">
            <div
              className={`bg-white p-6 rounded-xl shadow-sm border border-slate-200 ${
                sessionInfo.mode === "quiz"
                  ? "opacity-80 pointer-events-none"
                  : ""
              }`}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold">Target Settings</h2>
                {sessionInfo.mode === "quiz" && (
                  <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded font-bold">
                    Locked in Quiz
                  </span>
                )}
              </div>

              <div className="mb-4 flex gap-2 p-1 bg-slate-100 rounded-lg border border-slate-200">
                <button
                  onClick={() => setTargetType("crossline")}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    targetType === "crossline"
                      ? "bg-white shadow-sm text-slate-800"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Crossline Target
                </button>
                <button
                  onClick={() => setTargetType("corona")}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    targetType === "corona"
                      ? "bg-white shadow-sm text-slate-800"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Corona (Dots)
                </button>
              </div>

              <div className="flex gap-4 mb-4">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Prescription Type
                  </label>
                  <select
                    value={practiceOptions.type}
                    onChange={(e) =>
                      setPracticeOptions((p) => ({
                        ...p,
                        type: e.target.value,
                      }))
                    }
                    className="w-full border rounded p-2 text-sm outline-none bg-white"
                  >
                    <option value="sphere">Sphere Only</option>
                    <option value="spherocylinder">Sphere & Cylinder</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Prism Options
                  </label>
                  <select
                    value={practiceOptions.prism}
                    onChange={(e) =>
                      setPracticeOptions((p) => ({
                        ...p,
                        prism: e.target.value,
                      }))
                    }
                    className="w-full border rounded p-2 text-sm outline-none bg-white"
                  >
                    <option value="none">No Prism</option>
                    <option value="prism">Include Prism</option>
                  </select>
                </div>
              </div>

              {practiceOptions.prism === "prism" && (
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Prism Position
                  </label>
                  <select
                    value={practiceOptions.prismDirection}
                    onChange={(e) =>
                      setPracticeOptions((p) => ({
                        ...p,
                        prismDirection: e.target.value,
                      }))
                    }
                    className="w-full border rounded p-2 text-sm outline-none bg-white"
                  >
                    <option value="cardinal">Vertical & Horizontal</option>
                    <option value="oblique">Oblique</option>
                  </select>
                </div>
              )}

              {sessionInfo.mode !== "quiz" &&
                (!lensInserted ? (
                  <button
                    onClick={generateRandomRx}
                    className="w-full flex justify-center items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white py-2 rounded-lg font-medium transition"
                  >
                    <PlusCircle className="w-5 h-5" /> Insert Lens to Read
                  </button>
                ) : (
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={removeLens}
                      className="flex-1 flex justify-center items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 py-2 rounded-lg font-medium transition"
                    >
                      <XCircle className="w-4 h-4" /> Remove
                    </button>
                  </div>
                ))}
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-4 border-b pb-2">
                <h2 className="text-lg font-bold">Instrument Controls</h2>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">
                    Power Drum Precision
                  </label>
                  <select
                    value={powerStep}
                    onChange={(e) => setPowerStep(parseFloat(e.target.value))}
                    className="w-full border rounded p-1.5 text-sm outline-none bg-white"
                  >
                    <option value={0.125}>0.125 D</option>
                    <option value={0.25}>0.25 D</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">
                    Mire Color
                  </label>
                  <select
                    value={mireColor}
                    onChange={(e) => setMireColor(e.target.value)}
                    className="w-full border rounded p-1.5 text-sm outline-none bg-white"
                  >
                    <option value="green">Neon Green</option>
                    <option value="yellow">Bright Yellow</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">
                    Wheel Rotation Speed
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Slow</span>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="1"
                      value={wheelSpeed}
                      onChange={(e) => setWheelSpeed(parseInt(e.target.value))}
                      className="flex-1 accent-emerald-600"
                    />
                    <span className="text-xs text-slate-400">Fast</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">
                    Mire Illumination
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">1</span>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="1"
                      value={illumination}
                      onChange={(e) =>
                        setIllumination(parseInt(e.target.value))
                      }
                      className="flex-1 accent-yellow-500"
                    />
                    <span className="text-xs text-slate-400">10</span>
                  </div>
                </div>
              </div>

              <div className="mb-6 flex justify-between items-end mt-4">
                <div className="flex-1">
                  <label className="font-semibold text-slate-700 block mb-2">
                    Power Drum (D)
                  </label>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handlePowerChange(-powerStep)}
                      className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-full font-bold text-lg"
                    >
                      -
                    </button>
                    <input
                      type="range"
                      min="-20"
                      max="20"
                      step={powerStep}
                      value={userDial.power}
                      onChange={(e) =>
                        setUserDial((p) => ({
                          ...p,
                          power: parseFloat(e.target.value),
                        }))
                      }
                      className="flex-1 accent-emerald-600"
                    />
                    <button
                      onClick={() => handlePowerChange(powerStep)}
                      className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-full font-bold text-lg"
                    >
                      +
                    </button>
                  </div>
                </div>
                <span className="font-mono text-xl bg-slate-100 px-3 py-1 ml-4 rounded font-bold border border-slate-200 shadow-sm w-24 text-center">
                  {formatPower(userDial.power)}
                </span>
              </div>

              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <label className="font-semibold text-slate-700">
                    Axis Wheel (°)
                  </label>
                  <span className="font-mono text-xl bg-slate-100 px-3 py-1 rounded text-slate-800 font-bold border border-slate-200">
                    {userDial.axis.toString().padStart(3, "0")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setUserDial((p) => ({ ...p, axis: (p.axis + 179) % 180 }))
                    }
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded font-bold text-slate-600 border border-slate-300"
                    title="-1 Degree"
                  >
                    -1
                  </button>
                  <div className="flex-1">
                    <SpringSlider
                      label="Axis Wheel"
                      value={userDial.axis}
                      sensitivity={sliderSensitivity}
                      onChange={(delta) =>
                        setUserDial((p) => {
                          let newAxis = (p.axis + delta) % 180;
                          if (newAxis < 0) newAxis += 180;
                          return { ...p, axis: newAxis };
                        })
                      }
                    />
                  </div>
                  <button
                    onClick={() =>
                      setUserDial((p) => ({ ...p, axis: (p.axis + 1) % 180 }))
                    }
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded font-bold text-slate-600 border border-slate-300"
                    title="+1 Degree"
                  >
                    +1
                  </button>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="font-semibold text-slate-700">
                    Reticle Rotation (°)
                  </label>
                  <span className="font-mono text-xl bg-slate-100 px-3 py-1 rounded text-slate-600 font-bold border border-slate-200">
                    {userDial.reticle.toString().padStart(3, "0")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setUserDial((p) => ({
                        ...p,
                        reticle: (p.reticle + 359) % 360,
                      }))
                    }
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded font-bold text-slate-600 border border-slate-300"
                    title="-1 Degree"
                  >
                    -1
                  </button>
                  <div className="flex-1">
                    <SpringSlider
                      label="Reticle Wheel"
                      value={userDial.reticle}
                      sensitivity={sliderSensitivity}
                      onChange={(delta) =>
                        setUserDial((p) => {
                          let newReticle = (p.reticle + delta) % 360;
                          if (newReticle < 0) newReticle += 360;
                          return { ...p, reticle: newReticle };
                        })
                      }
                    />
                  </div>
                  <button
                    onClick={() =>
                      setUserDial((p) => ({
                        ...p,
                        reticle: (p.reticle + 1) % 360,
                      }))
                    }
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded font-bold text-slate-600 border border-slate-300"
                    title="+1 Degree"
                  >
                    +1
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h2 className="text-lg font-bold mb-4 border-b pb-2">
                Record Findings
              </h2>
              <div className="grid grid-cols-3 gap-2 mb-4">
                <input
                  type="text"
                  name="sphere"
                  placeholder="Sph (D)"
                  value={studentInput.sphere}
                  onChange={handleInputChange}
                  className="border p-2 rounded text-center outline-none focus:border-emerald-500"
                />
                {practiceOptions.type === "spherocylinder" && (
                  <>
                    <input
                      type="text"
                      name="cylinder"
                      placeholder="Cyl (D)"
                      value={studentInput.cylinder}
                      onChange={handleInputChange}
                      className="border p-2 rounded text-center outline-none focus:border-emerald-500"
                    />
                    <input
                      type="number"
                      name="axis"
                      placeholder="Axis (°)"
                      value={studentInput.axis}
                      onChange={handleInputChange}
                      className="border p-2 rounded text-center outline-none focus:border-emerald-500"
                    />
                  </>
                )}
              </div>

              {practiceOptions.prism === "prism" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
                  <input
                    type="number"
                    step="0.25"
                    name="prism"
                    placeholder="a. Prism Power"
                    value={studentInput.prism}
                    onChange={handleInputChange}
                    className="border p-2 rounded text-center outline-none focus:border-emerald-500"
                  />
                  <select
                    name="prismBaseDir"
                    value={studentInput.prismBaseDir}
                    onChange={handleInputChange}
                    className="border p-2 rounded text-center outline-none focus:border-emerald-500 bg-white"
                  >
                    <option value="">b. Base Dir...</option>
                    <option value="Base IN">Base IN</option>
                    <option value="Base OUT">Base OUT</option>
                    <option value="Base UP">Base UP</option>
                    <option value="Base DOWN">Base DOWN</option>
                    <option value="Base IN & UP">Base IN & UP</option>
                    <option value="Base OUT & UP">Base OUT & UP</option>
                    <option value="Base IN & DOWN">Base IN & DOWN</option>
                    <option value="Base OUT & DOWN">Base OUT & DOWN</option>
                  </select>
                  <input
                    type="number"
                    name="prismMeridian"
                    placeholder="c. Meridian (°)"
                    value={studentInput.prismMeridian}
                    onChange={handleInputChange}
                    className="border p-2 rounded text-center outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              <div className="flex gap-2 mt-4">
                <button
                  onClick={checkAnswer}
                  className="flex-1 bg-slate-800 hover:bg-slate-900 text-white py-2 rounded-lg font-semibold transition"
                >
                  Check Answer
                </button>
                {sessionInfo.mode === "practice" && (
                  <button
                    onClick={revealAnswer}
                    className="px-4 bg-slate-100 border hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition"
                  >
                    Reveal
                  </button>
                )}
                {/* Progression Button */}
                <button
                  onClick={handleNextLens}
                  className={`px-4 flex items-center gap-1 text-white font-semibold rounded-lg transition ${
                    currentLensIndex === sessionInfo.totalLenses
                      ? "bg-indigo-600 hover:bg-indigo-700"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  {currentLensIndex === sessionInfo.totalLenses
                    ? "Finish"
                    : "Next Lens"}
                </button>
              </div>

              {feedback && (
                <div
                  className={`mt-4 p-3 rounded-lg flex items-start gap-2 text-sm font-medium ${
                    feedback.type === "success"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : feedback.type === "error"
                      ? "bg-red-50 text-red-800 border border-red-200"
                      : "bg-blue-50 text-blue-800 border border-blue-200"
                  }`}
                >
                  {feedback.type === "success" && (
                    <CheckCircle className="w-5 h-5 shrink-0" />
                  )}
                  {feedback.type === "error" && (
                    <AlertCircle className="w-5 h-5 shrink-0" />
                  )}
                  {feedback.type === "info" && (
                    <Info className="w-5 h-5 shrink-0" />
                  )}
                  <p>{feedback.text}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
