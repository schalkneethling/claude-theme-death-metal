import type { EngineInterface, Register, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'

const SCENE_NAME = 'necropolis'

// ---------------------------------------------------------------------------
// Colors: near-black surfaces warmed with red, bone-colored text, and a
// blood-red accent. The look is made for dark mode only.
// ---------------------------------------------------------------------------

const { theme, problems } = makeColors({
  label: 'Death metal',
  only: 'dark',
  roles: {
    accent: '#c22a1f',
    danger: '#ff6a3d',
    success: '#86a84f',
    warning: '#d9a441',
    pro: '#9a63c4',
  },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#0b0607',
        'surface-1': '#100809',
        'surface-2': '#140a0b',
        'surface-3': '#170c0d',
        'text-primary': '#f1e8dd',
        'text-secondary': '#d1c3b5',
        'text-muted': '#ad9d8f',
      },
    },
  },
})

/**
 * The whole look. `glass` is the frosted panel the app lays behind the
 * conversation: the scene shows through it blurred, under a dark tint.
 *
 * The app redraws a scene only when its name changes, so each new context
 * reading sets the look again under the other of two names.
 */
function buildLook(isAlternate: boolean): ThemeSetArgs {
  return {
    colors: theme,
    backdrop: {
      scene: `${SCENE_NAME}_${isAlternate ? 'b' : 'a'}`,
      glass: { blur: 14, tint: '#0a0506', opacity: 0.55 },
    },
    overrideColorScheme: 'dark',
  }
}

function isOwnSceneName(name: string): boolean {
  return name === `${SCENE_NAME}_a` || name === `${SCENE_NAME}_b`
}

// ---------------------------------------------------------------------------
// The scene, built as one SVG string. The drawing space is 1600 by 1000.
// ---------------------------------------------------------------------------

const BLACK = '#050203'

// The scene worsens in four stages as the context window fills. Each stage
// keeps what the stage before it added.
type Stage = {
  /** The stage starts once the context percentage reaches this figure. */
  from: number
  emberCount: number
  fogOpacity: number
  hasExtraFog: boolean
  /** Seconds between lightning strikes. */
  strikeSeconds: number
  /** A deeper red sky and moon, and brighter cathedral windows. */
  isBlazing: boolean
  /** The figure on the headstone glows red: time to compact. */
  isWarning: boolean
}

const STAGES: readonly [Stage, ...Stage[]] = [
  { from: 0, emberCount: 22, fogOpacity: 0.26, hasExtraFog: false, strikeSeconds: 13, isBlazing: false, isWarning: false },
  { from: 45, emberCount: 48, fogOpacity: 0.42, hasExtraFog: true, strikeSeconds: 7, isBlazing: false, isWarning: false },
  { from: 70, emberCount: 60, fogOpacity: 0.46, hasExtraFog: true, strikeSeconds: 5, isBlazing: true, isWarning: false },
  { from: 90, emberCount: 72, fogOpacity: 0.5, hasExtraFog: true, strikeSeconds: 4, isBlazing: true, isWarning: true },
]

/** The last stage whose `from` the percentage has reached; the first stage while there is no reading. */
function stageOf(percent: number | undefined): Stage {
  let current = STAGES[0]

  for (const stage of STAGES) {
    if (percent !== undefined && percent >= stage.from) {
      current = stage
    }
  }

  return current
}
const BONE = '#c9b9a4'

/** A small repeatable random source, so the scene is the same on every draw. */
function createRandom(seed: number): () => number {
  let state = seed

  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296

    return state / 4294967296
  }
}

function round(value: number): number {
  return Math.round(value * 10) / 10
}

/** A jagged ridge from the left edge to the right, closed along the bottom. */
function drawRidge(seed: number, baseY: number, height: number, step: number, color: string): string {
  const random = createRandom(seed)
  const points: string[] = []

  for (let x = -400; x <= 2000; x += step * (0.5 + random())) {
    // Alternating high and low points make peaks, not rolling hills.
    const isPeak = points.length % 2 === 0
    const y = baseY - (isPeak ? height * (0.35 + random() * 0.65) : height * random() * 0.3)

    points.push(`${round(x)},${round(y)}`)
  }

  return `<path d="M-400,1700 L${points.join(' L')} L2000,1700Z" fill="${color}"/>`
}

/**
 * A dead tree, grown one branch at a time: each branch ends in two or three
 * thinner, shorter branches that bend away from it.
 */
