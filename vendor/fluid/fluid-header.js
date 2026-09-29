/* SR008 fluid header — readable source from SR008_Interactove_Banner/src/fluid-header.js,
   wrapped as a classic script, plus a live `set()` method for sr.xp tuning. */
(() => {
/*!
 * FluidHeader — interactive “stir the paint” header banner.
 *
 * The stable-fluids velocity projection passes are adapted from
 * PavelDoGreat/WebGL-Fluid-Simulation, Copyright (c) 2017 Pavel Dobryakov,
 * licensed under the MIT License:
 * https://github.com/PavelDoGreat/WebGL-Fluid-Simulation
 *
 * The back-to-label flow map, safe-canvas bleed mapping, healing, lifecycle,
 * image loading, and embedding API are original work for this project.
 */

const DEFAULT_SOURCE_RECT = {
  x: 243 / 2286,
  y: 183 / 796,
  width: 1800 / 2286,
  height: 430 / 796,
};

const DEFAULTS = {
  image: null,
  poster: null,
  referenceSize: { width: 1800, height: 430 },
  sourceRect: DEFAULT_SOURCE_RECT,
  simResolution: 256,
  flowResolution: 512,
  dprCap: 1.5,
  maxRenderWidth: 2048,
  velocityDissipation: 4.65,
  viscosity: 1.5,
  viscosityIterations: 8,
  curl: 3.7,
  pressure: 0.8,
  pressureIterations: 20,
  splatRadius: 0.28,
  splatForce: 1500,
  maxDistortion: 0.1,
  restoreRate: 0.005,
  ambient: true,
  ambientStrength: 0.004,
  logo: null,
  logoWidth: 0.44,
  logoChromeStrength: 1.8,
  logoChromeBevel: 0.1,
  logoChromeDepth: 0.2,
  logoChromeBarWidth: 0.55,
  logoChromeBarSpacing: 1,
  logoChromeBarSlant: 0.39,
  logoChromeBarBlur: 0.18,
  logoChromeBlackBarAWidth: 2.78,
  logoChromeBlackBarABlur: 1.35,
  logoChromeBlackBarBWidth: 1.27,
  logoChromeBlackBarBBlur: 2.55,
  logoChromeGradientColor: '#e6edf5',
  logoChromeGradientOpacity: 0.79,
  logoChromeGradientWidth: 2,
  logoChromePointer: 1.15,
  logoLiquidEdgeStrength: 1.4,
  logoLiquidEdgeWidth: 0.1,
  logoLiquidEdgeSpeed: 1.65,
  logoLiquidEdgeScale: 0.75,
  logoLiquidEdgeDistortion: 0.85,
  logoLiquidEdgeContrast: 0.25,
  logoLiquidEdgeBrightness: 2,
  logoLiquidEdgeInner: 0.66,
  logoLiquidEdgeGlowOpacity: 0.33,
  logoLiquidEdgeAngle: -65,
  idleFps: 24,
  touchMode: 'horizontal',
  respectReducedMotion: true,
  fadeMs: 300,
  onReady: null,
  onFallback: null,
};

const DT_MAX = 1 / 30;
const MAX_POINTER_DELTA = 0.022;
const MAX_SPLAT_SPACING = 0.018;
const AMBIENT_INTERVAL = 0.1;
const ACTIVE_WINDOW_MS = 1200;
const MOUNTS = new WeakMap();

const VERTEX = `#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main () {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const CLEAR_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uTexture;
uniform float uValue;
in vec2 vUv;
out vec4 outColor;
void main () { outColor = texture(uTexture, vUv) * uValue; }`;

const ADVECT_VELOCITY_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uVelocity;
uniform vec2 uVelocityTexel;
uniform float uDt;
uniform float uDissipation;
in vec2 vUv;
out vec4 outColor;
void main () {
  vec2 velocity = texture(uVelocity, vUv).xy;
  vec2 halfTexel = uVelocityTexel * 0.5;
  vec2 coord = clamp(vUv - uDt * velocity * uVelocityTexel, halfTexel, 1.0 - halfTexel);
  outColor = vec4(texture(uVelocity, coord).xy / (1.0 + uDissipation * uDt), 0.0, 1.0);
}`;

const VISCOSITY_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uVelocity;
uniform vec2 uTexel;
uniform float uBlend;
in vec2 vUv;
out vec4 outColor;
void main () {
  vec2 center = texture(uVelocity, vUv).xy;
  vec2 neighbors =
    texture(uVelocity, vUv - vec2(uTexel.x, 0.0)).xy +
    texture(uVelocity, vUv + vec2(uTexel.x, 0.0)).xy +
    texture(uVelocity, vUv - vec2(0.0, uTexel.y)).xy +
    texture(uVelocity, vUv + vec2(0.0, uTexel.y)).xy;
  vec2 diffused = mix(center, neighbors * 0.25, uBlend);
  outColor = vec4(diffused, 0.0, 1.0);
}`;

const SPLAT_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uVelocity;
uniform vec2 uPoint;
uniform vec2 uImpulse;
uniform float uAspect;
uniform float uRadius;
in vec2 vUv;
out vec4 outColor;
void main () {
  vec2 p = vUv - uPoint;
  p.x *= uAspect;
  float gaussian = exp(-dot(p, p) / max(uRadius * uRadius, 0.000001));
  vec2 velocity = texture(uVelocity, vUv).xy + gaussian * uImpulse;
  outColor = vec4(velocity, 0.0, 1.0);
}`;

const CURL_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uVelocity;
uniform vec2 uTexel;
in vec2 vUv;
out vec4 outColor;
void main () {
  float l = texture(uVelocity, vUv - vec2(uTexel.x, 0.0)).y;
  float r = texture(uVelocity, vUv + vec2(uTexel.x, 0.0)).y;
  float t = texture(uVelocity, vUv + vec2(0.0, uTexel.y)).x;
  float b = texture(uVelocity, vUv - vec2(0.0, uTexel.y)).x;
  outColor = vec4(0.5 * (r - l - t + b), 0.0, 0.0, 1.0);
}`;

const VORTICITY_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform vec2 uTexel;
uniform float uCurlStrength;
uniform float uDt;
in vec2 vUv;
out vec4 outColor;
void main () {
  float l = texture(uCurl, vUv - vec2(uTexel.x, 0.0)).x;
  float r = texture(uCurl, vUv + vec2(uTexel.x, 0.0)).x;
  float t = texture(uCurl, vUv + vec2(0.0, uTexel.y)).x;
  float b = texture(uCurl, vUv - vec2(0.0, uTexel.y)).x;
  float c = texture(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(t) - abs(b), abs(r) - abs(l));
  force /= length(force) + 0.0001;
  force *= uCurlStrength * c;
  force.y *= -1.0;
  vec2 velocity = texture(uVelocity, vUv).xy + force * uDt;
  outColor = vec4(clamp(velocity, vec2(-1000.0), vec2(1000.0)), 0.0, 1.0);
}`;

const DIVERGENCE_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uVelocity;
uniform vec2 uTexel;
in vec2 vUv;
out vec4 outColor;
void main () {
  vec2 center = texture(uVelocity, vUv).xy;
  vec2 uvL = vUv - vec2(uTexel.x, 0.0);
  vec2 uvR = vUv + vec2(uTexel.x, 0.0);
  vec2 uvT = vUv + vec2(0.0, uTexel.y);
  vec2 uvB = vUv - vec2(0.0, uTexel.y);
  float l = uvL.x < 0.0 ? -center.x : texture(uVelocity, uvL).x;
  float r = uvR.x > 1.0 ? -center.x : texture(uVelocity, uvR).x;
  float t = uvT.y > 1.0 ? -center.y : texture(uVelocity, uvT).y;
  float b = uvB.y < 0.0 ? -center.y : texture(uVelocity, uvB).y;
  outColor = vec4(0.5 * (r - l + t - b), 0.0, 0.0, 1.0);
}`;

const PRESSURE_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
uniform vec2 uTexel;
in vec2 vUv;
out vec4 outColor;
void main () {
  float l = texture(uPressure, vUv - vec2(uTexel.x, 0.0)).x;
  float r = texture(uPressure, vUv + vec2(uTexel.x, 0.0)).x;
  float t = texture(uPressure, vUv + vec2(0.0, uTexel.y)).x;
  float b = texture(uPressure, vUv - vec2(0.0, uTexel.y)).x;
  float divergence = texture(uDivergence, vUv).x;
  outColor = vec4((l + r + t + b - divergence) * 0.25, 0.0, 0.0, 1.0);
}`;

const GRADIENT_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
uniform vec2 uTexel;
in vec2 vUv;
out vec4 outColor;
void main () {
  float l = texture(uPressure, vUv - vec2(uTexel.x, 0.0)).x;
  float r = texture(uPressure, vUv + vec2(uTexel.x, 0.0)).x;
  float t = texture(uPressure, vUv + vec2(0.0, uTexel.y)).x;
  float b = texture(uPressure, vUv - vec2(0.0, uTexel.y)).x;
  vec2 velocity = texture(uVelocity, vUv).xy - vec2(r - l, t - b);
  outColor = vec4(velocity, 0.0, 1.0);
}`;

const ADVECT_FLOW_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uVelocity;
uniform sampler2D uFlow;
uniform vec2 uVelocityTexel;
uniform vec2 uFlowTexel;
uniform vec2 uFlowMin;
uniform vec2 uFlowMax;
uniform float uAspect;
uniform float uMaxDistortion;
uniform float uDt;
uniform float uRestore;
in vec2 vUv;
out vec4 outColor;
void main () {
  vec2 velocity = texture(uVelocity, vUv).xy;
  vec2 halfTexel = uFlowTexel * 0.5;
  vec2 coord = clamp(vUv - uDt * velocity * uVelocityTexel, halfTexel, 1.0 - halfTexel);
  vec2 displacement = texture(uFlow, coord).xy + coord - vUv;
  displacement *= 1.0 - uRestore;

  // Limit the visible pull in screen-space so repeated mouse sweeps bend the
  // artwork like heavy lacquer instead of stretching it like elastic.
  vec2 screenDisplacement = vec2(displacement.x * uAspect, displacement.y);
  float distance = length(screenDisplacement);
  float limit = max(uMaxDistortion, 0.0001);
  displacement *= limit * tanh(distance / limit) / max(distance, 0.0001);

  // Ease into the bleed limits instead of hard-clamping many neighboring
  // samples to one source pixel. That preserves a continuous lacquer fold
  // during unusually fast or long pointer sweeps and avoids flat edge streaks.
  vec2 lowerRoom = max(vUv - uFlowMin, vec2(0.0001));
  vec2 upperRoom = max(uFlowMax - vUv, vec2(0.0001));
  vec2 room = mix(lowerRoom, upperRoom, step(vec2(0.0), displacement));
  displacement = room * tanh(displacement / room);
  outColor = vec4(displacement, 0.0, 1.0);
}`;

const DISPLAY_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uFlow;
uniform sampler2D uSource;
uniform sampler2D uLogo;
uniform vec2 uSourceMin;
uniform vec2 uSourceScale;
uniform vec2 uSourceTexel;
uniform vec2 uPointer;
uniform vec2 uLogoTexel;
uniform float uCanvasAspect;
uniform float uLogoAspect;
uniform float uLogoWidth;
uniform float uLogoChromeStrength;
uniform float uLogoChromeBevel;
uniform float uLogoChromeDepth;
uniform float uLogoChromeBarWidth;
uniform float uLogoChromeBarSpacing;
uniform float uLogoChromeBarSlant;
uniform float uLogoChromeBarBlur;
uniform float uLogoChromeBlackBarAWidth;
uniform float uLogoChromeBlackBarABlur;
uniform float uLogoChromeBlackBarBWidth;
uniform float uLogoChromeBlackBarBBlur;
uniform vec3 uLogoChromeGradientColor;
uniform float uLogoChromeGradientOpacity;
uniform float uLogoChromeGradientWidth;
uniform float uLogoChromePointer;
uniform float uLogoLiquidEdgeStrength;
uniform float uLogoLiquidEdgeWidth;
uniform float uLogoLiquidEdgeSpeed;
uniform float uLogoLiquidEdgeScale;
uniform float uLogoLiquidEdgeDistortion;
uniform float uLogoLiquidEdgeContrast;
uniform float uLogoLiquidEdgeBrightness;
uniform float uLogoLiquidEdgeInner;
uniform float uLogoLiquidEdgeGlowOpacity;
uniform float uLogoLiquidEdgeAngle;
uniform float uTime;
in vec2 vUv;
out vec4 outColor;

float logoAlphaAt (vec2 logoUv) {
  float inside = step(0.0, logoUv.x) * step(logoUv.x, 1.0)
    * step(0.0, logoUv.y) * step(logoUv.y, 1.0);
  return texture(uLogo, clamp(logoUv, 0.0, 1.0)).a * inside;
}

vec4 sampleLogo (vec2 canvasUv, out vec2 logoUv) {
  float width = clamp(uLogoWidth, 0.05, 0.9);
  float height = width * uCanvasAspect / max(uLogoAspect, 0.001);
  logoUv = (canvasUv - 0.5) / vec2(width, height) + 0.5;
  float inside = step(0.0, logoUv.x) * step(logoUv.x, 1.0)
    * step(0.0, logoUv.y) * step(logoUv.y, 1.0);
  return texture(uLogo, clamp(logoUv, 0.0, 1.0)) * inside;
}

float reflectionBar (float coordinate, float center, float width, float blur) {
  float distance = abs(coordinate - center);
  float antialias = max(fwidth(distance) * 0.75, 0.0005);
  float halfWidth = clamp(0.060 * uLogoChromeBarWidth * width, antialias, 0.24);
  float blurScale = max(0.1, uLogoChromeBarBlur / 0.18);
  float softness = clamp(blur * blurScale / 5.0, 0.0, 1.0);
  float feather = mix(antialias, max(antialias, halfWidth * 0.98), softness);
  return 1.0 - smoothstep(max(0.0, halfWidth - feather), halfWidth, distance);
}

float liquidHash (vec2 point) {
  vec3 point3 = fract(vec3(point.xyx) * 0.1031);
  point3 += dot(point3, point3.yzx + 33.33);
  return fract((point3.x + point3.y) * point3.z);
}

float liquidNoise (vec2 point) {
  vec2 cell = floor(point);
  vec2 local = fract(point);
  local = local * local * (3.0 - 2.0 * local);
  return mix(
    mix(liquidHash(cell), liquidHash(cell + vec2(1.0, 0.0)), local.x),
    mix(liquidHash(cell + vec2(0.0, 1.0)), liquidHash(cell + vec2(1.0)), local.x),
    local.y
  );
}

float liquidFbm (vec2 point) {
  float value = 0.0;
  float amplitude = 0.55;
  mat2 octave = mat2(1.63, 1.17, -1.17, 1.63);
  for (int index = 0; index < 4; index++) {
    value += amplitude * liquidNoise(point);
    point = octave * point + vec2(2.7, 5.1);
    amplitude *= 0.48;
  }
  return value;
}

void logoMorphology (
  vec2 logoUv,
  vec2 radius,
  out float center,
  out float eroded,
  out float dilated
) {
  center = logoAlphaAt(logoUv);
  float left = logoAlphaAt(logoUv - vec2(radius.x, 0.0));
  float right = logoAlphaAt(logoUv + vec2(radius.x, 0.0));
  float bottom = logoAlphaAt(logoUv - vec2(0.0, radius.y));
  float top = logoAlphaAt(logoUv + vec2(0.0, radius.y));
  vec2 diagonal = radius * 0.72;
  float lowerLeft = logoAlphaAt(logoUv - diagonal);
  float upperRight = logoAlphaAt(logoUv + diagonal);
  float lowerRight = logoAlphaAt(logoUv + vec2(diagonal.x, -diagonal.y));
  float upperLeft = logoAlphaAt(logoUv + vec2(-diagonal.x, diagonal.y));
  eroded = min(center, min(min(left, right), min(bottom, top)));
  eroded = min(eroded, min(min(lowerLeft, upperRight), min(lowerRight, upperLeft)));
  dilated = max(center, max(max(left, right), max(bottom, top)));
  dilated = max(dilated, max(max(lowerLeft, upperRight), max(lowerRight, upperLeft)));
}

float liquidEdgeMask (vec2 logoUv) {
  vec2 radius = uLogoTexel * (0.8 + 2.4 * max(0.0, uLogoLiquidEdgeWidth));
  float center;
  float eroded;
  float dilated;
  logoMorphology(logoUv, radius, center, eroded, dilated);
  // Keep the animated metal entirely inside the SVG silhouette so it overlays
  // the approved chrome bevel without adding an exterior halo.
  float innerStroke = max(0.0, center - eroded);
  return smoothstep(0.04, 0.92, innerStroke)
    * clamp(uLogoLiquidEdgeInner, 0.0, 1.0);
}

float liquidEdgeGlowMask (vec2 logoUv) {
  float width = max(0.0, uLogoLiquidEdgeWidth);
  vec2 nearRadius = uLogoTexel * (3.6 + 3.2 * width);
  vec2 farRadius = uLogoTexel * (8.0 + 6.4 * width);
  float center;
  float eroded;
  float dilated;
  logoMorphology(logoUv, nearRadius, center, eroded, dilated);
  float nearGlow = smoothstep(0.02, 0.88, max(0.0, dilated - eroded));
  logoMorphology(logoUv, farRadius, center, eroded, dilated);
  float farGlow = smoothstep(0.02, 0.92, max(0.0, dilated - eroded));
  return clamp(nearGlow * 0.58 + farGlow * 0.22, 0.0, 1.0);
}

vec3 liquidMetalEdge (vec2 logoUv) {
  float time = uTime * max(0.0, uLogoLiquidEdgeSpeed);
  vec2 pointer = (uPointer - vec2(0.5)) * vec2(0.8, 0.35);
  float scale = max(0.15, uLogoLiquidEdgeScale);
  float angle = uLogoLiquidEdgeAngle;
  mat2 rotation = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
  vec2 point = rotation * ((logoUv - 0.5) * vec2(8.4, 3.4) * scale)
    + pointer + 0.5;
  vec2 drift = vec2(time * 0.17, -time * 0.11);
  vec2 warp = vec2(
    liquidFbm(point * 0.72 + drift),
    liquidFbm(point * 0.72 - drift + vec2(7.3, 2.1))
  );
  float distortion = max(0.0, uLogoLiquidEdgeDistortion);
  float field = liquidFbm(point + (warp - 0.5) * 2.8 * distortion + drift * 0.65);
  field += 0.24 * sin(point.x * 1.35 + point.y * 0.72 + warp.y * 5.2 * distortion - time * 0.82);
  field += 0.16 * sin(point.x * -0.64 + point.y * 2.1 + warp.x * 4.4 * distortion + time * 0.57);
  float reflection = 0.5 + 0.5 * sin(field * 8.2 + time * 0.36);
  float secondary = 0.5 + 0.5 * cos(field * 13.6 - time * 0.24 + warp.x * 2.7);
  float tone = clamp(reflection * 0.72 + secondary * 0.28, 0.0, 1.0);
  tone = clamp((tone - 0.5) * max(0.05, uLogoLiquidEdgeContrast) + 0.5, 0.0, 1.0);

  vec3 metal = mix(vec3(0.008, 0.012, 0.018), vec3(0.31, 0.37, 0.44), smoothstep(0.08, 0.47, tone));
  metal = mix(metal, vec3(0.92, 0.97, 1.0), smoothstep(0.47, 0.70, tone));
  metal = mix(metal, vec3(1.0), smoothstep(0.78, 0.92, tone));
  metal += vec3(0.42, 0.50, 0.62) * pow(max(0.0, 1.0 - abs(tone - 0.68) * 8.0), 2.0);
  return clamp(metal * max(0.0, uLogoLiquidEdgeBrightness), 0.0, 1.0);
}

vec3 chromeSurface (vec2 logoUv, vec2 canvasUv) {
  float strength = max(0.0, uLogoChromeStrength);
  float pointerResponse = clamp(uLogoChromePointer, 0.0, 1.6);
  vec2 trackedPointer = vec2(0.5) + (uPointer - vec2(0.5)) * pointerResponse;
  vec2 bevelStep = uLogoTexel * (4.5 + 1.5 * min(strength, 1.8))
    * max(0.2, uLogoChromeBevel);
  float alphaL = texture(uLogo, logoUv - vec2(bevelStep.x, 0.0)).a;
  float alphaR = texture(uLogo, logoUv + vec2(bevelStep.x, 0.0)).a;
  float alphaB = texture(uLogo, logoUv - vec2(0.0, bevelStep.y)).a;
  float alphaT = texture(uLogo, logoUv + vec2(0.0, bevelStep.y)).a;
  float inset = min(min(alphaL, alphaR), min(alphaB, alphaT));
  float bevel = clamp(1.0 - inset, 0.0, 1.0);
  vec2 edgeGradient = vec2(alphaL - alphaR, alphaB - alphaT);
  vec3 surfaceNormal = normalize(vec3(edgeGradient * 2.4, max(0.16, inset)));

  // Two straight black reflection bars move as one rigid reflected environment
  // when the pointer moves, keeping the SVG crisp and dimensional.
  float slant = uLogoChromeBarSlant;
  float barCoordinate = (logoUv.x + logoUv.y * slant - min(0.0, slant))
    / (1.0 + abs(slant));
  barCoordinate -= (trackedPointer.x - 0.5) * 0.22
    + (trackedPointer.y - 0.5) * 0.08;
  float separation = mix(
    0.18,
    0.62,
    clamp((uLogoChromeBarSpacing - 0.5) / 1.5, 0.0, 1.0)
  );
  float blackBarA = reflectionBar(
    barCoordinate, 0.5 - separation * 0.5,
    uLogoChromeBlackBarAWidth, uLogoChromeBlackBarABlur
  );
  float blackBarB = reflectionBar(
    barCoordinate, 0.5 + separation * 0.5,
    uLogoChromeBlackBarBWidth, uLogoChromeBlackBarBBlur
  );
  float whiteTrailA = reflectionBar(
    barCoordinate,
    0.5 - separation * 0.5 + 0.075 + uLogoChromeBlackBarAWidth * 0.02,
    max(0.7, uLogoChromeBlackBarAWidth * 1.1),
    1.2
  );
  float whiteTrailB = reflectionBar(
    barCoordinate,
    0.5 + separation * 0.5 + 0.075 + uLogoChromeBlackBarBWidth * 0.02,
    max(0.7, uLogoChromeBlackBarBWidth * 1.1),
    1.2
  );
  vec3 deepChrome = vec3(0.012);
  float baseSheen = smoothstep(-0.58, 0.72, (logoUv.x - 0.5) - (logoUv.y - 0.5) * 0.32);
  vec3 chrome = mix(vec3(0.72), vec3(0.96), baseSheen);
  chrome = mix(chrome, vec3(1.0), whiteTrailA * 0.94);
  chrome = mix(chrome, vec3(1.0), whiteTrailB * 0.92);
  chrome = mix(chrome, deepChrome, blackBarA * 0.98);
  chrome = mix(chrome, deepChrome, blackBarB * 0.95);

  vec2 pointerOffset = (trackedPointer - vec2(0.5)) * vec2(uCanvasAspect, 1.0);
  vec3 lightDirection = normalize(vec3(vec2(0.32, -0.22) + pointerOffset * 0.35, 0.78));
  float bevelLight = 0.5 + 0.5 * dot(surfaceNormal, lightDirection);
  vec3 bevelChrome = mix(deepChrome, vec3(1.0), pow(bevelLight, 0.62));
  chrome = mix(chrome, bevelChrome, bevel * 0.82);
  chrome += vec3(1.0) * bevel * pow(max(surfaceNormal.y, 0.0), 2.0) * 0.10;

  // A final broad color wash sits above the chrome, bars, and bevel. Width is
  // expressed relative to the logo so it remains consistent at every size.
  float gradientCoordinate = (logoUv.x - 0.5)
    + (logoUv.y - 0.5) * uLogoChromeBarSlant
    - (trackedPointer.x - 0.5) * 0.18;
  float gradientHalfWidth = clamp(0.34 * uLogoChromeGradientWidth, 0.012, 1.2);
  float gradientLayer = 1.0 - smoothstep(0.0, gradientHalfWidth, abs(gradientCoordinate));
  chrome = mix(
    chrome,
    uLogoChromeGradientColor,
    gradientLayer * clamp(uLogoChromeGradientOpacity, 0.0, 1.0)
  );
  return clamp(mix(vec3(0.45), chrome, min(strength, 1.8)), 0.0, 1.0);
}

void main () {
  vec2 flow = vUv + texture(uFlow, vUv).xy;
  vec2 sourceUv = uSourceMin + flow * uSourceScale;
  vec2 halfTexel = uSourceTexel * 0.5;
  // sr.xp patch: mirror past the image edge instead of clamping, so warped
  // samples near an edge show more paint rather than smeared edge-pixel streaks.
  sourceUv = 1.0 - abs(mod(sourceUv, 2.0) - 1.0);
  sourceUv = clamp(sourceUv, halfTexel, 1.0 - halfTexel);
  vec3 color = texture(uSource, sourceUv).rgb;
  vec2 logoUv;
  vec4 logo = sampleLogo(vUv, logoUv);
  vec2 depthStep = uLogoTexel * vec2(1.35, 2.15) * max(0.0, uLogoChromeDepth);
  float extrusion = 0.0;
  for (int i = 1; i <= 6; i++) {
    vec2 depthUv = logoUv + depthStep * float(i);
    float depthInside = step(0.0, depthUv.x) * step(depthUv.x, 1.0)
      * step(0.0, depthUv.y) * step(depthUv.y, 1.0);
    extrusion = max(extrusion, texture(uLogo, clamp(depthUv, 0.0, 1.0)).a * depthInside);
  }
  float depthBounds = step(-0.08, logoUv.x) * step(logoUv.x, 1.08)
    * step(-0.12, logoUv.y) * step(logoUv.y, 1.12);
  float extrusionOnly = max(0.0, extrusion * depthBounds - logo.a);
  vec3 depthColor = mix(vec3(0.008), vec3(0.14), logoUv.y * 0.24);
  color = mix(color, depthColor, extrusionOnly * 0.96);
  color = mix(color, chromeSurface(logoUv, vUv), logo.a);
  vec3 edgeMetal = liquidMetalEdge(logoUv);
  float edge = liquidEdgeMask(logoUv) * clamp(uLogoLiquidEdgeStrength, 0.0, 1.4);
  color = mix(color, edgeMetal, clamp(edge, 0.0, 1.0));
  float edgeHighlight = smoothstep(0.58, 0.96, dot(edgeMetal, vec3(0.2126, 0.7152, 0.0722)));
  float glow = liquidEdgeGlowMask(logoUv)
    * edgeHighlight
    * clamp(uLogoLiquidEdgeStrength, 0.0, 1.0)
    * clamp(uLogoLiquidEdgeInner, 0.0, 1.0)
    * clamp(uLogoLiquidEdgeGlowOpacity, 0.0, 1.0);
  vec3 glowColor = mix(edgeMetal, vec3(1.0), 0.38);
  color = 1.0 - (1.0 - color) * (1.0 - glowColor * glow);
  outColor = vec4(color, 1.0);
}`;

function mergeOptions (options) {
  return {
    ...DEFAULTS,
    ...options,
    referenceSize: { ...DEFAULTS.referenceSize, ...(options.referenceSize || {}) },
    sourceRect: { ...DEFAULTS.sourceRect, ...(options.sourceRect || {}) },
  };
}

function parseHexColor (value) {
  const match = /^#?([\da-f]{6})$/i.exec(String(value || ''));
  if (!match) return [1, 1, 1];
  const integer = Number.parseInt(match[1], 16);
  return [
    ((integer >> 16) & 255) / 255,
    ((integer >> 8) & 255) / 255,
    (integer & 255) / 255,
  ];
}

function callback (fn, payload) {
  if (typeof fn !== 'function') return;
  try { fn(payload); } catch (_) { /* callbacks cannot break the poster fallback */ }
}

function getImageCandidates (image) {
  if (typeof image === 'string') return [image];
  if (!image) return [];
  return [image.avif, image.webp, image.png].filter(Boolean);
}

async function loadFirstImage (urls) {
  let finalError = null;
  for (const url of urls) {
    try {
      const image = new Image();
      image.decoding = 'async';
      image.fetchPriority = 'high';
      const resolved = new URL(url, location.href);
      if (resolved.origin !== location.origin) image.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error(`Unable to load ${url}`));
        image.src = url;
      });
      if (typeof image.decode === 'function') await image.decode().catch(() => {});
      return image;
    } catch (error) {
      finalError = error;
    }
  }
  throw finalError || new Error('No image candidate could be loaded');
}

