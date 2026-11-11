import * as THREE from 'three';
import { Component, EntityId } from './Engine';
import { MaterialId, YokaiArchetype } from './catalog';

export class TransformComponent implements Component {
  readonly _type = 'TransformComponent';
  public pos: THREE.Vector3;
  public rotY: number = 0;

  constructor(x = 0, y = 0, z = 0, rotY = 0) {
    this.pos = new THREE.Vector3(x, y, z);
    this.rotY = rotY;
  }
}

export class VelocityComponent implements Component {
  readonly _type = 'VelocityComponent';
  public vel = new THREE.Vector3();
  public moveInputX = 0; // -1..1 (strafe / left-right)
  public moveInputZ = 0; // -1..1 (forward-back)
  public isMoving = false;
  public autoRun = false;
  public sprint = false;
}

export interface BorzoiParts {
  bodyGroup: THREE.Group;
  neckGroup: THREE.Group;
  headGroup: THREE.Group;
  jawWeaponMount: THREE.Group;
  armorMount: THREE.Group;
  legs: THREE.Object3D[];
  tail: THREE.Object3D;
  ears: THREE.Object3D[];
  weaponTrail?: THREE.Mesh;
  floatingOrnaments: THREE.Object3D[];
}

export interface YokaiParts {
  torso: THREE.Object3D;
  head: THREE.Object3D;
  armL: THREE.Object3D;
  armR: THREE.Object3D;
  eye: THREE.Mesh;
  extraParts: THREE.Object3D[];
}

export class MeshComponent implements Component {
  readonly _type = 'MeshComponent';
  public mesh: THREE.Group;
  public borzoiParts?: BorzoiParts;
  public yokaiParts?: YokaiParts;

  constructor(mesh: THREE.Group, borzoiParts?: BorzoiParts, yokaiParts?: YokaiParts) {
    this.mesh = mesh;
    this.borzoiParts = borzoiParts;
    this.yokaiParts = yokaiParts;
  }
}

export class StatsComponent implements Component {
  readonly _type = 'StatsComponent';
  public hp: number;
  public maxHp: number;
  public stamina: number = 100;
  public maxStamina: number = 100;
  public baseDmg: number;
  public level: number;

  // RPG Attributes
  public jawsStrength: number = 1; // +Урон и пробитие
  public vitality: number = 1;     // +Здоровье и защита
  public agility: number = 1;      // +Скорость бега, заряда и крит
  public spirit: number = 1;       // +Урон навыков и парирование

  constructor(hp = 120, maxHp = 120, baseDmg = 14, level = 1) {
    this.hp = hp;
    this.maxHp = maxHp;
    this.baseDmg = baseDmg;
    this.level = level;
  }
}

export class PlayerComponent implements Component {
  readonly _type = 'PlayerComponent';
  public souls: number = 20;
  public floor: number = 1;
  public maxFloorReached: number = 1;
  public inHub: boolean = false;
  public lvlCost: number = 12;
  public potions: number = 2;
  public maxPotions: number = 3;

  public materials: Record<MaterialId, number> = {
    steel: 3,
    silk: 2,
    seal: 1,
    ash: 1,
    jade: 0,
  };

  public unlockedWeapons: Set<string> = new Set(['shibuya_katana']);
  public unlockedArmors: Set<string> = new Set(['street_collar']);

  public equippedWeaponId: string = 'shibuya_katana';
  public equippedArmorId: string = 'street_collar';
  public equippedSkinId: string = 'white_aristocrat';

  public enemiesSlainOnFloor: number = 0;
  public totalEnemiesOnFloor: number = 3;
  public totalKills: number = 0;
}

export type CombatActionState = 'idle' | 'charging' | 'attacking' | 'blocking' | 'skill_cast';

export class CombatComponent implements Component {
  readonly _type = 'CombatComponent';
  public inCombat: boolean = false;
  public targetEntity: EntityId | null = null;
  public state: CombatActionState = 'idle';
  public timer: number = 0;
  public charge: number = 0;
  public chargeDirX: number = 1; // -1 left, 1 right, 0 overhead
  public chargeDirY: number = 0;
  public attackCooldown: number = 0;
  public comboCount: number = 0;
  public comboResetTimer: number = 0;
  public hitFlashTimer: number = 0;

  // Active skill cooldowns (seconds remaining)
  public skillDashCd: number = 0;
  public skillHowlCd: number = 0;
  public skillWhirlCd: number = 0;
}

export type EnemyAIActionState = 'patrol' | 'idle' | 'windup' | 'attack_anim' | 'stunned';

export class EnemyComponent implements Component {
  readonly _type = 'EnemyComponent';
  public archetype: YokaiArchetype;
  public name: string;
  public title: string;
  public isBoss: boolean;
  public state: EnemyAIActionState = 'patrol';
  public timer: number = 1.6;
  public windupTime: number = 0.8;
  public attackInterval: number = 1.7;
  public stunTime: number = 0;
  public bleedTimer: number = 0;
  public bleedTickDmg: number = 0;
  public hitFlashTimer: number = 0;
  public patrolOriginX: number = 0;
  public patrolOriginZ: number = 0;
  public isHeavyAttack: boolean = false;

  constructor(
    archetype: YokaiArchetype,
    name: string,
    title: string,
    windupTime: number,
    attackInterval: number,
    isBoss = false,
    originX = 0,
    originZ = 0
  ) {
    this.archetype = archetype;
    this.name = name;
    this.title = title;
    this.windupTime = windupTime;
    this.attackInterval = attackInterval;
    this.timer = attackInterval;
    this.isBoss = isBoss;
    this.patrolOriginX = originX;
    this.patrolOriginZ = originZ;
  }
}

export class LootDropComponent implements Component {
  readonly _type = 'LootDropComponent';
  public materialId?: MaterialId;
  public amount: number;
  public soulsAmount: number;
  public isHealOrb: boolean;
  public label: string;
  public colorHex: number;
  public cssColor: string;
  public bobPhase: number;
  public pickupRadius: number = 1.6;
  public magnetized: boolean = false;

  constructor(opts: {
    materialId?: MaterialId;
    amount?: number;
    soulsAmount?: number;
    isHealOrb?: boolean;
    label: string;
    colorHex: number;
    cssColor: string;
  }) {
    this.materialId = opts.materialId;
    this.amount = opts.amount ?? 1;
    this.soulsAmount = opts.soulsAmount ?? 0;
    this.isHealOrb = opts.isHealOrb ?? false;
    this.label = opts.label;
    this.colorHex = opts.colorHex;
    this.cssColor = opts.cssColor;
    this.bobPhase = Math.random() * Math.PI * 2;
  }
}

export type InteractableKind =
  | 'portal_next_floor'
  | 'portal_hub'
  | 'portal_enter_abyss'
  | 'shrine_bonfire'
  | 'forge_anvil'
  | 'vending_machine';

export class InteractableComponent implements Component {
  readonly _type = 'InteractableComponent';
  public kind: InteractableKind;
  public title: string;
  public subtitle: string;
  public radius: number;
  public used: boolean = false;

  constructor(kind: InteractableKind, title: string, subtitle: string, radius = 2.4) {
    this.kind = kind;
    this.title = title;
    this.subtitle = subtitle;
    this.radius = radius;
  }
}