function drawDeadTree(seed: number, x: number, y: number, height: number, lean: number): string {
  const random = createRandom(seed)
  // Branches of the same depth share a width, so each depth is one path. That
  // keeps the scene well under the 131,072 characters the app allows.
  const levels = new Map<number, { width: number; segments: string[] }>()

  function grow(fromX: number, fromY: number, angle: number, length: number, width: number, depth: number): void {
    const toX = fromX + Math.cos(angle) * length
    const toY = fromY - Math.sin(angle) * length
    // The control point sits off the straight line, which gives the branch its crook.
    const bend = (random() - 0.5) * length * 0.5
    const controlX = (fromX + toX) / 2 + Math.sin(angle) * bend
    const controlY = (fromY + toY) / 2 + Math.cos(angle) * bend

    const level = levels.get(depth) ?? { width, segments: [] }

    level.segments.push(
      `M${Math.round(fromX)},${Math.round(fromY)}Q${Math.round(controlX)},${Math.round(controlY)} ${Math.round(toX)},${Math.round(toY)}`,
    )
    levels.set(depth, level)

    if (depth === 0) {
      return
    }

    const count = random() < 0.35 ? 3 : 2

    for (let index = 0; index < count; index += 1) {
      const side = index % 2 === 0 ? 1 : -1
      const spread = side * (0.3 + random() * 0.6)

      grow(toX, toY, angle + spread, length * (0.6 + random() * 0.22), width * 0.6, depth - 1)
    }
  }

  grow(x, y, Math.PI / 2 + lean, height * 0.32, height * 0.055, 7)

  const paths = [...levels.values()].map(
    level => `<path d="${level.segments.join('')}" stroke-width="${round(level.width)}"/>`,
  )

  return `<g fill="none" stroke="${BLACK}" stroke-linecap="round">${paths.join('')}</g>`
}

/** A headstone with a rounded top. `tilt` is in degrees. */
function drawHeadstone(x: number, y: number, halfWidth: number, height: number, tilt: number): string {
  const shoulder = height - halfWidth

  return `<path transform="translate(${x},${y}) rotate(${tilt})" d="M${-halfWidth},8 L${-halfWidth},${-shoulder} C${-halfWidth},${-height - halfWidth * 0.3} ${halfWidth},${-height - halfWidth * 0.3} ${halfWidth},${-shoulder} L${halfWidth},8Z" fill="#0c0506" stroke="#4a1a14" stroke-width="2"/>`
}

function drawCross(x: number, y: number, height: number, tilt: number): string {
  const arm = height * 0.32
  const bar = height * 0.09

  return `<path transform="translate(${x},${y}) rotate(${tilt})" d="M${-bar},8 L${-bar},${-height * 0.6} L${-arm},${-height * 0.6} L${-arm},${-height * 0.6 - 2 * bar} L${-bar},${-height * 0.6 - 2 * bar} L${-bar},${-height} L${bar},${-height} L${bar},${-height * 0.6 - 2 * bar} L${arm},${-height * 0.6 - 2 * bar} L${arm},${-height * 0.6} L${bar},${-height * 0.6} L${bar},8Z" fill="#0c0506" stroke="#4a1a14" stroke-width="2"/>`
}

function drawSkull(x: number, y: number, scale: number, tilt: number): string {
  return `<g transform="translate(${x},${y}) rotate(${tilt}) scale(${scale})">
<path d="M-26,4 C-36,-30 -16,-46 0,-46 C16,-46 36,-30 26,4 L18,9 L16,26 L-16,26 L-18,9Z" fill="url(#bone)" stroke="#2a0d0b" stroke-width="1.5"/>
<ellipse cx="-11" cy="-9" rx="8" ry="9.5" fill="#120506"/><ellipse cx="11" cy="-9" rx="8" ry="9.5" fill="#120506"/>
<path d="M0,3 L-4.5,13 L4.5,13Z" fill="#120506"/>
<path d="M-9,17 V26 M-3,17 V26 M3,17 V26 M9,17 V26 M-15,17 H15" stroke="#2a0d0b" stroke-width="1.5" fill="none"/>
</g>`
}