function fieldSize (longestSide, width, height) {
  const aspect = width / Math.max(height, 1);
  if (width >= height) {
    return { width: longestSide, height: Math.max(8, Math.round(longestSide / aspect)) };
  }
  return { width: Math.max(8, Math.round(longestSide * aspect)), height: longestSide };
}

function mount (container, options = {}) {
  if (!(container instanceof Element)) throw new TypeError('FluidHeader.mount requires a container element');
  const existing = MOUNTS.get(container);
  if (existing) return existing;

  const cfg = mergeOptions(options);
  const originalStyle = {
    position: container.style.position,
    overflow: container.style.overflow,
    aspectRatio: container.style.aspectRatio,
    touchAction: container.style.touchAction,
    backgroundImage: container.style.backgroundImage,
    backgroundSize: container.style.backgroundSize,
    backgroundPosition: container.style.backgroundPosition,
    backgroundRepeat: container.style.backgroundRepeat,
  };

  let canvas = null;
  let gl = null;
  let parallelExt = null;
  let vao = null;
  let quadBuffer = null;
  let programs = null;
  let sourceTexture = null;
  let sourceImage = null;
  let logoTexture = null;
  let logoImage = null;
  let velocity = null;
  let pressure = null;
  let divergence = null;
  let curlField = null;
  let flow = null;
  let io = null;
  let ro = null;
  let resizeRaf = 0;
  let rafId = 0;
  let lastStep = 0;
  let lastDraw = 0;
  let lastInteraction = 0;
  let contextRestoreAttempts = 0;
  let contextLost = false;
  let initialized = false;
  let initializing = false;
  let inView = false;
  let destroyed = false;
  let permanentFallback = false;
  let shown = false;
  let ambientTime = Math.random() * 1000;
  let ambientAccumulator = 0;
  const shaderStartTime = performance.now();
  const chromePointer = { x: 0.5, y: 0.5 };

  const pointers = new Map();
  const splats = [];
  const removers = [];
  const stirrers = [
    { cx: 0.31, cy: 0.50, ax: 0.24, ay: 0.28, fx: 0.22, fy: 0.17, px: 0.4, py: 2.1 },
    { cx: 0.69, cy: 0.50, ax: 0.22, ay: 0.30, fx: 0.16, fy: 0.25, px: 2.7, py: 0.7 },
  ];

  const stats = {
    status: 'poster',
    frames: 0,
    drawWidth: 0,
    drawHeight: 0,
    simWidth: 0,
    simHeight: 0,
    flowWidth: 0,
    flowHeight: 0,
    imageUrl: null,
    logoUrl: null,
    logoStatus: cfg.logo ? 'loading' : 'disabled',
  };

  const instance = {
    stats,
    destroy,
    // sr.xp patch: live-tune any option (e.g. sourceRect, curl) without remounting.
    set (partial = {}) {
      for (const [key, value] of Object.entries(partial)) {
        cfg[key] = key === 'sourceRect' ? { ...cfg.sourceRect, ...value } : value;
      }
      lastInteraction = performance.now();
      updateRunning();
    },
    get config () { return { ...cfg, sourceRect: { ...cfg.sourceRect } }; },
  };

  MOUNTS.set(container, instance);
  prepareContainer();

  const earlyReason = initialFallbackReason();
  if (earlyReason) {
    notifyFallback(earlyReason);
    return instance;
  }

  listen(document, 'visibilitychange', updateRunning);
  bindPointerEvents();

  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver((entries) => {
      const entry = entries.find((item) => item.target === container);
      if (!entry) return;
      inView = entry.isIntersecting;
      if (inView && !initialized && !initializing) initialize();
      updateRunning();
    }, { rootMargin: '64px' });
    io.observe(container);
  } else {
    inView = true;
    initialize();
  }

  return instance;

  function prepareContainer () {
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    container.style.overflow = 'hidden';
    if (!container.style.aspectRatio) {
      container.style.aspectRatio = `${cfg.referenceSize.width} / ${cfg.referenceSize.height}`;
    }
    container.style.touchAction = cfg.touchMode === 'full' ? 'none' : 'pan-y';
    if (cfg.poster) {
      container.style.backgroundImage = `url("${String(cfg.poster).replaceAll('"', '\\"')}")`;
      container.style.backgroundSize = 'cover';
      container.style.backgroundPosition = 'center';
      container.style.backgroundRepeat = 'no-repeat';
    }
  }

  function restoreContainer () {
    Object.assign(container.style, originalStyle);
  }

  function initialFallbackReason () {
    if (!getImageCandidates(cfg.image).length) return 'no-image';
    if (!('WebGL2RenderingContext' in window)) return 'no-webgl2';
    if (cfg.respectReducedMotion && matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return 'reduced-motion';
    }
    if (navigator.connection?.saveData) return 'save-data';
    return null;
  }

  function listen (target, type, handler, optionsValue) {
    target.addEventListener(type, handler, optionsValue);
    removers.push(() => target.removeEventListener(type, handler, optionsValue));
  }

  function notifyFallback (reason, error) {
    if (destroyed || permanentFallback) return;
    permanentFallback = true;
    stats.status = 'fallback';
    stopLoop();
    if (canvas) canvas.style.opacity = '0';
    releaseResources();
    callback(cfg.onFallback, { reason, error });
  }

  async function initialize () {
    if (initializing || initialized || destroyed || permanentFallback) return;
    initializing = true;
    stats.status = 'loading';
    try {
      createCanvas();
      createContext();
      createQuad();
      programs = await createPrograms();
      if (destroyed || permanentFallback) return;
      const [loadedSource, loadedLogo] = await Promise.all([
        loadFirstImage(getImageCandidates(cfg.image)),
        cfg.logo
          ? loadFirstImage(getImageCandidates(cfg.logo)).catch(() => null)
          : Promise.resolve(null),
      ]);
      sourceImage = loadedSource;
      logoImage = loadedLogo;
      if (destroyed || permanentFallback) return;
      stats.imageUrl = sourceImage.currentSrc || sourceImage.src;
      stats.logoUrl = logoImage ? logoImage.currentSrc || logoImage.src : null;
      stats.logoStatus = logoImage ? 'ready' : cfg.logo ? 'unavailable' : 'disabled';
      uploadSource(sourceImage);
      uploadLogo(logoImage);
      sizeCanvas();
      allocateFields();
      render();
      initialized = true;
      initializing = false;
      stats.status = 'ready';
      if ('ResizeObserver' in window) {
        ro = new ResizeObserver(scheduleResize);
        ro.observe(container);
      } else {
        listen(window, 'resize', scheduleResize, { passive: true });
      }
      reveal();
      updateRunning();
    } catch (error) {
      initializing = false;
      const message = String(error?.message || '').toLowerCase();
      notifyFallback(message.includes('load') || message.includes('image') ? 'image' : 'webgl2', error);
    }
  }

  function createCanvas () {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = [
      'position:absolute',
      'inset:0',
      'width:100%',
      'height:100%',
      'display:block',
      'pointer-events:none',
      'opacity:0',
      `transition:opacity ${Math.max(0, cfg.fadeMs)}ms ease`,
    ].join(';');
    container.insertBefore(canvas, container.firstChild);
    listen(canvas, 'webglcontextlost', onContextLost);
    listen(canvas, 'webglcontextrestored', onContextRestored);
  }

  function createContext () {
    gl = canvas.getContext('webgl2', {
      alpha: false,
      depth: false,
      stencil: false,
      antialias: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('webgl2 unavailable');
    if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('half-float render targets unavailable');
    parallelExt = gl.getExtension('KHR_parallel_shader_compile');
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 0);
    probeHalfFloatFramebuffer();
  }

  function probeHalfFloatFramebuffer () {
    const texture = gl.createTexture();
    const fbo = gl.createFramebuffer();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, 4, 4, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fbo);
    gl.deleteTexture(texture);
    if (!complete) throw new Error('half-float framebuffer incomplete');
  }

  function createQuad () {
    vao = gl.createVertexArray();
    quadBuffer = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  function compileShader (type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`shader compile failed: ${message}`);
    }
    return shader;
  }

  function linkProgram (vertexShader, fragmentSource) {
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.bindAttribLocation(program, 0, 'aPosition');
    gl.linkProgram(program);
    return { program, fragmentShader, uniforms: null };
  }

  async function createPrograms () {
    const vertexShader = compileShader(gl.VERTEX_SHADER, VERTEX);
    const sources = {
      clear: CLEAR_FRAG,
      advectVelocity: ADVECT_VELOCITY_FRAG,
      viscosity: VISCOSITY_FRAG,
      splat: SPLAT_FRAG,
      curl: CURL_FRAG,
      vorticity: VORTICITY_FRAG,
      divergence: DIVERGENCE_FRAG,
      pressure: PRESSURE_FRAG,
      gradient: GRADIENT_FRAG,
      advectFlow: ADVECT_FLOW_FRAG,
      display: DISPLAY_FRAG,
    };
    const result = Object.fromEntries(
      Object.entries(sources).map(([name, source]) => [name, linkProgram(vertexShader, source)]),
    );

    if (parallelExt) {
      let complete = false;
      while (!complete) {
        complete = Object.values(result).every((item) =>
          gl.getProgramParameter(item.program, parallelExt.COMPLETION_STATUS_KHR));
        if (!complete) await new Promise(requestAnimationFrame);
      }
    }

    for (const item of Object.values(result)) {
      if (!gl.getProgramParameter(item.program, gl.LINK_STATUS)) {
        throw new Error(`program link failed: ${gl.getProgramInfoLog(item.program)}`);
      }
      item.uniforms = {};
      const count = gl.getProgramParameter(item.program, gl.ACTIVE_UNIFORMS);
      for (let index = 0; index < count; index++) {
        const name = gl.getActiveUniform(item.program, index).name;
        item.uniforms[name] = gl.getUniformLocation(item.program, name);
      }
      item.bind = () => gl.useProgram(item.program);
      gl.detachShader(item.program, item.fragmentShader);
      gl.deleteShader(item.fragmentShader);
      delete item.fragmentShader;
    }
    gl.deleteShader(vertexShader);
    return result;
  }

  function uploadSource (image) {
    if (sourceTexture) gl.deleteTexture(sourceTexture);
    sourceTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }

  function uploadLogo (image) {
    if (logoTexture) gl.deleteTexture(logoTexture);
    logoTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, logoTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    if (image) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    } else {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array([0, 0, 0, 0]),
      );
    }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }

  function createFbo (width, height, filter = gl.LINEAR) {
    const texture = gl.createTexture();
    const fbo = gl.createFramebuffer();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error('framebuffer incomplete');
    }
    gl.viewport(0, 0, width, height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return {
      texture,
      fbo,
      width,
      height,
      texelX: 1 / width,
      texelY: 1 / height,
      attach (unit) {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        return unit;
      },
    };
  }

  function createDoubleFbo (width, height, filter) {
    let read = createFbo(width, height, filter);
    let write = createFbo(width, height, filter);
    return {
      width,
      height,
      texelX: 1 / width,
      texelY: 1 / height,
      get read () { return read; },
      get write () { return write; },
      swap () { [read, write] = [write, read]; },
      release () { deleteFbo(read); deleteFbo(write); },
    };
  }

  function deleteFbo (target) {
    if (!target || !gl) return;
    gl.deleteTexture(target.texture);
    gl.deleteFramebuffer(target.fbo);
  }

  function bindTarget (target) {
    if (target) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      gl.viewport(0, 0, target.width, target.height);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
  }

  function draw (program, target) {
    program.bind();
    bindTarget(target);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  function attachTexture (texture, unit) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    return unit;
  }

  function sizeCanvas () {
    const rect = container.getBoundingClientRect();
    const cssWidth = Math.max(1, rect.width || container.clientWidth || cfg.referenceSize.width);
    const cssHeight = Math.max(1, rect.height || container.clientHeight || cssWidth /
      (cfg.referenceSize.width / cfg.referenceSize.height));
    const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), cfg.dprCap);
    let width = Math.round(cssWidth * dpr);
    let height = Math.round(cssHeight * dpr);
    const maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const scale = Math.min(1, cfg.maxRenderWidth / width, maxTexture / width, maxTexture / height);
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
    const changed = canvas.width !== width || canvas.height !== height;
    canvas.width = width;
    canvas.height = height;
    stats.drawWidth = width;
    stats.drawHeight = height;
    return changed;
  }

  function allocateFields () {
    releaseFields();
    const sim = fieldSize(cfg.simResolution, canvas.width, canvas.height);
    const flowSize = fieldSize(cfg.flowResolution, canvas.width, canvas.height);
    velocity = createDoubleFbo(sim.width, sim.height, gl.LINEAR);
    pressure = createDoubleFbo(sim.width, sim.height, gl.NEAREST);
    divergence = createFbo(sim.width, sim.height, gl.NEAREST);
    curlField = createFbo(sim.width, sim.height, gl.NEAREST);
    flow = createDoubleFbo(flowSize.width, flowSize.height, gl.LINEAR);
    stats.simWidth = sim.width;
    stats.simHeight = sim.height;
    stats.flowWidth = flowSize.width;
    stats.flowHeight = flowSize.height;
  }

  function releaseFields () {
    velocity?.release();
    pressure?.release();
    flow?.release();
    deleteFbo(divergence);
    deleteFbo(curlField);
    velocity = pressure = divergence = curlField = flow = null;
  }

  function sourceBounds () {
    const rect = cfg.sourceRect;
    return {
      minX: -rect.x / rect.width,
      minY: -rect.y / rect.height,
      maxX: (1 - rect.x) / rect.width,
      maxY: (1 - rect.y) / rect.height,
    };
  }

  function applyQueuedSplats () {
    if (!splats.length) return;
    const program = programs.splat;
    const uniforms = program.uniforms;
    program.bind();
    gl.uniform1f(uniforms.uAspect, canvas.width / Math.max(canvas.height, 1));
    gl.uniform1f(uniforms.uRadius, Math.max(0.001, cfg.splatRadius));
    for (const splat of splats.splice(0)) {
      gl.uniform1i(uniforms.uVelocity, velocity.read.attach(0));
      gl.uniform2f(uniforms.uPoint, splat.x, splat.y);
      gl.uniform2f(uniforms.uImpulse, splat.dx, splat.dy);
      draw(program, velocity.write);
      velocity.swap();
    }
  }

  function updateAmbient (dt) {
    if (!cfg.ambient) return;
    ambientTime += dt;
    ambientAccumulator += dt;
    if (ambientAccumulator < AMBIENT_INTERVAL) return;
    const interval = ambientAccumulator;
    ambientAccumulator = 0;
    const force = cfg.splatForce * cfg.ambientStrength * interval;
    for (const stirrer of stirrers) {
      const x = stirrer.cx + stirrer.ax * Math.sin(stirrer.fx * ambientTime + stirrer.px);
      const y = stirrer.cy + stirrer.ay * Math.sin(stirrer.fy * ambientTime + stirrer.py);
      const dx = stirrer.ax * stirrer.fx * Math.cos(stirrer.fx * ambientTime + stirrer.px) * force;
      const dy = stirrer.ay * stirrer.fy * Math.cos(stirrer.fy * ambientTime + stirrer.py) * force;
      splats.push({ x, y, dx, dy });
    }
  }

  function step (dt) {
    const texelX = velocity.texelX;
    const texelY = velocity.texelY;

    let program = programs.advectVelocity;
    program.bind();
    gl.uniform1i(program.uniforms.uVelocity, velocity.read.attach(0));
    gl.uniform2f(program.uniforms.uVelocityTexel, texelX, texelY);
    gl.uniform1f(program.uniforms.uDt, dt);
    gl.uniform1f(program.uniforms.uDissipation, cfg.velocityDissipation);
    draw(program, velocity.write);
    velocity.swap();

    program = programs.curl;
    program.bind();
    gl.uniform1i(program.uniforms.uVelocity, velocity.read.attach(0));
    gl.uniform2f(program.uniforms.uTexel, texelX, texelY);
    draw(program, curlField);

    program = programs.vorticity;
    program.bind();
    gl.uniform1i(program.uniforms.uVelocity, velocity.read.attach(0));
    gl.uniform1i(program.uniforms.uCurl, curlField.attach(1));
    gl.uniform2f(program.uniforms.uTexel, texelX, texelY);
    gl.uniform1f(program.uniforms.uCurlStrength, cfg.curl);
    gl.uniform1f(program.uniforms.uDt, dt);
    draw(program, velocity.write);
    velocity.swap();

    const viscosityIterations = Math.max(0, Math.round(cfg.viscosityIterations));
    if (cfg.viscosity > 0 && viscosityIterations > 0) {
      const viscosityBlend = 1 - Math.exp(-cfg.viscosity * dt * 60 / viscosityIterations);
      program = programs.viscosity;
      program.bind();
      gl.uniform2f(program.uniforms.uTexel, texelX, texelY);
      gl.uniform1f(program.uniforms.uBlend, Math.min(1, viscosityBlend));
      for (let iteration = 0; iteration < viscosityIterations; iteration++) {
        gl.uniform1i(program.uniforms.uVelocity, velocity.read.attach(0));
        draw(program, velocity.write);
        velocity.swap();
      }
    }

    program = programs.divergence;
    program.bind();
    gl.uniform1i(program.uniforms.uVelocity, velocity.read.attach(0));
    gl.uniform2f(program.uniforms.uTexel, texelX, texelY);
    draw(program, divergence);

    program = programs.clear;
    program.bind();
    gl.uniform1i(program.uniforms.uTexture, pressure.read.attach(0));
    gl.uniform1f(program.uniforms.uValue, cfg.pressure);
    draw(program, pressure.write);
    pressure.swap();

    program = programs.pressure;
    program.bind();
    gl.uniform1i(program.uniforms.uDivergence, divergence.attach(0));
    gl.uniform2f(program.uniforms.uTexel, texelX, texelY);
    for (let iteration = 0; iteration < cfg.pressureIterations; iteration++) {
      gl.uniform1i(program.uniforms.uPressure, pressure.read.attach(1));
      draw(program, pressure.write);
      pressure.swap();
    }

    program = programs.gradient;
    program.bind();
    gl.uniform1i(program.uniforms.uPressure, pressure.read.attach(0));
    gl.uniform1i(program.uniforms.uVelocity, velocity.read.attach(1));
    gl.uniform2f(program.uniforms.uTexel, texelX, texelY);
    draw(program, velocity.write);
    velocity.swap();

    program = programs.advectFlow;
    program.bind();
    gl.uniform1i(program.uniforms.uVelocity, velocity.read.attach(0));
    gl.uniform1i(program.uniforms.uFlow, flow.read.attach(1));
    gl.uniform2f(program.uniforms.uVelocityTexel, texelX, texelY);
    gl.uniform2f(program.uniforms.uFlowTexel, flow.texelX, flow.texelY);
    gl.uniform1f(program.uniforms.uDt, dt);
    const bounds = sourceBounds();
    const restore = cfg.restoreRate > 0
      ? 1 - Math.pow(1 - Math.min(cfg.restoreRate, 0.999), dt * 60)
      : 0;
    gl.uniform2f(program.uniforms.uFlowMin, bounds.minX, bounds.minY);
    gl.uniform2f(program.uniforms.uFlowMax, bounds.maxX, bounds.maxY);
    gl.uniform1f(program.uniforms.uAspect, canvas.width / Math.max(canvas.height, 1));
    gl.uniform1f(program.uniforms.uMaxDistortion, Math.max(0.001, cfg.maxDistortion));
    gl.uniform1f(program.uniforms.uRestore, restore);
    draw(program, flow.write);
    flow.swap();
  }

  function render () {
    const program = programs.display;
    const rect = cfg.sourceRect;
    program.bind();
    gl.uniform1i(program.uniforms.uFlow, flow.read.attach(0));
    gl.uniform1i(program.uniforms.uSource, attachTexture(sourceTexture, 1));
    gl.uniform1i(program.uniforms.uLogo, attachTexture(logoTexture, 2));
    gl.uniform2f(program.uniforms.uSourceMin, rect.x, rect.y);
    gl.uniform2f(program.uniforms.uSourceScale, rect.width, rect.height);
    gl.uniform2f(
      program.uniforms.uSourceTexel,
      1 / sourceImage.naturalWidth,
      1 / sourceImage.naturalHeight,
    );
    gl.uniform2f(
      program.uniforms.uLogoTexel,
      logoImage ? 1 / Math.max(logoImage.naturalWidth, 1) : 1,
      logoImage ? 1 / Math.max(logoImage.naturalHeight, 1) : 1,
    );
    gl.uniform1f(program.uniforms.uCanvasAspect, canvas.width / Math.max(canvas.height, 1));
    gl.uniform1f(
      program.uniforms.uLogoAspect,
      logoImage ? logoImage.naturalWidth / Math.max(logoImage.naturalHeight, 1) : 1,
    );
    gl.uniform1f(program.uniforms.uLogoWidth, Math.min(0.9, Math.max(0.05, cfg.logoWidth)));
    gl.uniform1f(program.uniforms.uLogoChromeStrength, Math.max(0, cfg.logoChromeStrength));
    gl.uniform1f(program.uniforms.uLogoChromeBevel, Math.max(0, cfg.logoChromeBevel));
    gl.uniform1f(program.uniforms.uLogoChromeDepth, Math.max(0, cfg.logoChromeDepth));
    gl.uniform1f(program.uniforms.uLogoChromeBarWidth, Math.max(0.1, cfg.logoChromeBarWidth));
    gl.uniform1f(program.uniforms.uLogoChromeBarSpacing, Math.max(0.1, cfg.logoChromeBarSpacing));
    gl.uniform1f(program.uniforms.uLogoChromeBarSlant, cfg.logoChromeBarSlant);
    gl.uniform1f(program.uniforms.uLogoChromeBarBlur, Math.max(0, cfg.logoChromeBarBlur));
    gl.uniform1f(program.uniforms.uLogoChromeBlackBarAWidth, Math.max(0.005, cfg.logoChromeBlackBarAWidth));
    gl.uniform1f(program.uniforms.uLogoChromeBlackBarABlur, Math.max(0, cfg.logoChromeBlackBarABlur));
    gl.uniform1f(program.uniforms.uLogoChromeBlackBarBWidth, Math.max(0.005, cfg.logoChromeBlackBarBWidth));
    gl.uniform1f(program.uniforms.uLogoChromeBlackBarBBlur, Math.max(0, cfg.logoChromeBlackBarBBlur));
    const gradientColor = parseHexColor(cfg.logoChromeGradientColor);
    gl.uniform3f(program.uniforms.uLogoChromeGradientColor, ...gradientColor);
    gl.uniform1f(program.uniforms.uLogoChromeGradientOpacity, Math.max(0, cfg.logoChromeGradientOpacity));
    gl.uniform1f(program.uniforms.uLogoChromeGradientWidth, Math.max(0.01, cfg.logoChromeGradientWidth));
    gl.uniform1f(program.uniforms.uLogoChromePointer, Math.max(0, cfg.logoChromePointer));
    gl.uniform1f(program.uniforms.uLogoLiquidEdgeStrength, Math.max(0, cfg.logoLiquidEdgeStrength));
    gl.uniform1f(program.uniforms.uLogoLiquidEdgeWidth, Math.max(0, cfg.logoLiquidEdgeWidth));
    gl.uniform1f(program.uniforms.uLogoLiquidEdgeSpeed, Math.max(0, cfg.logoLiquidEdgeSpeed));
    gl.uniform1f(program.uniforms.uLogoLiquidEdgeScale, Math.max(0.15, cfg.logoLiquidEdgeScale));
    gl.uniform1f(program.uniforms.uLogoLiquidEdgeDistortion, Math.max(0, cfg.logoLiquidEdgeDistortion));
    gl.uniform1f(program.uniforms.uLogoLiquidEdgeContrast, Math.max(0.05, cfg.logoLiquidEdgeContrast));
    gl.uniform1f(program.uniforms.uLogoLiquidEdgeBrightness, Math.max(0, cfg.logoLiquidEdgeBrightness));
    gl.uniform1f(program.uniforms.uLogoLiquidEdgeInner, Math.max(0, cfg.logoLiquidEdgeInner));
    gl.uniform1f(program.uniforms.uLogoLiquidEdgeGlowOpacity, Math.max(0, cfg.logoLiquidEdgeGlowOpacity));
    gl.uniform1f(program.uniforms.uLogoLiquidEdgeAngle, cfg.logoLiquidEdgeAngle * Math.PI / 180);
    gl.uniform1f(program.uniforms.uTime, (performance.now() - shaderStartTime) / 1000);
    gl.uniform2f(program.uniforms.uPointer, chromePointer.x, chromePointer.y);
    draw(program, null);
  }

  function frame (now) {
    rafId = 0;
    if (!shouldRun()) return;
    const active = now - lastInteraction < ACTIVE_WINDOW_MS;
    const targetFps = active ? 60 : Math.max(1, cfg.idleFps);
    if (now - lastDraw < 1000 / targetFps - 1) {
      scheduleFrame();
      return;
    }
    const dt = Math.min(DT_MAX, Math.max(0.001, (now - lastStep) / 1000));
    lastStep = now;
    lastDraw = now;
    try {
      updateAmbient(dt);
      applyQueuedSplats();
      step(dt);
      render();
      stats.frames++;
    } catch (error) {
      notifyFallback('frame', error);
      return;
    }
    scheduleFrame();
  }

  function reveal () {
    if (shown || !canvas) return;
    shown = true;
    requestAnimationFrame(() => { if (canvas) canvas.style.opacity = '1'; });
    callback(cfg.onReady, instance);
  }

  function shouldRun () {
    return initialized && inView && !document.hidden && !destroyed &&
      !permanentFallback && !contextLost;
  }

  function scheduleFrame () {
    if (!rafId && shouldRun()) rafId = requestAnimationFrame(frame);
  }

  function startLoop () {
    if (!shouldRun() || rafId) return;
    lastStep = lastDraw = performance.now();
    scheduleFrame();
  }

  function stopLoop () {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function updateRunning () {
    if (shouldRun()) startLoop();
    else stopLoop();
  }

  function scheduleResize () {
    if (resizeRaf || !initialized || destroyed) return;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      if (!initialized || contextLost || permanentFallback) return;
      try {
        if (sizeCanvas()) {
          allocateFields();
          render();
        }
      } catch (error) {
        notifyFallback('resize', error);
      }
    });
  }

  function bindPointerEvents () {
    const passive = { passive: true };
    listen(container, 'pointerdown', handlePointerStart, passive);
    listen(container, 'pointermove', handlePointerMove, passive);
    listen(container, 'pointerup', handlePointerEnd, passive);
    listen(container, 'pointercancel', handlePointerEnd, passive);
    listen(container, 'pointerleave', handlePointerEnd, passive);
  }

  function interactiveTarget (event) {
    return event.target instanceof Element &&
      Boolean(event.target.closest('a,button,input,select,textarea,[contenteditable="true"]'));
  }

  function pointerSample (event) {
    const rect = container.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / Math.max(rect.width, 1),
      y: 1 - (event.clientY - rect.top) / Math.max(rect.height, 1),
      clientX: event.clientX,
      clientY: event.clientY,
      rect,
    };
  }

  function handlePointerStart (event) {
    if (interactiveTarget(event)) return;
    const sample = pointerSample(event);
    pointers.set(event.pointerId, { ...sample, emaX: 0, emaY: 0 });
  }

  function handlePointerMove (event) {
    if (permanentFallback || contextLost || interactiveTarget(event)) return;
    const hoverSample = pointerSample(event);
    chromePointer.x = hoverSample.x;
    chromePointer.y = hoverSample.y;
    if (!initialized) return;
    lastInteraction = performance.now();
    updateRunning();
    const samples = typeof event.getCoalescedEvents === 'function'
      ? event.getCoalescedEvents()
      : [event];
    for (const sampleEvent of samples) processPointerSample(event.pointerId, event.pointerType, sampleEvent);
  }

  function processPointerSample (pointerId, pointerType, event) {
    if (pointerType === 'touch' && cfg.touchMode === 'ambient') return;
    const sample = pointerSample(event);
    let previous = pointers.get(pointerId);
    if (!previous) {
      pointers.set(pointerId, { ...sample, emaX: 0, emaY: 0 });
      return;
    }
    const dxPixels = sample.clientX - previous.clientX;
    const dyPixels = sample.clientY - previous.clientY;
    previous.emaX = previous.emaX * 0.72 + Math.abs(dxPixels) * 0.28;
    previous.emaY = previous.emaY * 0.72 + Math.abs(dyPixels) * 0.28;

    if (pointerType === 'touch' && cfg.touchMode === 'horizontal' && previous.emaX <= previous.emaY) {
      Object.assign(previous, sample);
      return;
    }

    const normalization = Math.max(sample.rect.width, sample.rect.height, 1);
    let dx = dxPixels / normalization;
    let dy = -dyPixels / normalization;
    const magnitude = Math.hypot(dx, dy);
    if (magnitude > MAX_POINTER_DELTA) {
      dx *= MAX_POINTER_DELTA / magnitude;
      dy *= MAX_POINTER_DELTA / magnitude;
    }
    if (dx || dy) {
      // Browsers and automation can deliver widely spaced pointer samples.
      // Paint should form one continuous stroke, so distribute the impulse
      // along the path instead of stamping a few isolated circular warps.
      const pathDistance = Math.hypot(sample.x - previous.x, sample.y - previous.y);
      const steps = Math.min(16, Math.max(1, Math.ceil(pathDistance / MAX_SPLAT_SPACING)));
      for (let step = 1; step <= steps; step++) {
        const t = step / steps;
        splats.push({
          x: Math.min(1, Math.max(0, previous.x + (sample.x - previous.x) * t)),
          y: Math.min(1, Math.max(0, previous.y + (sample.y - previous.y) * t)),
          dx: dx * cfg.splatForce / steps,
          dy: dy * cfg.splatForce / steps,
        });
      }
      lastInteraction = performance.now();
      updateRunning();
    }
    Object.assign(previous, sample);
  }

  function handlePointerEnd (event) {
    pointers.delete(event.pointerId);
  }

  function onContextLost (event) {
    event.preventDefault();
    contextLost = true;
    stats.status = 'context-lost';
    stopLoop();
    if (canvas) canvas.style.opacity = '0';
  }

  async function onContextRestored () {
    if (destroyed || permanentFallback) return;
    contextRestoreAttempts++;
    if (contextRestoreAttempts > 1) {
      notifyFallback('context-lost');
      return;
    }
    try {
      releaseResources(false);
      createContext();
      createQuad();
      programs = await createPrograms();
      uploadSource(sourceImage);
      uploadLogo(logoImage);
      sizeCanvas();
      allocateFields();
      render();
      contextLost = false;
      stats.status = 'ready';
      if (canvas) canvas.style.opacity = '1';
      updateRunning();
    } catch (error) {
      notifyFallback('context-lost', error);
    }
  }

  function releaseResources (releaseContextReferences = true) {
    if (!gl) return;
    try {
      releaseFields();
      if (sourceTexture) gl.deleteTexture(sourceTexture);
      sourceTexture = null;
      if (logoTexture) gl.deleteTexture(logoTexture);
      logoTexture = null;
      if (programs) {
        for (const item of Object.values(programs)) gl.deleteProgram(item.program);
      }
      programs = null;
      if (quadBuffer) gl.deleteBuffer(quadBuffer);
      if (vao) gl.deleteVertexArray(vao);
      quadBuffer = vao = null;
    } catch (_) { /* context loss can invalidate every delete call */ }
    if (releaseContextReferences) {
      gl = null;
      parallelExt = null;
    }
  }

  function destroy () {
    if (destroyed) return;
    destroyed = true;
    stats.status = 'destroyed';
    stopLoop();
    if (resizeRaf) cancelAnimationFrame(resizeRaf);
    resizeRaf = 0;
    io?.disconnect();
    ro?.disconnect();
    for (const remove of removers.splice(0)) remove();
    releaseResources();
    canvas?.remove();
    canvas = null;
    sourceImage = null;
    logoImage = null;
    pointers.clear();
    splats.length = 0;
    restoreContainer();
    MOUNTS.delete(container);
  }
}

const FluidHeader = { mount };
window.FluidHeader = FluidHeader;

if (typeof window !== 'undefined') {
  queueMicrotask(() => window.dispatchEvent(new CustomEvent('fluidheader:ready')));
}

})();
