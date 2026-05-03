/**
 * Board Renderer for PokéChess — HP-Based Combat
 * Renders the 8×8 board with Pokémon pieces, HP bars, type badges, and damage tooltips
 * Uses in-place cell updates to avoid full DOM rebuilds and animation glitches
 */

import { ROLES } from '../engine/board.js';
import { TYPES, POKEMON, TEAMS, COLOR_TO_TEAM } from '../engine/types.js';
import { getBattlePreview } from '../engine/battle.js';
import { getEquippedCosmetic, COSMETICS } from './shop.js';

// ── Per-Pokémon head positions (% within 88%-square sprite wrapper) ──
// With object-position: center bottom, sprites sit at bottom of the wrapper square.
// Tall sprites fill most of the square, short/wide ones have space above.
// headTop: % from wrapper top to face center, headLeft: % horizontal, headScale: cosmetic size
const POKEMON_HEAD_MAP = {
  // Scarlet Paradox — face positions verified via composite testing
  KORAIDON:     { headTop: 28, headLeft: 48, headScale: 1.0 },  // face center, feathered crest
  SANDY_SHOCKS: { headTop: 15, headLeft: 43, headScale: 1.0 },  // top magnet unit face
  FLUTTER_MANE: { headTop: 50, headLeft: 35, headScale: 1.0 },  // face very low-left
  RAGING_BOLT:  { headTop: 10, headLeft: 45, headScale: 0.7 },  // tiny face on long neck
  ROARING_MOON: { headTop: 28, headLeft: 48, headScale: 1.0 },  // face between wings
  SCREAM_TAIL:  { headTop: 38, headLeft: 40, headScale: 1.2 },  // big round face
  GREAT_TUSK:   { headTop: 38, headLeft: 30, headScale: 1.0 },  // face left behind tusks
  BRUTE_BONNET: { headTop: 35, headLeft: 42, headScale: 1.1 },  // face under mushroom cap
  SLITHER_WING: { headTop: 35, headLeft: 35, headScale: 1.0 },  // face low-left, wings above
  WALKING_WAKE: { headTop: 22, headLeft: 30, headScale: 0.9 },  // face upper-left
  GOUGING_FIRE: { headTop: 30, headLeft: 40, headScale: 1.0 },  // face center under plumes
  // Scarlet Classics
  BULBASAUR:    { headTop: 35, headLeft: 52, headScale: 0.9 },  // short quadruped
  CHARIZARD:    { headTop: 8,  headLeft: 50, headScale: 0.8 },  // tall dragon
  DRAGONITE:    { headTop: 8,  headLeft: 50, headScale: 0.85 }, // tall bipedal
  GARCHOMP:     { headTop: 5,  headLeft: 50, headScale: 0.85 }, // tall shark
  BLAZIKEN:     { headTop: 5,  headLeft: 50, headScale: 0.8 },  // tall fighter
  SCEPTILE:     { headTop: 5,  headLeft: 48, headScale: 0.85 }, // tall lizard
  GHOLDENGO:    { headTop: 8,  headLeft: 50, headScale: 0.85 }, // humanoid
  CHI_YU:       { headTop: 18, headLeft: 50, headScale: 1.0 },  // small fish
  INCINEROAR:   { headTop: 5,  headLeft: 50, headScale: 0.9 },  // tall wrestler
  MAGCARGO:     { headTop: 20, headLeft: 48, headScale: 0.9 },  // snail
  COMFEY:       { headTop: 25, headLeft: 50, headScale: 0.7 },  // tiny ring
  // Violet Paradox
  MIRAIDON:     { headTop: 15, headLeft: 48, headScale: 0.8 },  // face upper-center
  IRON_MOTH:    { headTop: 35, headLeft: 45, headScale: 0.9 },  // face center-low, wings radiate out
  IRON_CROWN:   { headTop: 18, headLeft: 48, headScale: 0.8 },  // face upper-center, tall deer
  IRON_BOULDER: { headTop: 25, headLeft: 55, headScale: 0.9 },  // face right-center
  IRON_JUGULIS: { headTop: 18, headLeft: 35, headScale: 0.8 },  // face left, tendrils right
  IRON_BUNDLE:  { headTop: 18, headLeft: 48, headScale: 1.1 },  // round face, center
  IRON_TREADS:  { headTop: 35, headLeft: 55, headScale: 0.9 },  // face right behind treads
  IRON_HANDS:   { headTop: 12, headLeft: 45, headScale: 0.9 },  // small head, big hands
  IRON_THORNS:  { headTop: 10, headLeft: 48, headScale: 0.9 },  // face at top, wide body
  IRON_VALIANT: { headTop: 12, headLeft: 42, headScale: 0.7 },  // small head left-center, slim body
  IRON_LEAVES:  { headTop: 15, headLeft: 48, headScale: 0.8 },  // face upper-center, quadruped
  // Violet Classics
  PIKACHU:      { headTop: 15, headLeft: 50, headScale: 1.1 },  // short mouse
  GENGAR:       { headTop: 12, headLeft: 50, headScale: 1.15 }, // round ghost
  METAGROSS:    { headTop: 18, headLeft: 50, headScale: 1.0 },  // flat spider
  LUCARIO:      { headTop: 5,  headLeft: 50, headScale: 0.9 },  // tall bipedal
  GARDEVOIR:    { headTop: 5,  headLeft: 50, headScale: 0.8 },  // tall fairy
  SYLVEON:      { headTop: 12, headLeft: 50, headScale: 0.9 },  // quadruped
  DRAGAPULT:    { headTop: 8,  headLeft: 42, headScale: 0.85 }, // long dragon
  CHIEN_PAO:    { headTop: 12, headLeft: 50, headScale: 0.9 },  // leopard
  ZAPDOS:       { headTop: 5,  headLeft: 50, headScale: 0.8 },  // tall bird
  BRAMBLEGHAST: { headTop: 18, headLeft: 50, headScale: 0.95 }, // tumbleweed
  AUDINO:       { headTop: 12, headLeft: 50, headScale: 1.0 },  // round bipedal
  // New Scarlet classics
  BELLIBOLT:    { headTop: 30, headLeft: 50, headScale: 1.2 },  // big round face center
  ARCANINE:     { headTop: 18, headLeft: 40, headScale: 0.9 },  // face upper-left, quadruped
  TYRANITAR:    { headTop: 12, headLeft: 42, headScale: 0.9 },  // face upper-left, tall bipedal
  SKELEDIRGE:   { headTop: 35, headLeft: 25, headScale: 0.9 },  // face far-left, croc
  TINKATON:     { headTop: 60, headLeft: 35, headScale: 0.8 },  // small face bottom-left, big hammer
  // New Violet classics
  MIMIKYU:      { headTop: 20, headLeft: 48, headScale: 1.0 },  // face center-upper
  TOXTRICITY:   { headTop: 12, headLeft: 48, headScale: 0.8 },  // small face top-center, tall
  CERULEDGE:    { headTop: 12, headLeft: 48, headScale: 0.7 },  // helmeted head, slim
  KINGAMBIT:    { headTop: 15, headLeft: 48, headScale: 0.8 },  // face upper-center, blade head
  HATTERENE:    { headTop: 25, headLeft: 45, headScale: 0.7 },  // tiny face under hat
  // Scarlet pack-only
  IVYSAUR:      { headTop: 30, headLeft: 50, headScale: 0.9 },  // quadruped with bud
  VENUSAUR:     { headTop: 35, headLeft: 45, headScale: 1.0 },  // wide quadruped with flower
  SCIZOR:       { headTop: 8,  headLeft: 50, headScale: 0.85 }, // tall bipedal with pincers
  VOLCANION:    { headTop: 15, headLeft: 48, headScale: 0.9 },  // quadruped with steam ring
  LYCANROC:     { headTop: 12, headLeft: 50, headScale: 0.9 },  // wolf bipedal
  // Violet pack-only
  PICHU:        { headTop: 18, headLeft: 50, headScale: 1.2 },  // tiny mouse
  RAICHU:       { headTop: 12, headLeft: 50, headScale: 1.0 },  // round mouse
  AEGISLASH:    { headTop: 15, headLeft: 50, headScale: 0.8 },  // sword/shield
  ZOROARK:      { headTop: 5,  headLeft: 48, headScale: 0.85 }, // tall fox
  TOXAPEX:      { headTop: 25, headLeft: 50, headScale: 0.9 },  // spiky sea star
};
const DEFAULT_HEAD = { headTop: 10, headLeft: 50, headScale: 0.9 };