/** A ruined cathedral in silhouette, with windows lit from inside. Its base rests on y = 0. */
function drawCathedral(x: number, y: number, scale: number, isBlazing: boolean): string {
  const window = (cx: number, base: number, halfWidth: number, height: number): string =>
    `<path d="M${cx - halfWidth},${base} L${cx - halfWidth},${base - height} Q${cx - halfWidth},${base - height - halfWidth * 1.6} ${cx},${base - height - halfWidth * 2.4} Q${cx + halfWidth},${base - height - halfWidth * 1.6} ${cx + halfWidth},${base - height}L${cx + halfWidth},${base}Z"/>`

  return `<g transform="translate(${x},${y}) scale(${scale})">
<g fill="#080203">
<rect x="-96" y="-112" width="192" height="130"/>
<rect x="-28" y="-224" width="56" height="230"/><path d="M-36,-222 L0,-340 L36,-222Z"/>
<rect x="-98" y="-172" width="36" height="180"/><path d="M-104,-170 L-80,-250 L-56,-170Z"/>
<path d="M60,10 L60,-150 L70,-166 L76,-148 L84,-160 L90,-140 L96,-152 L96,10Z"/>
<path d="M-2,-340 L-2,-372 L-12,-372 L-12,-378 L-2,-378 L-2,-390 L2,-390 L2,-378 L12,-378 L12,-372 L2,-372 L2,-340Z"/>
</g>
${isBlazing ? '<ellipse cx="0" cy="-90" rx="210" ry="170" fill="url(#blaze)"/>' : ''}
<g class="windows" fill="url(#${isBlazing ? 'fire' : 'ember'})">
${window(0, -130, 10, 46)}${window(-80, -100, 7, 34)}${window(-44, -30, 8, 40)}${window(44, -30, 8, 40)}${window(78, -60, 6, 30)}
</g>
</g>`
}

function drawRaven(x: number, y: number, scale: number): string {
  return `<g transform="translate(${x},${y}) scale(${scale})" fill="${BLACK}">
<path d="M-34,-6 C-26,-22 -6,-30 10,-26 C20,-36 34,-34 38,-24 L52,-20 L38,-16 C36,-6 26,2 12,4 L-8,6 L-46,22 L-30,2Z"/>
<path d="M2,4 L0,16 M10,4 L10,16" stroke="${BLACK}" stroke-width="3"/>
<circle cx="33" cy="-25" r="2" fill="#ff5a36"/>
</g>`
}

function drawFlock(): string {
  const birds = [
    [1090, 250, 1, 0],
    [1150, 300, 0.7, -3],
    [1010, 320, 0.8, -6],
    [420, 210, 0.6, -9],
  ] as const

  return birds
    .map(
      ([x, y, scale, delay]) =>
        `<g transform="translate(${x},${y}) scale(${scale})"><g class="flight" style="animation-delay:${delay}s"><path class="flap" d="M-18,-2 Q-9,-14 0,0 Q9,-14 18,-2" fill="none" stroke="${BLACK}" stroke-width="3.5" stroke-linecap="round"/></g></g>`,
    )
    .join('')
}

function drawStars(): string {
  const random = createRandom(11)
  const stars: string[] = []

  for (let index = 0; index < 70; index += 1) {
    const x = Math.round(random() * 2000 - 200)
    const y = Math.round(random() * 700 - 300)
    const radius = (0.5 + random() * 1.1).toFixed(1)
    const opacity = (0.2 + random() * 0.5).toFixed(2)

    stars.push(`<circle cx="${x}" cy="${y}" r="${radius}" opacity="${opacity}"/>`)
  }

  return `<g fill="#ffb8a0">${stars.join('')}</g>`
}

function drawEmbers(count: number): string {
  const random = createRandom(29)
  const embers: string[] = []

  for (let index = 0; index < count; index += 1) {
    const x = Math.round(random() * 1600)
    const y = Math.round(720 + random() * 200)
    const radius = (1.2 + random() * 1.6).toFixed(1)
    const delay = (random() * 14).toFixed(1)

    embers.push(`<circle class="ember" cx="${x}" cy="${y}" r="${radius}" style="animation-delay:-${delay}s"/>`)
  }

  return `<g fill="#ff7a3c">${embers.join('')}</g>`
}

