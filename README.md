# 🦉 Tracking Owl

> **"Most cursor followers feel like floaty 2005 mouse trails. This one feels like an apex predator locking eyes with you."**

An interactive, canvas-driven web experience built from a single static stippling artwork into a living, breathing nocturnal raptor that stalks your cursor in real time.

Built in **~10 minutes using Gemini 3.8 Flash ⚡**, completely open-sourced.

[![Live Demo](https://img.shields.io/badge/Live_Demo-Try_It_Now-d31826?style=for-the-badge&logo=firefox&logoColor=white)](https://rahul-gembali.github.io/Tracking-Owl/)
[![GitHub license](https://img.shields.io/badge/License-MIT-black?style=for-the-badge)](LICENSE)
[![Vanilla Stack](https://img.shields.io/badge/Stack-Pure_HTML5_|_CSS3_|_Canvas-blue?style=for-the-badge)](app.js)

👉 **[Launch Interactive Experience](https://rahul-gembali.github.io/Tracking-Owl/)** 👈

---

## 👁️ Why Does It Look Alive?

Most eye-tracking demos just translate a black dot inside a white circle. It looks robotic, flat, and fake.

To make an ink-and-paper illustration genuinely feel like an alert wild owl, we engineered five biological mechanics directly into the canvas loop:

```
                  [ YOUR CURSOR ]
                         │
                         ▼
        ┌─────────────────────────────────┐
        │     Vector & Distance Math      │
        │    (dx, dy) ➔ atan2 & tanh      │
        └────────────────┬────────────────┘
                         │
         ┌───────────────┴───────────────┐
         ▼                               ▼
  [ LEFT EYEBALL ]               [ RIGHT EYEBALL ]
  • Spherical foreshorten        • Spherical foreshorten
  • Inward binocular tilt        • Inward binocular tilt
  • Subconscious saccades        • Subconscious saccades
  • Procedural stipple iris      • Procedural stipple iris
         │                               │
         └───────────────┬───────────────┘
                         ▼
        ┌─────────────────────────────────┐
        │   Dual-Layer Depth Compositing  │
        │ Eyes render UNDER feather mask  │
        └─────────────────────────────────┘
```

1. **3D Spherical Foreshortening** — Real eyeballs are spheres, not planes. As the pupil approaches the socket rim, it compresses into an ellipse along the gaze angle:
   $$\text{scale} = 1.0 - 0.26 \times \left(\frac{r}{r_{\max}}\right)^2$$
2. **Predatory Binocular Convergence** — When your cursor gets close to the beak midline, both eyes angle inward, creating the intense cross-eyed focus owls use when locking onto prey.
3. **Subconscious Micro-Saccades** — Living eyes never stay perfectly still. Micro-twitches ($\pm 0.35\text{px}$) fire every 1.5–3 seconds, simulating ocular tremors.
4. **Dual-Layer Feather Masking** — The dynamic eyeballs are rendered on a canvas *behind* an alpha-cutout of the original artwork. The hand-drawn stipple feathers overlap the eyeball perimeter so the eyes never look pasted on.
5. **Procedural Pointillism Texture** — Seeded dot-work particles populate the crimson iris, harmonizing the procedural rendering with the traditional stippled ink drawing.

---

## 🎮 Interactive Modes

| Mode | What Happens |
|---|---|
| 🔴 **Laser Prey Dot** | Spawns a glowing target dot that follows your cursor with trailing luminous ember sparks. The owl fixates on it like prey. |
| 🔦 **Night / Lantern Mode** | Shrouds the viewport in darkness. Your cursor becomes a soft torchlight revealing the forest paper, while the owl's eyes glow with eerie red retroreflection. |
| 👁️ **Organic Blinks & Winks** | Natural random blinks every 3–7 seconds, occasional winks, plus instant reactive blink and head micro-tilt when clicking anywhere on the owl. |
| 🔊 **Atmospheric Sound Engine** | Pure Web Audio API — zero audio files. Synthesizes a warm night wind breeze and authentic multi-harmonic owl calls (*"Hoo... hu-hu-Hooo"*). |
| 📱 **Full Touch Support** | Touch-drag on mobile and tablet screens to guide the gaze effortlessly. |

---

## 🚀 Quick Start (Zero Setup)

Zero `npm install`. Zero build steps. Zero heavy libraries. Just pure native web platform code.

```bash
# 1. Clone the repo
git clone https://github.com/Rahul-Gembali/Tracking-Owl.git
cd Tracking-Owl

# 2. Run with any local server
python -m http.server 8080
```

Open `http://localhost:8080` in your browser and move your cursor.

---

## 🗂️ Architecture

```
Tracking-Owl/
├── index.html           # Semantic layout, high-DPI canvas & floating HUD dock
├── styles.css           # Paper parchment styling, night mode radial shader
├── app.js               # Dual-eye physics engine, saccades, Web Audio synth
├── assets/
│   ├── owl_clean.png    # Artifact-free stippled owl base illustration
│   ├── owl_cutout.png   # Alpha-feather mask for seamless eyeball depth
│   └── paper_tile.jpg   # Seamless repeating textured paper background
└── scripts/
    └── prepare_assets.py  # Python PIL asset processing & cleanup pipeline
```

---

## 💡 The Story

I wanted to take a static piece of stippled owl artwork and bring it to life on the web — not just moving pixels around, but making it feel watchful, eerie, and alive. 

Built in about 10 minutes paired with **Gemini 3.8 Flash**, crafting the asset extraction pipeline, mathematical foreshortening, and Web Audio synthesis from scratch.

If you enjoy it, star the repo ⭐ and try the live demo!

---

## 📜 License

[MIT License](LICENSE) — Feel free to use, experiment, remix, and build your own interactive art.
