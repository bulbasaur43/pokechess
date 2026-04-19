/**
 * Battle Resolution System for PokéChess — HP-Based Combat
 * Pieces have HP; attacks reduce HP. Pieces die when HP reaches 0.
 * Type effectiveness: super effective = 2x, not very effective = 0.5x
 */

import { POKEMON, TYPES, getTypeMultiplier, ABILITIES } from './types.js';

const CRIT_RATE = 0.08;
const CRIT_MULTIPLIER = 2;

/**
 * Resolve a battle when a piece attempts to capture another.
 * Returns the result including damage dealt and whether the defender died.
 */
export function resolveBattle(attacker, defender) {
  const result = {
    attacker: { ...attacker },
    defender: { ...defender },
    outcome: null,       // 'kill' | 'damage' | 'no_effect'
    isCritical: false,
    typeMultiplier: 1,
    damageDealt: 0,
    defenderHpBefore: defender.hp,
    defenderHpAfter: defender.hp,

    message: '',
    messages: [],
  };

  // Calculate base damage
  let baseDamage = attacker.damage;

  // Intimidate debuff: -1 damage
  if (attacker.intimidated) {
    baseDamage = Math.max(1, baseDamage - 1);
    result.messages.push('💪 Intimidated! -1 damage.');
  }

  // Type effectiveness
  const typeMult = getTypeMultiplier(attacker.types, defender.types);
  result.typeMultiplier = typeMult;

  if (typeMult >= 2) {
    result.messages.push('🔥 Super effective! Double damage!');
  } else if (typeMult <= 0.5) {
    result.messages.push('🛡️ Not very effective... Half damage.');
  }

  baseDamage = Math.max(1, Math.floor(baseDamage * typeMult));

  // Critical hit check (8% = double damage)
  const critRoll = Math.random();
  if (critRoll < CRIT_RATE) {
    result.isCritical = true;
    baseDamage *= CRIT_MULTIPLIER;
    result.messages.push('💥 CRITICAL HIT! Double damage!');
  }

  result.damageDealt = baseDamage;
  result.defenderHpAfter = Math.max(0, defender.hp - baseDamage);

  const atkName = POKEMON[attacker.pokemon]?.name ?? 'Attacker';
  const defName = POKEMON[defender.pokemon]?.name ?? 'Defender';

  // Determine damage tier label
  const tierLabels = { weak: '🔹 Weak', standard: '⚔️ Standard', heavy: '💥 Heavy' };
  const tierLabel = tierLabels[attacker.damageTier] ?? '⚔️';
  result.messages.push(`${tierLabel} attack! ${baseDamage} damage dealt.`);

  if (result.defenderHpAfter <= 0) {
    // Kill — defender is eliminated
    result.outcome = 'kill';
    result.message = `${atkName} defeats ${defName}!`;
    result.messages.push(`💀 ${defName} eliminated!`);
  } else {
    // Damage — defender survives
    result.outcome = 'damage';
    result.message = `${atkName} deals ${baseDamage} damage to ${defName}!`;
    result.messages.push(`${defName} survives with ${result.defenderHpAfter}/${defender.maxHp} HP.`);
    result.messages.push('Attacker returns to original square.');
  }

  // Brambleghast counter: reflect damage back to attacker
  result.counterDamage = 0;
  if (defender.pokemon === 'BRAMBLEGHAST') {
    const counterAbility = ABILITIES?.BRAMBLEGHAST;
    if (counterAbility && counterAbility.effect === 'counter') {
      result.counterDamage = counterAbility.damage || 2;
      result.messages.push(`🌿 Thorny Trap! ${atkName} takes ${result.counterDamage} damage back!`);
    }
  }

  return result;
}

/**
 * Preview battle outcome (for tooltips) — includes type effectiveness
 */
export function getBattlePreview(attacker, defender) {
  const typeMult = getTypeMultiplier(attacker.types, defender.types);
  let atkDamage = attacker.damage;
  if (attacker.intimidated) atkDamage = Math.max(1, atkDamage - 1);
  let baseDamage = Math.max(1, Math.floor(atkDamage * typeMult));

  const defHpAfter = Math.max(0, defender.hp - baseDamage);
  const wouldKill = defHpAfter <= 0;
  const critDamage = baseDamage * CRIT_MULTIPLIER;

  // Brambleghast counter warning
  let counterDamage = 0;
  if (defender.pokemon === 'BRAMBLEGHAST') {
    counterDamage = ABILITIES?.BRAMBLEGHAST?.damage || 2;
  }

  return {
    baseDamage,
    critDamage,
    typeMultiplier: typeMult,
    defenderHp: defender.hp,
    defenderMaxHp: defender.maxHp,
    defenderHpAfter: defHpAfter,
    wouldKill,
    critPercent: Math.round(CRIT_RATE * 100),
    attackerDamageTier: attacker.damageTier,
    isIntimidated: !!attacker.intimidated,
    counterDamage,
  };
}