/** A forked lightning bolt from the top of the sky. It is hidden except while it flashes. */
function drawLightning(): string {
  const random = createRandom(5)
  const points: string[] = ['330,-320']
  let x = 330
  let y = -320

  while (y < 560) {
    x += (random() - 0.55) * 70
    y += 40 + random() * 50
    points.push(`${round(x)},${round(y)}`)
  }

  const bolt = `M${points.join(' L')}`
  const fork = 'M262,150 L300,214 L288,262 L330,330 L322,392'

  return `<g class="bolt" fill="none" stroke-linejoin="round">
<path d="${bolt} ${fork}" stroke="#ff5a36" stroke-width="10" opacity="0.35"/>
<path d="${bolt} ${fork}" stroke="#ffe3d6" stroke-width="2.5"/>
</g>`
}

/** The large headstone that carries the context percentage. */
function drawContextStone(percent: number | undefined, isWarning: boolean): string {
  // Kept to plain ASCII, as every other scene known to draw in the desktop app is.
  const reading = percent === undefined ? '--' : `${Math.round(percent)}%`

  const figure = isWarning
    ? `<text class="warning" x="0" y="-62" font-size="50" font-weight="700" fill="#ff4a2e">${reading}</text>`
    : `<text x="0" y="-62" font-size="50" font-weight="700">${reading}</text>`

  return `<g transform="translate(250,884) rotate(-3)">
${isWarning ? '<ellipse class="warning" cx="0" cy="-90" rx="150" ry="150" fill="url(#alarm)"/>' : ''}
<path d="M-74,10 L-74,-120 C-74,-196 74,-196 74,-120 L74,10Z" fill="url(#stone)" stroke="#5a211a" stroke-width="2.5"/>
<path d="M-60,2 L-60,-116 C-60,-176 60,-176 60,-116 L60,2" fill="none" stroke="#3a1512" stroke-width="1.5"/>
<g fill="${BONE}" text-anchor="middle" font-family="Luminari,'Old English Text MT','Palatino Linotype',Palatino,serif">
<text x="0" y="-118" font-size="17" letter-spacing="3" opacity="0.6">R.I.P.</text>
${figure}
<text x="0" y="-32" font-size="15" letter-spacing="3" opacity="0.75">CONTEXT</text>
</g>
</g>`
}

const STYLE = `
:root{--dx:0px;--dy:0px}
.land{transform:translateY(calc(var(--dy) * -1))}
.left{transform:translateX(var(--dx))}
.right{transform:translateX(calc(var(--dx) * -1))}
.sky-left{transform:translate(var(--dx),var(--dy))}
.sky-right{transform:translate(calc(var(--dx) * -1),var(--dy))}
/* A wide window crops the top and bottom, so the land moves up and the sky pieces move down. */
@media (min-aspect-ratio:19/10){:root{--dy:110px}}
@media (min-aspect-ratio:22/10){:root{--dy:180px}}
@media (min-aspect-ratio:26/10){:root{--dy:250px}}
/* A narrow window crops the sides, so the pieces at the edges move toward the middle. */
@media (max-aspect-ratio:14/10){:root{--dx:200px}}
@media (max-aspect-ratio:115/100){:root{--dx:330px}}
@media (max-aspect-ratio:9/10){:root{--dx:440px}}
@media (max-aspect-ratio:7/10){:root{--dx:560px}.right{display:none}}
.halo{transform-origin:1330px 230px;animation:pulse 9s ease-in-out infinite}
.cloud{animation:drift 90s ease-in-out infinite alternate}
.cloud.slow{animation-duration:140s;animation-direction:alternate-reverse}
.fog{animation:drift 60s ease-in-out infinite alternate}
.fog.slow{animation-duration:85s;animation-direction:alternate-reverse}
.ember{animation:rise 14s linear infinite}
.windows{animation:flicker 5s ease-in-out infinite}
.flight{animation:fly 26s ease-in-out infinite alternate}
.flap{transform-origin:0 0;animation:flap 0.9s ease-in-out infinite}
.bolt,.flash{opacity:0;animation:strike 13s linear infinite}
.flash{animation-name:glare}
.warning{animation:warn 1.6s ease-in-out infinite}
@keyframes warn{50%{opacity:0.45}}
@keyframes pulse{50%{transform:scale(1.08);opacity:0.8}}
@keyframes drift{from{transform:translateX(-120px)}to{transform:translateX(120px)}}
@keyframes rise{0%{transform:translate(0,0);opacity:0}10%{opacity:0.9}100%{transform:translate(40px,-520px);opacity:0}}
@keyframes flicker{0%,100%{opacity:0.95}40%{opacity:0.7}55%{opacity:1}70%{opacity:0.8}}
@keyframes fly{from{transform:translate(0,0)}to{transform:translate(-160px,-50px)}}
@keyframes flap{50%{transform:scaleY(0.35)}}
@keyframes strike{0%,91%{opacity:0}92%{opacity:1}93%{opacity:0.15}94.5%{opacity:0.9}97%,100%{opacity:0}}
@keyframes glare{0%,91%{opacity:0}92%{opacity:0.16}93%{opacity:0.02}94.5%{opacity:0.12}97%,100%{opacity:0}}
@media (prefers-reduced-motion:reduce){*{animation:none !important}}
`