// ── Per-Pokémon per-cosmetic transform overrides ──
// Keys: POKEMON_KEY, values: { COSMETIC_ID: { rot, scale, ox, oy } }
// rot = extra rotation (degrees), scale = size multiplier, ox/oy = position offset %
const COSMETIC_OVERRIDES = {
  KORAIDON: {
    MARIOS_HAT:   { rot: 8,  scale: 1.0, ox: 0, oy: 0 },
    LINKS_HAT:    { rot: 8,  scale: 1.0, ox: 0, oy: 0 },
    PIKACHU_EARS: { rot: 5,  scale: 1.0, ox: 0, oy: -2 },
    MAJORAS_MASK: { rot: 3,  scale: 1.0, ox: 0, oy: 0 },
    MASTER_SWORD: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    ONE_HIT_OBLITERATOR: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    POKEBALL:     { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
  },
  SANDY_SHOCKS: {
    MARIOS_HAT:   { rot: -5, scale: 1.0, ox: 0, oy: 0 },
    LINKS_HAT:    { rot: -5, scale: 1.0, ox: 0, oy: 0 },
    PIKACHU_EARS: { rot: 0,  scale: 1.0, ox: 0, oy: -2 },
    MAJORAS_MASK: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    MASTER_SWORD: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    ONE_HIT_OBLITERATOR: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    POKEBALL:     { rot: 0,  scale: 1.0, ox: 5, oy: 0 },
  },
  FLUTTER_MANE: {
    MARIOS_HAT:   { rot: -10,scale: 1.0, ox: 0, oy: -3 },
    LINKS_HAT:    { rot: -10,scale: 1.0, ox: 0, oy: -3 },
    PIKACHU_EARS: { rot: -5, scale: 1.0, ox: 0, oy: -5 },
    MAJORAS_MASK: { rot: -3, scale: 1.0, ox: 0, oy: 0 },
    MASTER_SWORD: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    ONE_HIT_OBLITERATOR: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    POKEBALL:     { rot: 0,  scale: 1.0, ox: 10,oy: 0 },
  },
  RAGING_BOLT: {
    MARIOS_HAT:   { rot: 3,  scale: 1.0, ox: 0, oy: -2 },
    LINKS_HAT:    { rot: 3,  scale: 1.0, ox: 0, oy: -2 },
    PIKACHU_EARS: { rot: 0,  scale: 1.0, ox: 0, oy: -3 },
    MAJORAS_MASK: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    MASTER_SWORD: { rot: 0,  scale: 1.2, ox: 5, oy: 10 },
    ONE_HIT_OBLITERATOR: { rot: 0,  scale: 1.2, ox: 5, oy: 10 },
    POKEBALL:     { rot: 0,  scale: 1.0, ox: 5, oy: 0 },
  },
  ROARING_MOON: {
    MARIOS_HAT:   { rot: -3, scale: 1.0, ox: 0, oy: 0 },
    LINKS_HAT:    { rot: -3, scale: 1.0, ox: 0, oy: 0 },
    PIKACHU_EARS: { rot: 0,  scale: 1.0, ox: 0, oy: -3 },
    MAJORAS_MASK: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    MASTER_SWORD: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    ONE_HIT_OBLITERATOR: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    POKEBALL:     { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
  },
  SCREAM_TAIL: {
    MARIOS_HAT:   { rot: -8, scale: 1.0, ox: 0, oy: -2 },
    LINKS_HAT:    { rot: -6, scale: 1.0, ox: 0, oy: -2 },
    PIKACHU_EARS: { rot: -3, scale: 1.0, ox: 0, oy: -4 },
    MAJORAS_MASK: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    MASTER_SWORD: { rot: 0,  scale: 1.0, ox: 10,oy: 0 },
    ONE_HIT_OBLITERATOR: { rot: 0,  scale: 1.0, ox: 10,oy: 0 },
    POKEBALL:     { rot: 0,  scale: 1.0, ox: 10,oy: 0 },
  },
  GREAT_TUSK: {
    MARIOS_HAT:   { rot: -5, scale: 1.0, ox: 0, oy: 0 },
    LINKS_HAT:    { rot: -5, scale: 1.0, ox: 0, oy: 0 },
    PIKACHU_EARS: { rot: 0,  scale: 1.0, ox: 0, oy: -3 },
    MAJORAS_MASK: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    MASTER_SWORD: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    ONE_HIT_OBLITERATOR: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    POKEBALL:     { rot: 0,  scale: 1.0, ox: -5,oy: 0 },
  },
  BRUTE_BONNET: {
    MARIOS_HAT:   { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    LINKS_HAT:    { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    PIKACHU_EARS: { rot: 0,  scale: 1.0, ox: 0, oy: -2 },
    MAJORAS_MASK: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    MASTER_SWORD: { rot: 0,  scale: 1.0, ox: 5, oy: 0 },
    ONE_HIT_OBLITERATOR: { rot: 0,  scale: 1.0, ox: 5, oy: 0 },
    POKEBALL:     { rot: 0,  scale: 1.0, ox: 5, oy: 0 },
  },
  SLITHER_WING: {
    MARIOS_HAT:   { rot: -5, scale: 1.0, ox: 0, oy: 0 },
    LINKS_HAT:    { rot: -5, scale: 1.0, ox: 0, oy: 0 },
    PIKACHU_EARS: { rot: 0,  scale: 1.0, ox: 0, oy: -3 },
    MAJORAS_MASK: { rot: 0,  scale: 1.0, ox: 0, oy: 3 },
    MASTER_SWORD: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    ONE_HIT_OBLITERATOR: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    POKEBALL:     { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
  },
  WALKING_WAKE: {
    MARIOS_HAT:   { rot: -8, scale: 1.0, ox: 0, oy: 0 },
    LINKS_HAT:    { rot: -8, scale: 1.0, ox: 0, oy: 0 },
    PIKACHU_EARS: { rot: -3, scale: 1.0, ox: 0, oy: -2 },
    MAJORAS_MASK: { rot: -3, scale: 1.0, ox: 0, oy: 0 },
    MASTER_SWORD: { rot: 0,  scale: 1.0, ox: -5,oy: 0 },
    ONE_HIT_OBLITERATOR: { rot: 0,  scale: 1.0, ox: -5,oy: 0 },
    POKEBALL:     { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
  },
  GOUGING_FIRE: {
    MARIOS_HAT:   { rot: -3, scale: 1.0, ox: 0, oy: 0 },
    LINKS_HAT:    { rot: -3, scale: 1.0, ox: 0, oy: 0 },
    PIKACHU_EARS: { rot: 0,  scale: 1.0, ox: 0, oy: -2 },
    MAJORAS_MASK: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    MASTER_SWORD: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    ONE_HIT_OBLITERATOR: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    POKEBALL:     { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
  },
  // ── Violet Paradox (Future) ──
  MIRAIDON: {
    MARIOS_HAT:   { rot: 5,  scale: 1.0, ox: 0, oy: 0 },
    LINKS_HAT:    { rot: 5,  scale: 1.0, ox: 0, oy: 0 },
    PIKACHU_EARS: { rot: 3,  scale: 1.0, ox: 0, oy: -2 },
    MAJORAS_MASK: { rot: 3,  scale: 1.0, ox: 0, oy: 0 },
    MASTER_SWORD: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    ONE_HIT_OBLITERATOR: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    POKEBALL:     { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
  },
  IRON_MOTH: {
    MARIOS_HAT:   { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    LINKS_HAT:    { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    PIKACHU_EARS: { rot: 0,  scale: 1.0, ox: 0, oy: -3 },
    MAJORAS_MASK: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    MASTER_SWORD: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    ONE_HIT_OBLITERATOR: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    POKEBALL:     { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
  },
  IRON_CROWN: {
    MARIOS_HAT:   { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    LINKS_HAT:    { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    PIKACHU_EARS: { rot: 0,  scale: 1.0, ox: 0, oy: -2 },
    MAJORAS_MASK: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    MASTER_SWORD: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    ONE_HIT_OBLITERATOR: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    POKEBALL:     { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
  },
  IRON_BOULDER: {
    MARIOS_HAT:   { rot: -5, scale: 1.0, ox: 0, oy: 0 },
    LINKS_HAT:    { rot: -5, scale: 1.0, ox: 0, oy: 0 },
    PIKACHU_EARS: { rot: 0,  scale: 1.0, ox: 0, oy: -3 },
    MAJORAS_MASK: { rot: -3, scale: 1.0, ox: 0, oy: 0 },
    MASTER_SWORD: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    ONE_HIT_OBLITERATOR: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    POKEBALL:     { rot: 0,  scale: 1.0, ox: 5, oy: 0 },
  },
  IRON_JUGULIS: {
    MARIOS_HAT:   { rot: -5, scale: 1.0, ox: 0, oy: 0 },
    LINKS_HAT:    { rot: -5, scale: 1.0, ox: 0, oy: 0 },
    PIKACHU_EARS: { rot: -3, scale: 1.0, ox: 0, oy: -3 },
    MAJORAS_MASK: { rot: -3, scale: 1.0, ox: 0, oy: 0 },
    MASTER_SWORD: { rot: 0,  scale: 1.0, ox: -5,oy: 0 },
    ONE_HIT_OBLITERATOR: { rot: 0,  scale: 1.0, ox: -5,oy: 0 },
    POKEBALL:     { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
  },
  IRON_BUNDLE: {
    MARIOS_HAT:   { rot: 0,  scale: 1.0, ox: 0, oy: -2 },
    LINKS_HAT:    { rot: 0,  scale: 1.0, ox: 0, oy: -2 },
    PIKACHU_EARS: { rot: 0,  scale: 1.0, ox: 0, oy: -4 },
    MAJORAS_MASK: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    MASTER_SWORD: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    ONE_HIT_OBLITERATOR: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    POKEBALL:     { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
  },
  IRON_TREADS: {
    MARIOS_HAT:   { rot: -5, scale: 1.0, ox: 0, oy: 0 },
    LINKS_HAT:    { rot: -5, scale: 1.0, ox: 0, oy: 0 },
    PIKACHU_EARS: { rot: 0,  scale: 1.0, ox: 0, oy: -3 },
    MAJORAS_MASK: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    MASTER_SWORD: { rot: 0,  scale: 1.0, ox: 5, oy: 0 },
    ONE_HIT_OBLITERATOR: { rot: 0,  scale: 1.0, ox: 5, oy: 0 },
    POKEBALL:     { rot: 0,  scale: 1.0, ox: 5, oy: 0 },
  },
  IRON_HANDS: {
    MARIOS_HAT:   { rot: -3, scale: 1.0, ox: 0, oy: 0 },
    LINKS_HAT:    { rot: -3, scale: 1.0, ox: 0, oy: 0 },
    PIKACHU_EARS: { rot: 0,  scale: 1.0, ox: 0, oy: -2 },
    MAJORAS_MASK: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    MASTER_SWORD: { rot: 0,  scale: 1.0, ox: -5,oy: 0 },
    ONE_HIT_OBLITERATOR: { rot: 0,  scale: 1.0, ox: -5,oy: 0 },
    POKEBALL:     { rot: 0,  scale: 1.0, ox: -5,oy: 0 },
  },
  IRON_THORNS: {
    MARIOS_HAT:   { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    LINKS_HAT:    { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    PIKACHU_EARS: { rot: 0,  scale: 1.0, ox: 0, oy: -2 },
    MAJORAS_MASK: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    MASTER_SWORD: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    ONE_HIT_OBLITERATOR: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    POKEBALL:     { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
  },
  IRON_VALIANT: {
    MARIOS_HAT:   { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    LINKS_HAT:    { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    PIKACHU_EARS: { rot: 0,  scale: 1.0, ox: 0, oy: -2 },
    MAJORAS_MASK: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    MASTER_SWORD: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    ONE_HIT_OBLITERATOR: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    POKEBALL:     { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
  },
  IRON_LEAVES: {
    MARIOS_HAT:   { rot: -5, scale: 1.0, ox: 0, oy: 0 },
    LINKS_HAT:    { rot: -5, scale: 1.0, ox: 0, oy: 0 },
    PIKACHU_EARS: { rot: -3, scale: 1.0, ox: 0, oy: -2 },
    MAJORAS_MASK: { rot: -3, scale: 1.0, ox: 0, oy: 0 },
    MASTER_SWORD: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    ONE_HIT_OBLITERATOR: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    POKEBALL:     { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
  },
  // Scarlet pack-only
  IVYSAUR: {
    MARIOS_HAT:   { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    LINKS_HAT:    { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    PIKACHU_EARS: { rot: 0,  scale: 1.0, ox: 0, oy: -2 },
    MAJORAS_MASK: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    MASTER_SWORD: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    ONE_HIT_OBLITERATOR: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    POKEBALL:     { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
  },
  VENUSAUR: {
    MARIOS_HAT:   { rot: -3, scale: 1.0, ox: 0, oy: 0 },
    LINKS_HAT:    { rot: -3, scale: 1.0, ox: 0, oy: 0 },
    PIKACHU_EARS: { rot: 0,  scale: 1.0, ox: 0, oy: -2 },
    MAJORAS_MASK: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    MASTER_SWORD: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    ONE_HIT_OBLITERATOR: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    POKEBALL:     { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
  },
  SCIZOR: {
    MARIOS_HAT:   { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    LINKS_HAT:    { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    PIKACHU_EARS: { rot: 0,  scale: 1.0, ox: 0, oy: -2 },
    MAJORAS_MASK: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    MASTER_SWORD: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    ONE_HIT_OBLITERATOR: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    POKEBALL:     { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
  },
  VOLCANION: {
    MARIOS_HAT:   { rot: -3, scale: 1.0, ox: 0, oy: 0 },
    LINKS_HAT:    { rot: -3, scale: 1.0, ox: 0, oy: 0 },
    PIKACHU_EARS: { rot: 0,  scale: 1.0, ox: 0, oy: -2 },
    MAJORAS_MASK: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    MASTER_SWORD: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    ONE_HIT_OBLITERATOR: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    POKEBALL:     { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
  },
  LYCANROC: {
    MARIOS_HAT:   { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    LINKS_HAT:    { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    PIKACHU_EARS: { rot: 0,  scale: 1.0, ox: 0, oy: -2 },
    MAJORAS_MASK: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    MASTER_SWORD: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    ONE_HIT_OBLITERATOR: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    POKEBALL:     { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
  },
  // Violet pack-only
  PICHU: {
    MARIOS_HAT:   { rot: 0,  scale: 1.0, ox: 0, oy: -2 },
    LINKS_HAT:    { rot: 0,  scale: 1.0, ox: 0, oy: -2 },
    PIKACHU_EARS: { rot: 0,  scale: 1.0, ox: 0, oy: -4 },
    MAJORAS_MASK: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    MASTER_SWORD: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    ONE_HIT_OBLITERATOR: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    POKEBALL:     { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
  },
  RAICHU: {
    MARIOS_HAT:   { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    LINKS_HAT:    { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    PIKACHU_EARS: { rot: 0,  scale: 1.0, ox: 0, oy: -2 },
    MAJORAS_MASK: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    MASTER_SWORD: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    ONE_HIT_OBLITERATOR: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    POKEBALL:     { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
  },
  AEGISLASH: {
    MARIOS_HAT:   { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    LINKS_HAT:    { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    PIKACHU_EARS: { rot: 0,  scale: 1.0, ox: 0, oy: -2 },
    MAJORAS_MASK: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    MASTER_SWORD: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    ONE_HIT_OBLITERATOR: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    POKEBALL:     { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
  },
  ZOROARK: {
    MARIOS_HAT:   { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    LINKS_HAT:    { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    PIKACHU_EARS: { rot: 0,  scale: 1.0, ox: 0, oy: -2 },
    MAJORAS_MASK: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    MASTER_SWORD: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    ONE_HIT_OBLITERATOR: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    POKEBALL:     { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
  },
  TOXAPEX: {
    MARIOS_HAT:   { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    LINKS_HAT:    { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    PIKACHU_EARS: { rot: 0,  scale: 1.0, ox: 0, oy: -2 },
    MAJORAS_MASK: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    MASTER_SWORD: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    ONE_HIT_OBLITERATOR: { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
    POKEBALL:     { rot: 0,  scale: 1.0, ox: 0, oy: 0 },
  },
  // ── Scarlet Classics ──
  BULBASAUR:    { MARIOS_HAT: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, LINKS_HAT: { rot: -20, scale: 1.1, ox: -3, oy: -5 }, PIKACHU_EARS: { rot: 0, scale: 1.0, ox: 0, oy: -2 }, MAJORAS_MASK: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, MASTER_SWORD: { rot: 0, scale: 1.0, ox: 5, oy: 0 }, ONE_HIT_OBLITERATOR: { rot: 0, scale: 1.0, ox: 5, oy: 0 }, POKEBALL: { rot: 0, scale: 1.0, ox: 0, oy: 0 } },
  CHARIZARD:    { MARIOS_HAT: { rot: 3, scale: 1.0, ox: 0, oy: 0 }, LINKS_HAT: { rot: 3, scale: 1.0, ox: 0, oy: 0 }, PIKACHU_EARS: { rot: 0, scale: 1.0, ox: 0, oy: -2 }, MAJORAS_MASK: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, MASTER_SWORD: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, ONE_HIT_OBLITERATOR: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, POKEBALL: { rot: 0, scale: 1.0, ox: 0, oy: 0 } },
  DRAGONITE:    { MARIOS_HAT: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, LINKS_HAT: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, PIKACHU_EARS: { rot: 0, scale: 1.0, ox: 0, oy: -2 }, MAJORAS_MASK: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, MASTER_SWORD: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, ONE_HIT_OBLITERATOR: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, POKEBALL: { rot: 0, scale: 1.0, ox: 0, oy: 0 } },
  GARCHOMP:     { MARIOS_HAT: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, LINKS_HAT: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, PIKACHU_EARS: { rot: 0, scale: 1.0, ox: 0, oy: -2 }, MAJORAS_MASK: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, MASTER_SWORD: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, ONE_HIT_OBLITERATOR: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, POKEBALL: { rot: 0, scale: 1.0, ox: 0, oy: 0 } },
  BLAZIKEN:     { MARIOS_HAT: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, LINKS_HAT: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, PIKACHU_EARS: { rot: 0, scale: 1.0, ox: 0, oy: -2 }, MAJORAS_MASK: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, MASTER_SWORD: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, ONE_HIT_OBLITERATOR: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, POKEBALL: { rot: 0, scale: 1.0, ox: 0, oy: 0 } },
  SCEPTILE:     { MARIOS_HAT: { rot: -3, scale: 1.0, ox: 0, oy: 0 }, LINKS_HAT: { rot: -3, scale: 1.0, ox: 0, oy: 0 }, PIKACHU_EARS: { rot: 0, scale: 1.0, ox: 0, oy: -2 }, MAJORAS_MASK: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, MASTER_SWORD: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, ONE_HIT_OBLITERATOR: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, POKEBALL: { rot: 0, scale: 1.0, ox: 0, oy: 0 } },
  GHOLDENGO:    { MARIOS_HAT: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, LINKS_HAT: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, PIKACHU_EARS: { rot: 0, scale: 1.0, ox: 0, oy: -2 }, MAJORAS_MASK: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, MASTER_SWORD: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, ONE_HIT_OBLITERATOR: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, POKEBALL: { rot: 0, scale: 1.0, ox: 0, oy: 0 } },
  CHI_YU:       { MARIOS_HAT: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, LINKS_HAT: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, PIKACHU_EARS: { rot: 0, scale: 1.0, ox: 0, oy: -3 }, MAJORAS_MASK: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, MASTER_SWORD: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, ONE_HIT_OBLITERATOR: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, POKEBALL: { rot: 0, scale: 1.0, ox: 0, oy: 0 } },
  INCINEROAR:   { MARIOS_HAT: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, LINKS_HAT: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, PIKACHU_EARS: { rot: 0, scale: 1.0, ox: 0, oy: -2 }, MAJORAS_MASK: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, MASTER_SWORD: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, ONE_HIT_OBLITERATOR: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, POKEBALL: { rot: 0, scale: 1.0, ox: 0, oy: 0 } },
  MAGCARGO:     { MARIOS_HAT: { rot: -3, scale: 1.0, ox: 0, oy: 0 }, LINKS_HAT: { rot: -3, scale: 1.0, ox: 0, oy: 0 }, PIKACHU_EARS: { rot: 0, scale: 1.0, ox: 0, oy: -2 }, MAJORAS_MASK: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, MASTER_SWORD: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, ONE_HIT_OBLITERATOR: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, POKEBALL: { rot: 0, scale: 1.0, ox: 0, oy: 0 } },
  COMFEY:       { MARIOS_HAT: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, LINKS_HAT: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, PIKACHU_EARS: { rot: 0, scale: 1.0, ox: 0, oy: -2 }, MAJORAS_MASK: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, MASTER_SWORD: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, ONE_HIT_OBLITERATOR: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, POKEBALL: { rot: 0, scale: 1.0, ox: 0, oy: 0 } },
  BELLIBOLT:    { MARIOS_HAT: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, LINKS_HAT: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, PIKACHU_EARS: { rot: 0, scale: 1.0, ox: 0, oy: -3 }, MAJORAS_MASK: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, MASTER_SWORD: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, ONE_HIT_OBLITERATOR: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, POKEBALL: { rot: 0, scale: 1.0, ox: 0, oy: 0 } },
  ARCANINE:     { MARIOS_HAT: { rot: -5, scale: 1.0, ox: 0, oy: 0 }, LINKS_HAT: { rot: -5, scale: 1.0, ox: 0, oy: 0 }, PIKACHU_EARS: { rot: -3, scale: 1.0, ox: 0, oy: -2 }, MAJORAS_MASK: { rot: -3, scale: 1.0, ox: 0, oy: 0 }, MASTER_SWORD: { rot: 0, scale: 1.0, ox: -5, oy: 0 }, ONE_HIT_OBLITERATOR: { rot: 0, scale: 1.0, ox: -5, oy: 0 }, POKEBALL: { rot: 0, scale: 1.0, ox: -5, oy: 0 } },
  TYRANITAR:    { MARIOS_HAT: { rot: -3, scale: 1.0, ox: 0, oy: 0 }, LINKS_HAT: { rot: -3, scale: 1.0, ox: 0, oy: 0 }, PIKACHU_EARS: { rot: 0, scale: 1.0, ox: 0, oy: -2 }, MAJORAS_MASK: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, MASTER_SWORD: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, ONE_HIT_OBLITERATOR: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, POKEBALL: { rot: 0, scale: 1.0, ox: 0, oy: 0 } },
  SKELEDIRGE:   { MARIOS_HAT: { rot: -8, scale: 1.0, ox: 0, oy: 0 }, LINKS_HAT: { rot: -8, scale: 1.0, ox: 0, oy: 0 }, PIKACHU_EARS: { rot: -5, scale: 1.0, ox: 0, oy: -2 }, MAJORAS_MASK: { rot: -5, scale: 1.0, ox: 0, oy: 0 }, MASTER_SWORD: { rot: 0, scale: 1.0, ox: -10, oy: 0 }, ONE_HIT_OBLITERATOR: { rot: 0, scale: 1.0, ox: -10, oy: 0 }, POKEBALL: { rot: 0, scale: 1.0, ox: -10, oy: 0 } },
  TINKATON:     { MARIOS_HAT: { rot: -5, scale: 1.0, ox: 0, oy: 0 }, LINKS_HAT: { rot: -5, scale: 1.0, ox: 0, oy: 0 }, PIKACHU_EARS: { rot: -3, scale: 1.0, ox: 0, oy: -3 }, MAJORAS_MASK: { rot: -3, scale: 1.0, ox: 0, oy: 0 }, MASTER_SWORD: { rot: 0, scale: 1.0, ox: -5, oy: 0 }, ONE_HIT_OBLITERATOR: { rot: 0, scale: 1.0, ox: -5, oy: 0 }, POKEBALL: { rot: 0, scale: 1.0, ox: -5, oy: 0 } },
  // ── Violet Classics ──
  PIKACHU:      { MARIOS_HAT: { rot: 0, scale: 1.0, ox: 0, oy: -2 }, LINKS_HAT: { rot: 0, scale: 1.0, ox: 0, oy: -2 }, PIKACHU_EARS: { rot: 0, scale: 1.0, ox: 0, oy: -4 }, MAJORAS_MASK: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, MASTER_SWORD: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, ONE_HIT_OBLITERATOR: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, POKEBALL: { rot: 0, scale: 1.0, ox: 0, oy: 0 } },
  GENGAR:       { MARIOS_HAT: { rot: 0, scale: 1.0, ox: 0, oy: -2 }, LINKS_HAT: { rot: 0, scale: 1.0, ox: 0, oy: -2 }, PIKACHU_EARS: { rot: 0, scale: 1.0, ox: 0, oy: -4 }, MAJORAS_MASK: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, MASTER_SWORD: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, ONE_HIT_OBLITERATOR: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, POKEBALL: { rot: 0, scale: 1.0, ox: 0, oy: 0 } },
  METAGROSS:    { MARIOS_HAT: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, LINKS_HAT: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, PIKACHU_EARS: { rot: 0, scale: 1.0, ox: 0, oy: -2 }, MAJORAS_MASK: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, MASTER_SWORD: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, ONE_HIT_OBLITERATOR: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, POKEBALL: { rot: 0, scale: 1.0, ox: 0, oy: 0 } },
  LUCARIO:      { MARIOS_HAT: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, LINKS_HAT: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, PIKACHU_EARS: { rot: 0, scale: 1.0, ox: 0, oy: -2 }, MAJORAS_MASK: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, MASTER_SWORD: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, ONE_HIT_OBLITERATOR: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, POKEBALL: { rot: 0, scale: 1.0, ox: 0, oy: 0 } },
  GARDEVOIR:    { MARIOS_HAT: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, LINKS_HAT: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, PIKACHU_EARS: { rot: 0, scale: 1.0, ox: 0, oy: -2 }, MAJORAS_MASK: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, MASTER_SWORD: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, ONE_HIT_OBLITERATOR: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, POKEBALL: { rot: 0, scale: 1.0, ox: 0, oy: 0 } },
  SYLVEON:      { MARIOS_HAT: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, LINKS_HAT: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, PIKACHU_EARS: { rot: 0, scale: 1.0, ox: 0, oy: -2 }, MAJORAS_MASK: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, MASTER_SWORD: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, ONE_HIT_OBLITERATOR: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, POKEBALL: { rot: 0, scale: 1.0, ox: 0, oy: 0 } },
  DRAGAPULT:    { MARIOS_HAT: { rot: -5, scale: 1.0, ox: 0, oy: 0 }, LINKS_HAT: { rot: -5, scale: 1.0, ox: 0, oy: 0 }, PIKACHU_EARS: { rot: -3, scale: 1.0, ox: 0, oy: -2 }, MAJORAS_MASK: { rot: -3, scale: 1.0, ox: 0, oy: 0 }, MASTER_SWORD: { rot: 0, scale: 1.0, ox: -5, oy: 0 }, ONE_HIT_OBLITERATOR: { rot: 0, scale: 1.0, ox: -5, oy: 0 }, POKEBALL: { rot: 0, scale: 1.0, ox: -5, oy: 0 } },
  CHIEN_PAO:    { MARIOS_HAT: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, LINKS_HAT: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, PIKACHU_EARS: { rot: 0, scale: 1.0, ox: 0, oy: -2 }, MAJORAS_MASK: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, MASTER_SWORD: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, ONE_HIT_OBLITERATOR: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, POKEBALL: { rot: 0, scale: 1.0, ox: 0, oy: 0 } },
  ZAPDOS:       { MARIOS_HAT: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, LINKS_HAT: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, PIKACHU_EARS: { rot: 0, scale: 1.0, ox: 0, oy: -2 }, MAJORAS_MASK: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, MASTER_SWORD: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, ONE_HIT_OBLITERATOR: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, POKEBALL: { rot: 0, scale: 1.0, ox: 0, oy: 0 } },
  BRAMBLEGHAST: { MARIOS_HAT: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, LINKS_HAT: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, PIKACHU_EARS: { rot: 0, scale: 1.0, ox: 0, oy: -2 }, MAJORAS_MASK: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, MASTER_SWORD: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, ONE_HIT_OBLITERATOR: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, POKEBALL: { rot: 0, scale: 1.0, ox: 0, oy: 0 } },
  AUDINO:       { MARIOS_HAT: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, LINKS_HAT: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, PIKACHU_EARS: { rot: 0, scale: 1.0, ox: 0, oy: -2 }, MAJORAS_MASK: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, MASTER_SWORD: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, ONE_HIT_OBLITERATOR: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, POKEBALL: { rot: 0, scale: 1.0, ox: 0, oy: 0 } },
  MIMIKYU:      { MARIOS_HAT: { rot: 0, scale: 1.0, ox: 0, oy: -2 }, LINKS_HAT: { rot: 0, scale: 1.0, ox: 0, oy: -2 }, PIKACHU_EARS: { rot: 0, scale: 1.0, ox: 0, oy: -4 }, MAJORAS_MASK: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, MASTER_SWORD: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, ONE_HIT_OBLITERATOR: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, POKEBALL: { rot: 0, scale: 1.0, ox: 0, oy: 0 } },
  TOXTRICITY:   { MARIOS_HAT: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, LINKS_HAT: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, PIKACHU_EARS: { rot: 0, scale: 1.0, ox: 0, oy: -2 }, MAJORAS_MASK: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, MASTER_SWORD: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, ONE_HIT_OBLITERATOR: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, POKEBALL: { rot: 0, scale: 1.0, ox: 0, oy: 0 } },
  CERULEDGE:    { MARIOS_HAT: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, LINKS_HAT: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, PIKACHU_EARS: { rot: 0, scale: 1.0, ox: 0, oy: -2 }, MAJORAS_MASK: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, MASTER_SWORD: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, ONE_HIT_OBLITERATOR: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, POKEBALL: { rot: 0, scale: 1.0, ox: 0, oy: 0 } },
  KINGAMBIT:    { MARIOS_HAT: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, LINKS_HAT: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, PIKACHU_EARS: { rot: 0, scale: 1.0, ox: 0, oy: -2 }, MAJORAS_MASK: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, MASTER_SWORD: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, ONE_HIT_OBLITERATOR: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, POKEBALL: { rot: 0, scale: 1.0, ox: 0, oy: 0 } },
  HATTERENE:    { MARIOS_HAT: { rot: -3, scale: 1.0, ox: 0, oy: 0 }, LINKS_HAT: { rot: -3, scale: 1.0, ox: 0, oy: 0 }, PIKACHU_EARS: { rot: 0, scale: 1.0, ox: 0, oy: -2 }, MAJORAS_MASK: { rot: 0, scale: 1.0, ox: 0, oy: 0 }, MASTER_SWORD: { rot: 0, scale: 1.0, ox: -5, oy: 0 }, ONE_HIT_OBLITERATOR: { rot: 0, scale: 1.0, ox: -5, oy: 0 }, POKEBALL: { rot: 0, scale: 1.0, ox: -5, oy: 0 } },
};

/** Get cosmetic override for a specific pokemon + cosmetic combo */
function getCosmeticOverride(pokemonKey, cosmeticId) {
  return COSMETIC_OVERRIDES[pokemonKey]?.[cosmeticId] || null;
}

// Persistent board grid — built once, updated in-place
let _cells = null; // Map<"row,col", HTMLElement>
let _boardEl = null;
let _lastViewColor = null;

// Rainbow trail state (cosmetic only)
let _rainbowTrails = []; // { row, col, age }
let _sparkleTrails = []; // { row, col, age }
let _lastBoard = null;  // snapshot to detect moves

/**
 * Render the board to the DOM
 */
export function renderBoard(game, callbacks) {
  const container = document.getElementById('board-container');
  if (!container) return;

  const viewColor = game.onlineColor ?? game.playerColor ?? 'white';
  const flipped = viewColor === 'black';
  const files = ['a','b','c','d','e','f','g','h'];

  // Build grid skeleton once (or when perspective flips or board was detached)
  if (!_boardEl || !document.contains(_boardEl) || _lastViewColor !== viewColor) {
    const oldBoard = container.querySelector('.chess-board');
    if (oldBoard) oldBoard.remove();

    _cells = new Map();
    _boardEl = document.createElement('div');
    _boardEl.className = 'chess-board';
    _boardEl.id = 'chess-board';

    for (let ri = 0; ri < 8; ri++) {
      for (let ci = 0; ci < 8; ci++) {
        const row = flipped ? (7 - ri) : ri;
        const col = flipped ? (7 - ci) : ci;
        const cell = document.createElement('div');
        const isLight = (row + col) % 2 === 0;
        cell.className = `cell ${isLight ? 'cell--light' : 'cell--dark'}`;
        cell.dataset.row = row;
        cell.dataset.col = col;

        if (ci === 0) {
          const rl = document.createElement('span');
          rl.className = 'cell__coord cell__coord--rank';
          rl.textContent = 8 - row;
          cell.appendChild(rl);
        }
        if (ri === 7) {
          const fl = document.createElement('span');
          fl.className = 'cell__coord cell__coord--file';
          fl.textContent = files[col];
          cell.appendChild(fl);
        }

        _cells.set(`${row},${col}`, cell);
        _boardEl.appendChild(cell);
      }
    }

    container.prepend(_boardEl);
    _lastViewColor = viewColor;
  }

  // ── Rainbow trail detection ──
  if (getEquippedCosmetic() === 'RAINBOW' && _lastBoard) {
    const playerColor = game.onlineColor ?? game.playerColor ?? 'white';
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const prev = _lastBoard[r]?.[c];
        const curr = game.board[r][c];
        // A player piece left this cell
        if (prev && prev.color === playerColor && (!curr || curr !== prev)) {
          // Don't add duplicate
          if (!_rainbowTrails.some(t => t.row === r && t.col === c)) {
            _rainbowTrails.push({ row: r, col: c, age: 0 });
          }
        }
      }
    }
    // Age all trails and remove old ones
    _rainbowTrails = _rainbowTrails
      .map(t => ({ ...t, age: t.age + 1 }))
      .filter(t => t.age <= 10);
  } else if (getEquippedCosmetic() !== 'RAINBOW') {
    _rainbowTrails = [];
  }
  // ── Sparkle trail detection ──
  if (getEquippedCosmetic() === 'SPARKLE' && _lastBoard) {
    const playerColor = game.onlineColor ?? game.playerColor ?? 'white';
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const prev = _lastBoard[r]?.[c];
        const curr = game.board[r][c];
        if (prev && prev.color === playerColor && (!curr || curr !== prev)) {
          if (!_sparkleTrails.some(t => t.row === r && t.col === c)) {
            _sparkleTrails.push({ row: r, col: c, age: 0 });
          }
        }
      }
    }
    _sparkleTrails = _sparkleTrails
      .map(t => ({ ...t, age: t.age + 1 }))
      .filter(t => t.age <= 6);
  } else if (getEquippedCosmetic() !== 'SPARKLE') {
    _sparkleTrails = [];
  }
  // Snapshot board for next comparison
  _lastBoard = game.board.map(row => row.map(cell => cell));

  // Update each cell in-place (no DOM destroy/rebuild)
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const cell = _cells.get(`${row},${col}`);
      if (!cell) continue;

      // Reset dynamic classes
      const isLight = (row + col) % 2 === 0;
      cell.className = `cell ${isLight ? 'cell--light' : 'cell--dark'}`;

      // Remove dynamic children (pieces, dots, tooltips, lava) but keep coords
      for (let i = cell.children.length - 1; i >= 0; i--) {
        const child = cell.children[i];
        if (child.classList.contains('cell__coord')) continue;
        child.remove();
      }

      // Selected
      if (game.selectedPiece?.row === row && game.selectedPiece?.col === col) {
        cell.classList.add('cell--selected');
      }

      // Last move highlights
      if (game.lastMove) {
        if ((game.lastMove.from.row === row && game.lastMove.from.col === col) ||
            (game.lastMove.to.row === row && game.lastMove.to.col === col)) {
          cell.classList.add('cell--last-move');
        }
      }

      // Legal moves
      const legalMove = game.legalMoves.find(m => m.row === row && m.col === col);
      if (legalMove) {
        if (legalMove.isCapture) {
          cell.classList.add('cell--capture');
        } else {
          const dot = document.createElement('div');
          dot.className = 'cell__move-dot';
          cell.appendChild(dot);
        }
      }

      // Optional attack targets
      if (game.pendingOptionalAttack) {
        const isTarget = game.pendingOptionalAttack.targets.some(t => t.row === row && t.col === col);
        if (isTarget) {
          cell.classList.add('cell--optional-attack');
        }
      }

      // Lava trail overlay
      if (game.lavaTrails && game.lavaTrails.length > 0) {
        const lava = game.lavaTrails.find(t => t.row === row && t.col === col);
        if (lava) {
          cell.classList.add('cell--lava-trail');
          const lavaPool = document.createElement('div');
          lavaPool.className = 'cell__lava-pool';
          for (let b = 0; b < 4; b++) {
            const bubble = document.createElement('div');
            bubble.className = 'cell__lava-bubble';
            bubble.style.setProperty('--bx', `${15 + Math.random() * 70}%`);
            bubble.style.setProperty('--by', `${20 + Math.random() * 60}%`);
            bubble.style.setProperty('--bd', `${0.6 + Math.random() * 1.2}s`);
            bubble.style.setProperty('--bdelay', `${Math.random() * 1.5}s`);
            lavaPool.appendChild(bubble);
          }
          cell.appendChild(lavaPool);
        }
      }

      // Rainbow trail overlay (cosmetic — only when RAINBOW equipped)
      if (getEquippedCosmetic() === 'RAINBOW') {
        const trail = _rainbowTrails.find(t => t.row === row && t.col === col);
        if (trail) {
          cell.classList.add('cell--rainbow-trail');
          cell.style.setProperty('--rainbow-age', trail.age);
        }
      }

      // Sparkle trail overlay (cosmetic — only when SPARKLE equipped)
      if (getEquippedCosmetic() === 'SPARKLE') {
        const trail = _sparkleTrails.find(t => t.row === row && t.col === col);
        if (trail) {
          cell.classList.add('cell--sparkle-trail');
          const trailContainer = document.createElement('div');
          trailContainer.className = 'cell__sparkle-trail';
          const count = Math.max(2, 5 - trail.age);
          for (let s = 0; s < count; s++) {
            const sp = document.createElement('span');
            sp.textContent = '✨';
            sp.style.left = `${10 + Math.random() * 80}%`;
            sp.style.top = `${10 + Math.random() * 80}%`;
            sp.style.animationDelay = `${Math.random() * 0.5}s`;
            sp.style.opacity = Math.max(0.1, 1 - trail.age * 0.15);
            trailContainer.appendChild(sp);
          }
          cell.appendChild(trailContainer);
        }
      }

      // Piece
      const piece = game.board[row][col];
      if (piece) {
        const playerColor = game.onlineColor ?? game.playerColor ?? 'white';
        const pieceEl = createPieceElement(piece, playerColor);
        cell.appendChild(pieceEl);

        // Battle tooltip on capture targets
        if (legalMove?.isCapture && game.selectedPiece) {
          const atk = game.board[game.selectedPiece.row][game.selectedPiece.col];
          if (atk) {
            const preview = getBattlePreview(atk, piece);
            const tooltip = createBattleTooltip(preview, atk, piece);
            cell.appendChild(tooltip);
            cell.classList.add('cell--has-tooltip');
          }
        }
      }

      // Update click handler via data attribute
      cell.onclick = () => {
        callbacks?.onCellClick?.(row, col, !!legalMove, legalMove);
      };
    }
  }
}

/**
 * Create a piece element with Pokémon identity and HP bar
 */
function createPieceElement(piece, playerColor) {
  const el = document.createElement('div');
  el.className = `piece piece--${piece.color}`;
  if (piece.role === 'TRUE_KING') el.classList.add('piece--true-king');
  if (piece.bikeMode) el.classList.add('piece--bike-mode');
  if (piece.promoted) el.classList.add('piece--promoted');
  if (piece.focusSash) el.classList.add('piece--sash');
  if (piece.obliterator) el.classList.add('piece--obliterator');
  el.dataset.pieceId = piece.id;
  el.dataset.role = piece.role;

  const team = TEAMS[COLOR_TO_TEAM[piece.color]];
  const pkmn = piece.pokemon ? POKEMON[piece.pokemon] : null;

  // ── Sprite wrapper: cosmetics position relative to THIS, not the full piece ──
  const wrap = document.createElement('div');
  wrap.className = 'piece__sprite-wrap';

  // Main visual — Pokémon sprite image or emoji fallback
  if (pkmn?.img) {
    const img = document.createElement('img');
    img.className = 'piece__img';
    if (piece.role === 'TRUE_KING') img.classList.add('piece__img--legendary');
    img.src = pkmn.img;
    img.alt = pkmn.name;
    img.draggable = false;
    wrap.appendChild(img);
  } else if (pkmn) {
    const symbol = document.createElement('span');
    symbol.className = 'piece__emoji';
    symbol.textContent = pkmn.emoji;
    wrap.appendChild(symbol);
  } else {
    const symbol = document.createElement('span');
    symbol.className = 'piece__emoji piece__emoji--pawn';
    symbol.textContent = team.pawnEmoji;
    wrap.appendChild(symbol);
  }

  // ── Cosmetic overlay — only on the PLAYER's pieces ──
  const isPlayerPiece = piece.color === playerColor;
  const cosmeticId = isPlayerPiece ? getEquippedCosmetic() : null;
  if (cosmeticId) {
    const cosmetic = COSMETICS[cosmeticId];
    if (cosmetic) {
      const headData = (piece.pokemon && POKEMON_HEAD_MAP[piece.pokemon]) || DEFAULT_HEAD;

      if (cosmeticId === 'SPARKLE') {
        for (let i = 0; i < 5; i++) {
          const spark = document.createElement('span');
          spark.className = 'piece__sparkle';
          spark.textContent = '✨';
          spark.style.setProperty('--sx', `${10 + Math.random() * 80}%`);
          spark.style.setProperty('--sy', `${10 + Math.random() * 80}%`);
          spark.style.setProperty('--sd', `${0.5 + Math.random() * 1.5}s`);
          spark.style.setProperty('--sdelay', `${Math.random() * 2}s`);
          wrap.appendChild(spark);
        }
      } else if (cosmeticId === 'FLAME_AURA') {
        wrap.classList.add('piece__aura--flame');
        for (let i = 0; i < 4; i++) {
          const flame = document.createElement('span');
          flame.className = 'piece__flame-particle';
          flame.textContent = '🔥';
          flame.style.setProperty('--fx', `${10 + Math.random() * 80}%`);
          flame.style.setProperty('--fd', `${0.6 + Math.random() * 1}s`);
          flame.style.setProperty('--fdelay', `${Math.random() * 1.5}s`);
          wrap.appendChild(flame);
        }
      } else if (cosmeticId === 'ICE_AURA') {
        wrap.classList.add('piece__aura--ice');
        for (let i = 0; i < 4; i++) {
          const frost = document.createElement('span');
          frost.className = 'piece__frost-particle';
          frost.textContent = '❄️';
          frost.style.setProperty('--ix', `${10 + Math.random() * 80}%`);
          frost.style.setProperty('--id', `${0.8 + Math.random() * 1.2}s`);
          frost.style.setProperty('--idelay', `${Math.random() * 2}s`);
          wrap.appendChild(frost);
        }
      } else if (cosmetic.img) {
        // Image-based cosmetics (hats, masks, sword, pokeball)
        const cosEl = document.createElement('img');
        cosEl.className = `piece__cosmetic piece__cosmetic--${cosmetic.position} piece__cosmetic--img`;
        if (cosmeticId === 'ONE_HIT_OBLITERATOR') cosEl.classList.add('piece__cosmetic--obliterator');
        cosEl.src = cosmetic.img;
        cosEl.draggable = false;
        // Get per-pokemon per-cosmetic overrides for rotation, scale, offset
        const ovr = getCosmeticOverride(piece.pokemon, cosmeticId);
        const extraRot = ovr?.rot || 0;
        const extraScale = ovr?.scale || 1.0;
        const ox = ovr?.ox || 0;
        const oy = ovr?.oy || 0;
        // Size — masks/sword are large and prominent, hats are smaller (sit on head)
        const baseSize = cosmetic.position === 'middle' ? 65 : cosmetic.position === 'top' ? 40 : cosmetic.position === 'bottom' ? 45 : 60;
        const size = Math.round(baseSize * headData.headScale * extraScale);
        cosEl.style.width = `${size}%`;
        if (cosmetic.position === 'top') {
          // Hats: sit prominently on top of the head
          cosEl.style.top = `${headData.headTop - 12 + oy}%`;
          cosEl.style.left = `${headData.headLeft + ox}%`;
          cosEl.style.transform = `translateX(-50%) rotate(${-5 + extraRot}deg)`;
        } else if (cosmetic.position === 'middle') {
          // Masks: large, covering most of the face
          cosEl.style.top = `${headData.headTop + oy}%`;
          cosEl.style.left = `${headData.headLeft + ox}%`;
          cosEl.style.transform = `translate(-50%, -50%) rotate(${extraRot}deg)`;
        } else if (cosmetic.position === 'aura') {
          // Sword: held at front-left, angled diagonally blade-up
          cosEl.style.bottom = `${5 + oy}%`;
          cosEl.style.left = `${headData.headLeft - 15 + ox}%`;
          cosEl.style.top = 'auto';
          cosEl.style.right = 'auto';
          cosEl.style.transform = `translateX(-50%) rotate(${-35 + extraRot}deg)`;
        } else if (cosmetic.position === 'bottom') {
          // Feet items (pokeball)
          cosEl.style.bottom = `${2 + oy}%`;
          cosEl.style.left = `${headData.headLeft + ox}%`;
          cosEl.style.transform = `translateX(-50%) rotate(${extraRot}deg)`;
          cosEl.style.top = 'auto';
        }
        wrap.appendChild(cosEl);
      } else {
        // Emoji-based cosmetics (crown, bow, sunglasses, rainbow)
        const overlay = document.createElement('span');
        overlay.className = `piece__cosmetic piece__cosmetic--${cosmetic.position}`;
        overlay.textContent = cosmetic.overlay;
        // Get per-pokemon per-cosmetic overrides
        const eovr = getCosmeticOverride(piece.pokemon, cosmeticId);
        const eRot = eovr?.rot || 0;
        const eScale = eovr?.scale || 1.0;
        const eox = eovr?.ox || 0;
        const eoy = eovr?.oy || 0;
        if (cosmetic.position === 'top') {
          overlay.style.top = `${headData.headTop - 12 + eoy}%`;
          overlay.style.left = `${headData.headLeft + eox}%`;
          overlay.style.transform = `translateX(-50%) rotate(${eRot}deg)`;
          overlay.style.fontSize = `${Math.round(180 * headData.headScale * eScale)}%`;
        } else if (cosmetic.position === 'middle') {
          overlay.style.top = `${headData.headTop + eoy}%`;
          overlay.style.left = `${headData.headLeft + eox}%`;
          overlay.style.transform = `translate(-50%, -50%) rotate(${eRot}deg)`;
          overlay.style.fontSize = `${Math.round(180 * headData.headScale * eScale)}%`;
        } else if (cosmetic.position === 'bottom') {
          overlay.style.bottom = `${5 + eoy}%`;
          overlay.style.left = `${headData.headLeft + eox}%`;
          overlay.style.transform = `translateX(-50%) rotate(${eRot}deg)`;
          overlay.style.top = 'auto';
        }
        wrap.appendChild(overlay);
      }
    }
  }

  // Obliterator weapon overlay — floating and glowing at the front
  if (piece.obliterator) {
    const headData = (piece.pokemon && POKEMON_HEAD_MAP[piece.pokemon]) || DEFAULT_HEAD;
    const sword = document.createElement('img');
    sword.className = 'piece__obliterator-sword piece__cosmetic--obliterator piece__obliterator-float';
    sword.src = '/assets/cosmetics/one_hit_obliterator.png';
    sword.alt = 'Obliterator';
    sword.draggable = false;
    sword.style.position = 'absolute';
    sword.style.width = '38%';
    sword.style.height = 'auto';
    sword.style.bottom = '5%';
    sword.style.left = `${headData.headLeft - 32}%`;
    sword.style.top = 'auto';
    sword.style.transform = 'rotate(-30deg)';
    sword.style.zIndex = '5';
    wrap.appendChild(sword);
  }

  el.appendChild(wrap);

  // HP Bar
  const hpBar = document.createElement('div');
  hpBar.className = 'piece__hp-bar';
  const hpFill = document.createElement('div');
  hpFill.className = 'piece__hp-fill';
  const hpPercent = Math.max(0, (piece.hp / piece.maxHp) * 100);
  hpFill.style.width = `${hpPercent}%`;
  // Color based on HP percentage
  if (hpPercent > 60) hpFill.classList.add('hp--high');
  else if (hpPercent > 30) hpFill.classList.add('hp--mid');
  else hpFill.classList.add('hp--low');
  hpBar.appendChild(hpFill);
  // Obliterator indicator next to HP bar
  if (piece.obliterator) {
    const oblIcon = document.createElement('img');
    oblIcon.className = 'piece__hp-obliterator';
    oblIcon.src = '/assets/cosmetics/one_hit_obliterator.png';
    oblIcon.alt = '🗡️';
    oblIcon.draggable = false;
    hpBar.appendChild(oblIcon);
  }
  el.appendChild(hpBar);

  // HP text (shown on hover)
  const hpText = document.createElement('span');
  hpText.className = 'piece__hp-text';
  hpText.textContent = `${piece.hp}/${piece.maxHp}`;
  el.appendChild(hpText);

  // Name label (on hover)
  const name = document.createElement('span');
  name.className = 'piece__name';
  if (pkmn) {
    name.textContent = `${pkmn.name} (DMG:${piece.damage})`;
  } else {
    name.textContent = team.pawnName;
  }
  el.appendChild(name);

  // Type color glow
  const primaryColor = TYPES[piece.types[0]]?.color ?? '#888';
  el.style.setProperty('--piece-type-color', primaryColor);
  el.style.setProperty('--piece-team-color', team.color);

  // Status effects (frozen / stunned / poisoned / paralyzed)
  if (piece.statusEffect) {
    el.classList.add(`piece--${piece.statusEffect}`);
    const statusIcon = document.createElement('div');
    statusIcon.className = 'piece__status';
    const iconMap = { frozen: '❄️', stunned: '😵', poisoned: '☠️', paralyzed: '⚡' };
    statusIcon.textContent = iconMap[piece.statusEffect] || '❓';
    el.appendChild(statusIcon);
  }

  // Intimidate debuff indicator
  if (piece.intimidated) {
    el.classList.add('piece--intimidated');
    const intimIcon = document.createElement('div');
    intimIcon.className = 'piece__status piece__status--intimidate';
    intimIcon.textContent = '💪';
    intimIcon.title = `Intimidated! -1 DMG (${piece.intimidateTimer || 0} turns left)`;
    el.appendChild(intimIcon);
  }

  return el;
}

/**
 * Battle preview tooltip — HP-based
 */
function createBattleTooltip(preview, attacker, defender) {
  const tooltip = document.createElement('div');
  tooltip.className = 'battle-tooltip';

  const atkName = POKEMON[attacker.pokemon]?.name ?? 'Attacker';
  const defName = POKEMON[defender.pokemon]?.name ?? 'Defender';

  const tierEmoji = { weak: '🔹', standard: '⚔️', heavy: '💥' };
  const tierLabel = { weak: 'Weak', standard: 'Standard', heavy: 'Heavy' };
  const tier = preview.attackerDamageTier;

  const killText = preview.wouldKill
    ? '<span class="tooltip-kill">💀 WILL KILL</span>'
    : `<span class="tooltip-survive">❤️ Survives (${preview.defenderHpAfter} HP left)</span>`;

  const typeEffLabel = preview.typeMultiplier >= 2
    ? '<span class="tooltip-super-eff">🔥 Super Effective! (2x)</span>'
    : preview.typeMultiplier <= 0.5
    ? '<span class="tooltip-not-eff">🛡️ Not Very Effective (½x)</span>'
    : '';

  tooltip.innerHTML = `
    <div class="battle-tooltip__matchup">
      <span>${atkName}</span>
      <span class="battle-tooltip__arrow">→</span>
      <span>${defName}</span>
    </div>
    ${typeEffLabel ? `<div class="battle-tooltip__type-eff">${typeEffLabel}</div>` : ''}
    ${preview.isIntimidated ? '<div class="battle-tooltip__debuff">💪 Intimidated (-2 DMG)</div>' : ''}
    <div class="battle-tooltip__damage">
      ${tierEmoji[tier] ?? '⚔️'} ${tierLabel[tier] ?? 'Standard'} — ${preview.baseDamage} DMG
    </div>
    <div class="battle-tooltip__hp">
      ❤️ ${defender.hp}/${defender.maxHp} HP → ${preview.defenderHpAfter} HP
    </div>
    <div class="battle-tooltip__eff ${preview.wouldKill ? 'super-effective' : 'normal'}">${killText}</div>
    ${preview.counterDamage > 0 ? `<div class="battle-tooltip__counter">🌿 Thorns: ${preview.counterDamage} DMG reflected!</div>` : ''}
    <div class="battle-tooltip__stats">${preview.critPercent}% crit (${preview.critDamage} DMG)</div>
  `;

  return tooltip;
}

export function animateCell(row, col, animClass, duration = 600) {
  const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
  if (cell) {
    cell.classList.add(animClass);
    setTimeout(() => cell.classList.remove(animClass), duration);
  }
}

/**
 * Show floating damage number on a cell
 */
export function showDamageNumber(row, col, damage, isCrit) {
  const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
  if (!cell) return;

  const dmgEl = document.createElement('div');
  dmgEl.className = `damage-number ${isCrit ? 'damage-number--crit' : ''}`;
  dmgEl.textContent = `-${damage}`;
  cell.appendChild(dmgEl);
  setTimeout(() => dmgEl.remove(), 1200);
}

/**
 * Play attack particle effect on a cell
 */
export function playAttackEffect(row, col, battleResult) {
  const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
  if (!cell) return;

  const rect = cell.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  const isKill = battleResult.outcome === 'kill';
  const isCrit = battleResult.isCritical;

  // Flash the cell
  const flashClass = isKill ? 'cell--flash-kill' : (isCrit ? 'cell--flash-crit' : 'cell--flash-hit');
  cell.classList.add(flashClass);
  setTimeout(() => cell.classList.remove(flashClass), 400);

  // Spawn impact particles
  const particleCount = isKill ? 16 : (isCrit ? 12 : 8);
  const hue = isKill ? '0' : (isCrit ? '45' : '30');

  for (let i = 0; i < particleCount; i++) {
    const p = document.createElement('div');
    p.className = `attack-particle ${isKill ? 'attack-particle--kill' : ''} ${isCrit ? 'attack-particle--crit' : ''}`;
    const angle = (Math.PI * 2 / particleCount) * i + (Math.random() - 0.5) * 0.5;
    const dist = 20 + Math.random() * 35;
    const size = 3 + Math.random() * 4;

    p.style.left = `${cx}px`;
    p.style.top = `${cy}px`;
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    p.style.setProperty('--px', `${Math.cos(angle) * dist}px`);
    p.style.setProperty('--py', `${Math.sin(angle) * dist}px`);
    p.style.setProperty('--hue', hue);
    p.style.animationDelay = `${Math.random() * 80}ms`;

    document.body.appendChild(p);
    setTimeout(() => p.remove(), 700);
  }

  // Slash line effect
  const slash = document.createElement('div');
  slash.className = `attack-slash ${isKill ? 'attack-slash--kill' : ''}`;
  slash.style.left = `${cx}px`;
  slash.style.top = `${cy}px`;
  document.body.appendChild(slash);
  setTimeout(() => slash.remove(), 500);

  // Screen shake on kill
  if (isKill) {
    const board = document.getElementById('chess-board');
    if (board) {
      board.classList.add('board--shake');
      setTimeout(() => board.classList.remove('board--shake'), 300);
    }
  }
}
