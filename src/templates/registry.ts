import type { CategoryId, TemplateDef } from './types';
import { CATEGORIES } from './types';
import { showcaseRing, sphereWall, cardGlobe, cardTunnel, spiralStream, depthStack, coverRing } from './t3d';
import { orbitGlobe, sphereCascade, totemWall, parallaxTotem, coverRingVertical } from './t3d2';
import { isoCascade, isoFocus, isoWave, isoOrbit } from './tiso';
import { orbitCarousel, photoOrbit, ferrisWheel, orbitRings, orbitBloom } from './torbit';
import { coverFlow, filmStrip, cardTotem, focusSlider, wheelCarousel, diagonalCarousel } from './tcarousel';
import { flipGrid, tickerTilt, masonryScroll, waveGrid, popGrid, gridReveal } from './tgrid';
import { bento3, bento6, bento7, bento8, bento9 } from './tbento';
import { centerStage, zoomParallax, kenBurns } from './tspot';
import { splitReveal, shutterSlice, slideCover, diagonalWipe, mosaicWipe } from './treveal';
import { cardToss, deckShuffle, fanSpread, stackSlide } from './tstack';
import {
  flybyRolodex,
  bloomBelt,
  lensOrbit,
  stairway,
  gridDive,
  popParade,
  tripleScene,
  collageReel,
  fanShuffle,
  sweepRing,
  scatterDial,
  gridZoom,
  spreadRows,
  spreadColumns,
  mosaicRevolve,
  turnstileGrid,
  flipWrap,
  diagonalWheel,
} from './tmulti';

export const TEMPLATES: TemplateDef[] = [
  showcaseRing,
  sphereWall,
  cardGlobe,
  orbitGlobe,
  sphereCascade,
  totemWall,
  parallaxTotem,
  cardTunnel,
  spiralStream,
  depthStack,
  coverRing,
  coverRingVertical,
  flybyRolodex,
  bloomBelt,
  lensOrbit,
  stairway,
  gridDive,
  popParade,
  tripleScene,
  collageReel,
  fanShuffle,
  sweepRing,
  scatterDial,
  gridZoom,
  spreadRows,
  spreadColumns,
  mosaicRevolve,
  turnstileGrid,
  flipWrap,
  diagonalWheel,
  bento3,
  bento6,
  bento7,
  bento8,
  bento9,
  isoCascade,
  isoFocus,
  isoWave,
  isoOrbit,
  orbitCarousel,
  photoOrbit,
  ferrisWheel,
  orbitRings,
  orbitBloom,
  coverFlow,
  filmStrip,
  cardTotem,
  focusSlider,
  wheelCarousel,
  diagonalCarousel,
  flipGrid,
  tickerTilt,
  masonryScroll,
  waveGrid,
  popGrid,
  gridReveal,
  centerStage,
  zoomParallax,
  kenBurns,
  splitReveal,
  shutterSlice,
  slideCover,
  diagonalWipe,
  mosaicWipe,
  cardToss,
  deckShuffle,
  fanSpread,
  stackSlide,
];

export const DEFAULT_TEMPLATE_ID = 'iso-cascade';

const byId = new Map(TEMPLATES.map((t) => [t.id, t]));

export function getTemplate(id: string): TemplateDef {
  const t = byId.get(id);
  if (!t) throw new Error(`Unknown template ${id}`);
  return t;
}

export function templatesByCategory(): { id: CategoryId; label: string; templates: TemplateDef[] }[] {
  return CATEGORIES.map((c) => ({ ...c, templates: TEMPLATES.filter((t) => t.category === c.id) })).filter(
    (c) => c.templates.length > 0,
  );
}