function buildDefinitions(stage: Stage): string {
  const sky = stage.isBlazing ? ['#050102', '#2a0406', '#7a0c0a', '#c2300f'] : ['#030203', '#1a0406', '#560b0a', '#a02c12']
  const moon = stage.isBlazing ? ['#ffb07a', '#f0301a', '#7a0806'] : ['#ff9a6a', '#d52c1b', '#5e0806']
  const haloOpacity = stage.isBlazing ? 0.72 : 0.5

  return `
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="0.45" stop-color="${sky[1]}"/><stop offset="0.78" stop-color="${sky[2]}"/><stop offset="1" stop-color="${sky[3]}"/></linearGradient>
<radialGradient id="halo"><stop offset="0.3" stop-color="#ff3b1f" stop-opacity="${haloOpacity}"/><stop offset="1" stop-color="#ff3b1f" stop-opacity="0"/></radialGradient>
<radialGradient id="moon" cx="0.38" cy="0.32" r="0.8"><stop offset="0" stop-color="${moon[0]}"/><stop offset="0.45" stop-color="${moon[1]}"/><stop offset="1" stop-color="${moon[2]}"/></radialGradient>
<radialGradient id="cloud"><stop offset="0" stop-color="#000000" stop-opacity="0.85"/><stop offset="1" stop-color="#000000" stop-opacity="0"/></radialGradient>
<radialGradient id="fog"><stop offset="0" stop-color="#c2463a" stop-opacity="${stage.fogOpacity}"/><stop offset="1" stop-color="#c2463a" stop-opacity="0"/></radialGradient>
<linearGradient id="ember" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb05a"/><stop offset="1" stop-color="#e0321c"/></linearGradient>
<linearGradient id="fire" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3c2"/><stop offset="1" stop-color="#ff6a1e"/></linearGradient>
<radialGradient id="blaze"><stop offset="0" stop-color="#ff7a2a" stop-opacity="0.4"/><stop offset="1" stop-color="#ff7a2a" stop-opacity="0"/></radialGradient>
<radialGradient id="alarm"><stop offset="0" stop-color="#ff2a12" stop-opacity="0.5"/><stop offset="1" stop-color="#ff2a12" stop-opacity="0"/></radialGradient>
<linearGradient id="stone" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a2422"/><stop offset="1" stop-color="#140a0b"/></linearGradient>
<linearGradient id="bone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a08b76"/><stop offset="1" stop-color="#3d2620"/></linearGradient>
<linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#120506"/><stop offset="0.25" stop-color="#050203"/></linearGradient>
<radialGradient id="calm" cx="0.5" cy="0.55" r="0.6"><stop offset="0" stop-color="#000000" stop-opacity="0.3"/><stop offset="1" stop-color="#000000" stop-opacity="0"/></radialGradient>
`
}

