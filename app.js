/**
 * Interactive Stippled Owl • Gaze Tracking Engine
 * High-performance dual-eye raptor gaze mechanics with spherical foreshortening,
 * binocular convergence, pointillism iris stippling, 3D parallax micro-tilt, and organic micro-saccades.
 */

(function () {
  'use strict';

  // --- Configuration & Constants ---
  const NATIVE_WIDTH = 1024;
  const NATIVE_HEIGHT = 576;

  // Anatomical Eye Coordinates in 1024x576 Space
  const EYES = {
    left: {
      cx: 502.5,
      cy: 135.5,
      rx: 10.5,
      ry: 8.5,
      curX: 0,
      curY: 0,
      targetX: 0,
      targetY: 0,
      saccadeX: 0,
      saccadeY: 0,
      pupilRadius: 3.6,
      currentPupilR: 3.6,
      blinkProgress: 0,
    },
    right: {
      cx: 565.5,
      cy: 134.5,
      rx: 10.5,
      ry: 8.5,
      curX: 0,
      curY: 0,
      targetX: 0,
      targetY: 0,
      saccadeX: 0,
      saccadeY: 0,
      pupilRadius: 3.6,
      currentPupilR: 3.6,
      blinkProgress: 0,
    },
  };

  // Pre-generated Seeded Stipple Dots for Iris Texture
  function generateIrisDots(seed, count) {
    const dots = [];
    let s = seed;
    function rand() {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    }
    for (let i = 0; i < count; i++) {
      const angle = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()); // Uniform distribution in circle
      const size = 0.5 + rand() * 0.8;
      const alpha = 0.2 + rand() * 0.5;
      const isDark = rand() > 0.45;
      dots.push({ angle, r, size, alpha, isDark });
    }
    return dots;
  }

  const LEFT_IRIS_DOTS = generateIrisDots(12345, 75);
  const RIGHT_IRIS_DOTS = generateIrisDots(67890, 75);

  // --- DOM Elements ---
  const stageWrapper = document.getElementById('stageWrapper');
  const stage = document.getElementById('stage');
  const eyeCanvas = document.getElementById('eyeCanvas');
  const eyeCtx = eyeCanvas.getContext('2d', { alpha: true });
  const trailCanvas = document.getElementById('trailCanvas');
  const trailCtx = trailCanvas.getContext('2d', { alpha: true });
  const laserDot = document.getElementById('laserDot');
  const laserBtn = document.getElementById('laserBtn');
  const nightBtn = document.getElementById('nightBtn');
  const blinkBtn = document.getElementById('blinkBtn');
  const soundBtn = document.getElementById('soundBtn');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const soundIcon = document.getElementById('soundIcon');
  const hintText = document.getElementById('hintText');

  // --- State Variables ---
  let mouse = {
    clientX: window.innerWidth * 0.5,
    clientY: window.innerHeight * 0.5,
    stageX: 534,
    stageY: 300,
    speed: 0,
    lastX: window.innerWidth * 0.5,
    lastY: window.innerHeight * 0.5,
  };

  let settings = {
    laserMode: false,
    nightMode: false,
    soundEnabled: true,
  };

  // Subtle 3D Head Parallax
  let headTilt = {
    curRotX: 0,
    curRotY: 0,
    targetRotX: 0,
    targetRotY: 0,
  };

  let particles = [];
  let blinkState = {
    isBlinking: false,
    timer: 0,
    duration: 180, // ms
    startTime: 0,
    which: 'both', // 'both', 'left', 'right'
  };

  let audioCtx = null;
  let windGain = null;
  let nextBlinkTimeout = null;
  let nextSaccadeTimeout = null;

  // --- Canvas Sizing & High DPI ---
  function resizeCanvases() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);

    eyeCanvas.width = NATIVE_WIDTH * dpr;
    eyeCanvas.height = NATIVE_HEIGHT * dpr;
    eyeCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    trailCanvas.width = window.innerWidth * dpr;
    trailCanvas.height = window.innerHeight * dpr;
    trailCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // --- Coordinate Transformation ---
  function updateMouseStageCoords(clientX, clientY) {
    mouse.clientX = clientX;
    mouse.clientY = clientY;

    // Update CSS variables for night mode radial flashlight
    document.documentElement.style.setProperty('--mouse-x', `${clientX}px`);
    document.documentElement.style.setProperty('--mouse-y', `${clientY}px`);

    const rect = stage.getBoundingClientRect();
    // Linear projection from viewport pixels into stage 1024x576 coordinates
    mouse.stageX = (clientX - rect.left) * (NATIVE_WIDTH / rect.width);
    mouse.stageY = (clientY - rect.top) * (NATIVE_HEIGHT / rect.height);

    // Calculate cursor velocity
    const dx = clientX - mouse.lastX;
    const dy = clientY - mouse.lastY;
    mouse.speed = Math.hypot(dx, dy);
    mouse.lastX = clientX;
    mouse.lastY = clientY;

    // 3D Head Parallax (Subtle micro-tilt of max 2.5 degrees)
    const normX = (clientX / window.innerWidth) * 2 - 1; // -1 to 1
    const normY = (clientY / window.innerHeight) * 2 - 1; // -1 to 1
    headTilt.targetRotY = normX * 2.8;
    headTilt.targetRotX = -normY * 2.2;

    // Update Laser Dot position
    if (settings.laserMode) {
      laserDot.style.transform = `translate3d(${clientX}px, ${clientY}px, 0)`;
      // Spawn trail particle if moving
      if (mouse.speed > 2 && Math.random() < 0.65) {
        spawnParticle(clientX, clientY);
      }
    }
  }

  // --- Particle Trail for Laser Dot ---
  function spawnParticle(x, y) {
    if (particles.length > 50) return;
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.6 + Math.random() * 2.0;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1.0,
      decay: 0.035 + Math.random() * 0.045,
      size: 1.5 + Math.random() * 2.8,
    });
  }

  function updateAndDrawParticles() {
    trailCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    if (!settings.laserMode || particles.length === 0) return;

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;

      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }

      trailCtx.beginPath();
      trailCtx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      trailCtx.fillStyle = `rgba(255, 30, 45, ${p.life * 0.8})`;
      trailCtx.shadowBlur = 6;
      trailCtx.shadowColor = '#ff192b';
      trailCtx.fill();
    }
  }

  // --- Blinking System ---
  function triggerBlink(which = 'both', duration = 160) {
    blinkState.isBlinking = true;
    blinkState.startTime = performance.now();
    blinkState.duration = duration;
    blinkState.which = which;
  }

  function scheduleRandomBlink() {
    clearTimeout(nextBlinkTimeout);
    const delay = 3200 + Math.random() * 4500;
    nextBlinkTimeout = setTimeout(() => {
      // 10% chance of double-blink, 5% chance of wink
      const roll = Math.random();
      if (roll < 0.06) {
        triggerBlink(Math.random() > 0.5 ? 'left' : 'right', 210);
      } else if (roll < 0.18) {
        triggerBlink('both', 130);
        setTimeout(() => triggerBlink('both', 130), 200);
      } else {
        triggerBlink('both', 160);
      }
      scheduleRandomBlink();
    }, delay);
  }

  // --- Organic Micro-Saccades ---
  function scheduleSaccade() {
    clearTimeout(nextSaccadeTimeout);
    const delay = 1400 + Math.random() * 2800;
    nextSaccadeTimeout = setTimeout(() => {
      const angle = Math.random() * Math.PI * 2;
      const mag = 0.25 + Math.random() * 0.4;
      const sx = Math.cos(angle) * mag;
      const sy = Math.sin(angle) * mag;

      EYES.left.saccadeX = sx;
      EYES.left.saccadeY = sy;
      EYES.right.saccadeX = sx;
      EYES.right.saccadeY = sy;

      setTimeout(() => {
        EYES.left.saccadeX = 0;
        EYES.left.saccadeY = 0;
        EYES.right.saccadeX = 0;
        EYES.right.saccadeY = 0;
      }, 110 + Math.random() * 90);

      scheduleSaccade();
    }, delay);
  }

  // --- Gaze Calculations ---
  function updateEyeGaze(eyeKey, targetStageX, targetStageY) {
    const eye = EYES[eyeKey];
    const dx = targetStageX - eye.cx;
    const dy = targetStageY - eye.cy;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);

    // Anatomical maximum displacement inside the socket ellipse
    const maxPx = eye.rx * 0.48; // ~5.0px
    const maxPy = eye.ry * 0.48; // ~4.1px

    // Distance mapping with smooth sigmoid saturation
    const intensity = Math.tanh(dist / 320);

    // Binocular convergence: When cursor is near the vertical midline between eyes,
    // eyes converge inward towards the beak
    let convergenceOffset = 0;
    const midX = 534;
    const distToMid = Math.abs(targetStageX - midX);
    if (distToMid < 180 && targetStageY > 100 && targetStageY < 420) {
      const convFactor = (1 - distToMid / 180) * 0.55;
      convergenceOffset = (eyeKey === 'left' ? 1 : -1) * convFactor;
    }

    eye.targetX = Math.cos(angle) * maxPx * intensity + convergenceOffset + eye.saccadeX;
    eye.targetY = Math.sin(angle) * maxPy * intensity + eye.saccadeY;

    // Constrain pupil to ellipse interior
    const normDistSq = (eye.targetX / maxPx) ** 2 + (eye.targetY / maxPy) ** 2;
    if (normDistSq > 1.0) {
      const factor = 1.0 / Math.sqrt(normDistSq);
      eye.targetX *= factor;
      eye.targetY *= factor;
    }

    // Smooth lerp (raptor stalker inertia)
    const lerpFactor = 0.17;
    eye.curX += (eye.targetX - eye.curX) * lerpFactor;
    eye.curY += (eye.targetY - eye.curY) * lerpFactor;

    // Pupil dilation dynamics:
    // Dilate slightly in night mode (up to 4.3px) or during fast cursor movement
    let targetR = 3.6;
    if (settings.nightMode) targetR = 4.3;
    if (mouse.speed > 12) targetR += 0.4;
    eye.currentPupilR += (targetR - eye.currentPupilR) * 0.09;
  }

  // --- Rendering Eyeball on Canvas ---
  function drawEye(eyeKey, dots) {
    const eye = EYES[eyeKey];
    const { cx, cy, rx, ry, curX, curY, currentPupilR, blinkProgress } = eye;

    eyeCtx.save();

    // 1. Clip to the eye socket ellipse (extended by 1.2px to ensure solid underlay behind feathers)
    const socketRx = rx + 1.2;
    const socketRy = ry + 1.2;
    eyeCtx.beginPath();
    eyeCtx.ellipse(cx, cy, socketRx, socketRy, 0, 0, Math.PI * 2);
    eyeCtx.clip();

    // 2. Base Eyeball: Glowing Crimson Gradient
    // Rich gradient matching original stippled owl artwork
    const irisGrad = eyeCtx.createRadialGradient(cx, cy, rx * 0.1, cx, cy, socketRx);
    irisGrad.addColorStop(0.0, '#ff1a2b');  // Brilliant scarlet center
    irisGrad.addColorStop(0.35, '#d80816'); // Pure rich crimson
    irisGrad.addColorStop(0.72, '#96000c'); // Deep dark blood red
    irisGrad.addColorStop(1.0, '#380004');  // Near-black perimeter rim
    eyeCtx.fillStyle = irisGrad;
    eyeCtx.fill();

    // Night Mode Eerie Eye Luminescence (Eye-shine)
    if (settings.nightMode) {
      const glowGrad = eyeCtx.createRadialGradient(cx, cy, 0, cx, cy, rx * 0.95);
      glowGrad.addColorStop(0, 'rgba(255, 80, 80, 0.55)');
      glowGrad.addColorStop(0.75, 'rgba(255, 20, 20, 0.15)');
      glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      eyeCtx.fillStyle = glowGrad;
      eyeCtx.fill();
    }

    // 3. Stippled Pointillism Iris Texture (Procedural Dots)
    for (let i = 0; i < dots.length; i++) {
      const d = dots[i];
      const dx = Math.cos(d.angle) * (d.r * (rx - 1.2));
      const dy = Math.sin(d.angle) * (d.r * (ry - 1.2));
      eyeCtx.beginPath();
      eyeCtx.arc(cx + dx, cy + dy, d.size, 0, Math.PI * 2);
      eyeCtx.fillStyle = d.isDark
        ? `rgba(20, 0, 4, ${d.alpha * 0.75})`
        : `rgba(255, 130, 130, ${d.alpha * 0.55})`;
      eyeCtx.fill();
    }

    // 4. Moving Pupil (with 3D spherical foreshortening)
    const px = cx + curX;
    const py = cy + curY;

    // Foreshorten pupil along gaze vector as it approaches socket boundary
    const gazeDistNorm = Math.hypot(curX / (rx * 0.48), curY / (ry * 0.48));
    const foreshorten = Math.max(0.74, 1.0 - 0.26 * (gazeDistNorm ** 2));
    const pupilAngle = Math.atan2(curY, curX);

    eyeCtx.save();
    eyeCtx.translate(px, py);
    eyeCtx.rotate(pupilAngle);
    eyeCtx.scale(foreshorten, 1.0); // Compress along direction of gaze

    eyeCtx.beginPath();
    eyeCtx.arc(0, 0, currentPupilR, 0, Math.PI * 2);
    // Deep black pupil with velvety soft transition
    const pupilGrad = eyeCtx.createRadialGradient(0, 0, currentPupilR * 0.5, 0, 0, currentPupilR);
    pupilGrad.addColorStop(0, '#0c0a0a');
    pupilGrad.addColorStop(0.85, '#120f0f');
    pupilGrad.addColorStop(1, '#240a0c');
    eyeCtx.fillStyle = pupilGrad;
    eyeCtx.fill();

    eyeCtx.restore();

    // 5. Specular Highlights / Corneal Catchlights
    // Primary Glint: Offset towards top-left light source
    const glintDist = 1.65;
    const glintAngle = -2.3; // Upper left
    const gx = px + Math.cos(glintAngle) * glintDist;
    const gy = py + Math.sin(glintAngle) * glintDist;

    eyeCtx.beginPath();
    eyeCtx.arc(gx, gy, 1.15, 0, Math.PI * 2);
    eyeCtx.fillStyle = 'rgba(255, 255, 255, 0.94)';
    eyeCtx.fill();

    // Secondary subtle micro-glint on opposite rim
    eyeCtx.beginPath();
    eyeCtx.arc(px - Math.cos(glintAngle) * 1.8, py - Math.sin(glintAngle) * 1.8, 0.65, 0, Math.PI * 2);
    eyeCtx.fillStyle = 'rgba(255, 255, 255, 0.38)';
    eyeCtx.fill();

    // 6. Ambient Occlusion Shadow from Eyebrow/Socket Feathers
    const browShadow = eyeCtx.createLinearGradient(cx, cy - socketRy, cx, cy + socketRy);
    browShadow.addColorStop(0.0, 'rgba(10, 8, 8, 0.68)');
    browShadow.addColorStop(0.32, 'rgba(20, 10, 10, 0.28)');
    browShadow.addColorStop(0.72, 'rgba(0, 0, 0, 0)');
    eyeCtx.fillStyle = browShadow;
    eyeCtx.fill();

    // 7. Eyelid Blink Layer
    if (blinkProgress > 0) {
      const lidY = (cy - socketRy) + (socketRy * 2.15) * blinkProgress;

      // Draw feathered eyelid coming down
      eyeCtx.beginPath();
      eyeCtx.rect(cx - socketRx - 2, cy - socketRy - 2, (socketRx + 2) * 2, lidY - (cy - socketRy) + 2);
      eyeCtx.fillStyle = '#21201f';
      eyeCtx.fill();

      // Lower eyelid slight upward creep
      const lowerLidY = (cy + socketRy) - (socketRy * 0.6) * blinkProgress;
      eyeCtx.beginPath();
      eyeCtx.rect(cx - socketRx - 2, lowerLidY, (socketRx + 2) * 2, (cy + socketRy + 2) - lowerLidY);
      eyeCtx.fillStyle = '#21201f';
      eyeCtx.fill();

      // Soft rim line
      eyeCtx.strokeStyle = 'rgba(10, 10, 10, 0.85)';
      eyeCtx.lineWidth = 1;
      eyeCtx.stroke();
    }

    eyeCtx.restore();
  }

  // --- Main Animation Loop ---
  function animate(now) {
    // 1. Update Blinking Curve
    if (blinkState.isBlinking) {
      const elapsed = now - blinkState.startTime;
      const t = elapsed / blinkState.duration;

      if (t >= 1.0) {
        blinkState.isBlinking = false;
        EYES.left.blinkProgress = 0;
        EYES.right.blinkProgress = 0;
      } else {
        // Bell-shaped curve for blink (0 -> 1 -> 0)
        const curve = Math.sin(t * Math.PI);
        if (blinkState.which === 'both' || blinkState.which === 'left') {
          EYES.left.blinkProgress = curve;
        }
        if (blinkState.which === 'both' || blinkState.which === 'right') {
          EYES.right.blinkProgress = curve;
        }
      }
    }

    // 2. Update 3D Head Tilt
    headTilt.curRotX += (headTilt.targetRotX - headTilt.curRotX) * 0.08;
    headTilt.curRotY += (headTilt.targetRotY - headTilt.curRotY) * 0.08;
    stageWrapper.style.transform = `perspective(1200px) rotateX(${headTilt.curRotX.toFixed(2)}deg) rotateY(${headTilt.curRotY.toFixed(2)}deg)`;

    // 3. Update Gaze Positions
    updateEyeGaze('left', mouse.stageX, mouse.stageY);
    updateEyeGaze('right', mouse.stageX, mouse.stageY);

    // 4. Clear Canvas & Render Eyes
    eyeCtx.clearRect(0, 0, NATIVE_WIDTH, NATIVE_HEIGHT);
    drawEye('left', LEFT_IRIS_DOTS);
    drawEye('right', RIGHT_IRIS_DOTS);

    // 5. Update Laser Particle Trail
    updateAndDrawParticles();

    requestAnimationFrame(animate);
  }

  // --- Audio Synthesis (Web Audio API) ---
  let masterGain = null;

  async function ensureAudio() {
    try {
      if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();

        // Master Gain Node for full, rich volume control
        masterGain = audioCtx.createGain();
        masterGain.gain.setValueAtTime(1.0, audioCtx.currentTime);
        masterGain.connect(audioCtx.destination);

        // Setup Atmospheric Forest Breeze
        setupWind();
      }

      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      return audioCtx;
    } catch (e) {
      console.warn('AudioContext error:', e);
      return null;
    }
  }

  function setupWind() {
    if (!audioCtx || !masterGain) return;
    try {
      const bufferSize = audioCtx.sampleRate * 2;
      const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + 0.03 * white) / 1.03; // Warm pink noise
        lastOut = output[i];
      }

      const whiteNoise = audioCtx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      // Bandpass filter for wind howl & rustle
      const bandpass = audioCtx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = 420;
      bandpass.Q.value = 1.6;

      windGain = audioCtx.createGain();
      windGain.gain.setValueAtTime(0.0001, audioCtx.currentTime);

      whiteNoise.connect(bandpass);
      bandpass.connect(windGain);
      windGain.connect(masterGain);
      whiteNoise.start();
    } catch (e) {
      console.warn('Wind setup error:', e);
    }
  }

  async function playOwlHoot() {
    if (!settings.soundEnabled) return;
    const ctx = await ensureAudio();
    if (!ctx) return;

    try {
      const t = ctx.currentTime + 0.05;

      // Authentic Owl Call Rhythm: "Hoo... hu-hu-Hooo"
      const notes = [
        { start: 0.00, dur: 0.36, fStart: 410, fEnd: 375, vol: 0.75 },
        { start: 0.50, dur: 0.18, fStart: 395, fEnd: 380, vol: 0.65 },
        { start: 0.72, dur: 0.18, fStart: 425, fEnd: 410, vol: 0.70 },
        { start: 0.94, dur: 0.55, fStart: 435, fEnd: 360, vol: 0.85 },
      ];

      notes.forEach(({ start, dur, fStart, fEnd, vol }) => {
        const noteStart = t + start;
        const noteEnd = noteStart + dur;

        // 1. Fundamental Sine Oscillator
        const osc1 = ctx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(fStart, noteStart);
        osc1.frequency.exponentialRampToValueAtTime(fEnd, noteEnd);

        // 2. Harmonic Overtone (Triangle) for rich acoustic body audible on all speakers
        const osc2 = ctx.createOscillator();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(fStart * 1.5, noteStart);
        osc2.frequency.exponentialRampToValueAtTime(fEnd * 1.5, noteEnd);

        const osc2Gain = ctx.createGain();
        osc2Gain.gain.setValueAtTime(0.22, noteStart);

        // 3. Subtle Vocal Trill / Vibrato LFO (5.5 Hz)
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.setValueAtTime(5.5, noteStart);
        lfoGain.gain.setValueAtTime(9.0, noteStart);
        lfo.connect(lfoGain);
        lfoGain.connect(osc1.frequency);
        lfoGain.connect(osc2.frequency);

        // 4. Lowpass Filter for natural woodsy warmth
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(950, noteStart);

        // 5. Volume Envelope (Smooth Attack & Natural Resonance Decay)
        const noteGain = ctx.createGain();
        noteGain.gain.setValueAtTime(0.0001, noteStart);
        noteGain.gain.linearRampToValueAtTime(vol, noteStart + 0.04);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

        // Audio Routing
        osc1.connect(noteGain);
        osc2.connect(osc2Gain);
        osc2Gain.connect(noteGain);
        noteGain.connect(filter);
        filter.connect(masterGain);

        // Start & Stop
        lfo.start(noteStart);
        osc1.start(noteStart);
        osc2.start(noteStart);

        lfo.stop(noteEnd + 0.02);
        osc1.stop(noteEnd + 0.02);
        osc2.stop(noteEnd + 0.02);
      });
    } catch (e) {
      console.warn('Hoot playback error:', e);
    }
  }

  async function activateAudio(playHoot = true) {
    if (!settings.soundEnabled) return;
    const ctx = await ensureAudio();
    if (!ctx) return;

    if (masterGain) {
      masterGain.gain.cancelScheduledValues(ctx.currentTime);
      masterGain.gain.setValueAtTime(1.0, ctx.currentTime);
    }

    if (windGain) {
      windGain.gain.cancelScheduledValues(ctx.currentTime);
      windGain.gain.setValueAtTime(windGain.gain.value || 0.0001, ctx.currentTime);
      windGain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.8);
    }

    if (playHoot) {
      playOwlHoot();
    }
  }

  function muteAudio() {
    if (windGain && audioCtx) {
      windGain.gain.cancelScheduledValues(audioCtx.currentTime);
      windGain.gain.setValueAtTime(windGain.gain.value, audioCtx.currentTime);
      windGain.gain.linearRampToValueAtTime(0.0001, audioCtx.currentTime + 0.3);
    }
    if (masterGain && audioCtx) {
      masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
      masterGain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    }
  }

  // --- Event Listeners ---
  function setupEvents() {
    // Mouse Tracking across entire window
    window.addEventListener('mousemove', (e) => {
      updateMouseStageCoords(e.clientX, e.clientY);
    });

    // Touch Support for Mobile & Tablets
    window.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        updateMouseStageCoords(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        updateMouseStageCoords(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    // Click on Stage -> Reactive Blink & Hoot
    stage.addEventListener('click', () => {
      triggerBlink('both', 150);
      if (settings.soundEnabled) {
        playOwlHoot();
      }
    });

    // Laser Dot Toggle
    laserBtn.addEventListener('click', () => {
      settings.laserMode = !settings.laserMode;
      laserBtn.classList.toggle('active', settings.laserMode);
      laserDot.classList.toggle('active', settings.laserMode);
      if (!settings.laserMode) {
        trailCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        particles = [];
      }
    });

    // Night Mode Toggle
    nightBtn.addEventListener('click', () => {
      settings.nightMode = !settings.nightMode;
      nightBtn.classList.toggle('active', settings.nightMode);
      document.body.classList.toggle('night-mode', settings.nightMode);
    });

    // Blink Button Trigger
    blinkBtn.addEventListener('click', () => {
      triggerBlink('both', 160);
      if (settings.soundEnabled) {
        playOwlHoot();
      }
    });

    // Sound Toggle
    soundBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      settings.soundEnabled = !settings.soundEnabled;
      soundBtn.classList.toggle('active', settings.soundEnabled);

      if (settings.soundEnabled) {
        soundIcon.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>';
        await activateAudio(true);
      } else {
        soundIcon.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>';
        muteAudio();
      }
    });

    // Fullscreen Toggle
    fullscreenBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    // Resize Handler
    window.addEventListener('resize', () => {
      resizeCanvases();
    });

    // Window Blur -> Return gaze to center smoothly
    window.addEventListener('mouseleave', () => {
      mouse.stageX = 534;
      mouse.stageY = 300;
      headTilt.targetRotX = 0;
      headTilt.targetRotY = 0;
    });
  }

  function schedulePeriodicHoot() {
    const delay = 18000 + Math.random() * 14000;
    setTimeout(() => {
      if (settings.soundEnabled) {
        playOwlHoot();
      }
      schedulePeriodicHoot();
    }, delay);
  }

  // --- Initialization ---
  function init() {
    resizeCanvases();
    setupEvents();
    scheduleRandomBlink();
    scheduleSaccade();
    schedulePeriodicHoot();

    // URL Query Parameters Support (e.g. ?night=1, ?laser=1, ?sound=0, ?x=200&y=100)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('night') === '1') {
      settings.nightMode = true;
      nightBtn.classList.add('active');
      document.body.classList.add('night-mode');
    }
    if (urlParams.get('laser') === '1') {
      settings.laserMode = true;
      laserBtn.classList.add('active');
      laserDot.classList.add('active');
    } else if (urlParams.get('laser') === '0') {
      settings.laserMode = false;
      laserBtn.classList.remove('active');
      laserDot.classList.remove('active');
    }
    if (urlParams.get('sound') === '0') {
      settings.soundEnabled = false;
      soundBtn.classList.remove('active');
      soundIcon.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>';
    }
    if (urlParams.has('x') && urlParams.has('y')) {
      const qx = parseFloat(urlParams.get('x'));
      const qy = parseFloat(urlParams.get('y'));
      updateMouseStageCoords(qx, qy);
    }

    // Default laser mode visual state (off by default)
    if (settings.laserMode) {
      laserDot.classList.add('active');
      laserDot.style.transform = `translate3d(${mouse.clientX}px, ${mouse.clientY}px, 0)`;
    } else {
      laserDot.classList.remove('active');
    }

    // Start sound on page load immediately if enabled
    if (settings.soundEnabled) {
      activateAudio(true);

      // If browser autoplay policy suspends AudioContext until first gesture,
      // seamlessly resume on any mouse movement, touch, or keypress
      const handleAutoplayUnlock = async (e) => {
        if (e && e.target && e.target.closest('#soundBtn')) return;
        if (settings.soundEnabled && audioCtx && audioCtx.state === 'suspended') {
          await audioCtx.resume();
          activateAudio(true);
        }
        cleanupAutoplayListeners();
      };

      const unlockEvents = ['mousemove', 'pointerdown', 'touchstart', 'keydown'];
      function cleanupAutoplayListeners() {
        unlockEvents.forEach(ev => window.removeEventListener(ev, handleAutoplayUnlock, { capture: true }));
      }
      unlockEvents.forEach(ev => window.addEventListener(ev, handleAutoplayUnlock, { capture: true, once: true }));
    }

    // Hide hint text after 15 mouse movements
    let moveCount = 0;
    const hideHint = () => {
      moveCount++;
      if (moveCount > 15) {
        hintText.style.opacity = '0';
        window.removeEventListener('mousemove', hideHint);
      }
    };
    window.addEventListener('mousemove', hideHint);

    // Kick off animation loop
    requestAnimationFrame(animate);
  }

  // Start after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