function buildScene(percent: number | undefined): string {
  const stage = stageOf(percent)
  // The lightning's rhythm is the one animation whose length depends on the stage.
  const strike = `.bolt,.flash{animation-duration:${stage.strikeSeconds}s}`
  const extraFog = stage.hasExtraFog
    ? '<g class="fog slow"><ellipse cx="300" cy="700" rx="700" ry="80" fill="url(#fog)"/><ellipse cx="1250" cy="730" rx="700" ry="74" fill="url(#fog)"/></g>'
    : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
<style>${STYLE}${strike}</style>
<defs>${buildDefinitions(stage)}</defs>
<rect x="-400" y="-600" width="2400" height="1500" fill="url(#sky)"/>
${drawStars()}
<g class="sky-right">
<circle class="halo" cx="1330" cy="230" r="300" fill="url(#halo)"/>
<circle cx="1330" cy="230" r="128" fill="url(#moon)"/>
</g>
<g class="sky-left">${drawLightning()}</g>
<rect class="flash" x="-400" y="-600" width="2400" height="2300" fill="#ff7a5a"/>
<g class="cloud"><ellipse cx="200" cy="90" rx="560" ry="130" fill="url(#cloud)"/><ellipse cx="1500" cy="40" rx="520" ry="120" fill="url(#cloud)"/></g>
<g class="cloud slow"><ellipse cx="800" cy="10" rx="700" ry="110" fill="url(#cloud)"/><ellipse cx="1180" cy="330" rx="330" ry="34" fill="url(#cloud)"/><ellipse cx="1470" cy="150" rx="260" ry="26" fill="url(#cloud)"/></g>
${drawFlock()}
<g class="land">
${drawRidge(3, 690, 250, 120, '#2a0809')}
${drawRidge(8, 740, 170, 90, '#170405')}
<g class="right">${drawCathedral(1420, 742, 0.95, stage.isBlazing)}</g>
${extraFog}
<g class="fog"><ellipse cx="500" cy="770" rx="760" ry="70" fill="url(#fog)"/><ellipse cx="1400" cy="800" rx="640" ry="60" fill="url(#fog)"/></g>
${drawRidge(15, 776, 46, 70, '#0b0304')}
<path d="M-400,816 C0,790 300,826 700,812 C1100,798 1400,830 2000,804 V1700 H-400Z" fill="url(#ground)"/>
<g class="fog slow"><ellipse cx="900" cy="838" rx="900" ry="54" fill="url(#fog)"/></g>
<g class="left">
${drawDeadTree(17, 92, 900, 560, 0.05)}
${drawCross(392, 866, 96, 6)}${drawHeadstone(452, 872, 24, 62, -8)}
${drawContextStone(percent, stage.isWarning)}
${drawRaven(236, 700, 0.85)}
</g>
<g class="right">
${drawDeadTree(44, 1600, 890, 360, -0.1)}
${drawCross(1228, 862, 110, -5)}${drawHeadstone(1300, 870, 30, 82, 5)}${drawCross(1470, 872, 78, 9)}${drawHeadstone(1168, 866, 20, 50, -10)}
${drawSkull(1368, 888, 1, -12)}${drawSkull(1420, 896, 0.82, 14)}${drawSkull(1392, 856, 0.74, 4)}
</g>
${drawEmbers(stage.emberCount)}
</g>
<rect x="-400" y="-600" width="2400" height="2300" fill="url(#calm)"/>
</svg>`
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

async function readContextPercent($: EngineInterface): Promise<number | undefined> {
  try {
    return (await $.session.usage()).context.percent
  } catch {
    // No reading is not an error worth stopping the look for: the headstone shows dashes.
    return undefined
  }
}

export const register: Register = on => {
  // The last context-window percentage the engine reported; undefined until the first reading.
  let contextPercent: number | undefined
  // Which of the scene's two names stands; it flips each time the headstone must be redrawn.
  let isAlternate = false

  // Neither a reload of this mod nor a resumed session keeps a theme, so set it at every start.
  on('session.start', async ($, e, next) => {
    const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))

    if (unpainted !== undefined) {
      $.ui.toast(unpainted)
    }

    contextPercent = await readContextPercent($)
    await $.theme.set(buildLook(isAlternate))

    return next(e)
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    // Every mod's hook hears this event, so leave another mod's scene alone.
    const isOwnScene = e.props.plugin === $.plugin.name && isOwnSceneName(e.props.scene)

    if (!isOwnScene || (e.surface !== 'desktop' && e.surface !== 'mobile')) {
      return next(e)
    }

    const { Svg } = $.ui.resolve(e)

    return (
      <Svg
        isInteractive
        alt="A graveyard under a blood moon, with dead trees, a ruined cathedral and jagged mountains"
        source={buildScene(contextPercent)}
      />
    )
  })

  // The engine measures the context window after each turn. A new whole-number
  // reading sets the look again under the scene's other name, so the app redraws.
  on('session.measure', async ($, e, next) => {
    const reading = e.context.percent
    const hasChanged =
      reading !== undefined && (contextPercent === undefined || Math.round(reading) !== Math.round(contextPercent))

    if (hasChanged) {
      contextPercent = reading
      isAlternate = !isAlternate
      await $.theme.set(buildLook(isAlternate))
    }

    return next(e)
  })
}
