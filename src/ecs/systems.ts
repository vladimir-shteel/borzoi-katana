import * as THREE from 'three';
import { EntityId, System, World } from './Engine';
import {
  ARMORS_CATALOG,
  COAT_SKINS,
  MATERIALS_CATALOG,
  MaterialId,
  WEAPONS_CATALOG,
  YOKAI_CATALOG,
} from './catalog';
import {
  CombatComponent,
  EnemyComponent,
  InteractableComponent,
  InteractableKind,
  LootDropComponent,
  MeshComponent,
  PlayerComponent,
  StatsComponent,
  TransformComponent,
  VelocityComponent,
} from './components';
import {
  buildArmorMesh,
  buildWeaponMesh,
  createInteractableMesh,
  createLootDropMesh,
  createYokaiMesh,
  makeLowPolyMat,
} from './models';
import { sfx } from './audio';

const _camTargetPos = new THREE.Vector3();
const _camLookAt = new THREE.Vector3();

export type RoomTheme = 'entrance' | 'whalebone' | 'taiga' | 'bunker' | 'treasure' | 'exit';

export interface DungeonRoomNode {
  index: number;
  gridX: number;
  gridZ: number;
  cx: number;
  cz: number;
  halfW: number;
  halfD: number;
  theme: RoomTheme;
  name: string;
  visited: boolean;
  cleared: boolean;
}

export interface WalkableRect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export type EventBannerCallback = (text: string, color: string, subtext?: string) => void;
export type StateSyncCallback = () => void;

const ROOM_THEME_NAMES: Record<RoomTheme, string> = {
  entrance: 'Острог: Застава Входа',
  whalebone: 'Чукотское Капище Китов',
  taiga: 'Таёжное Святилище Чуров',
  bunker: 'Портовый Бункер Карафуто',
  treasure: 'Лабаз Контрабандистов',
  exit: 'Курган Вечной Мерзлоты',
};

/**
 * Helper for shortest-arc angle interpolation
 */
function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * (1 - Math.exp(-lambda * dt));
}

/**
 * Manages the 3D environment geometry for both the Multi-Room Dungeon and the Far Eastern Hub
 */
export class EnvironmentBuilder {
  private envGroup: THREE.Group;
  public rooms: DungeonRoomNode[] = [];
  public walkableRects: WalkableRect[] = [];

  constructor(scene: THREE.Scene) {
    this.envGroup = new THREE.Group();
    scene.add(this.envGroup);
  }

  public clearEnvironment(): void {
    while (this.envGroup.children.length > 0) {
      const child = this.envGroup.children[0];
      this.envGroup.remove(child);
    }
    this.rooms = [];
    this.walkableRects = [];
  }

  public isPointWalkable(x: number, z: number): boolean {
    for (let i = 0; i < this.walkableRects.length; i++) {
      const r = this.walkableRects[i];
      if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) {
        return true;
      }
    }
    return false;
  }

  public getRoomAt(x: number, z: number): DungeonRoomNode | null {
    for (let i = 0; i < this.rooms.length; i++) {
      const rm = this.rooms[i];
      if (Math.abs(x - rm.cx) <= rm.halfW + 1.5 && Math.abs(z - rm.cz) <= rm.halfD + 1.5) {
        return rm;
      }
    }
    return null;
  }

  public buildHubGeometry(world: World, scene: THREE.Scene): void {
    this.clearEnvironment();

    this.walkableRects.push({ minX: -8.5, maxX: 8.5, minZ: -14.5, maxZ: 6.5 });

    const floorMat = makeLowPolyMat(0x111622, 0.75, 0.2);
    const woodMat = makeLowPolyMat(0x451a03, 0.85, 0.1);
    const logWallMat = makeLowPolyMat(0x2e190e, 0.88, 0.08);
    const stoneMat = makeLowPolyMat(0x1e293b, 0.6, 0.3);
    const pillarMat = makeLowPolyMat(0x991b1b, 0.5, 0.3);
    const boneMat = makeLowPolyMat(0xe2e8f0, 0.45, 0.15);
    const neonCyan = makeLowPolyMat(0x00ffcc, 0.2, 0.5, 0x00ffcc, 0.85);
    const neonAmber = makeLowPolyMat(0xf59e0b, 0.2, 0.5, 0xf59e0b, 0.85);

    // Courtyard ground
    const ground = new THREE.Mesh(new THREE.BoxGeometry(22, 0.4, 24), floorMat);
    ground.position.set(0, -0.2, -4);
    ground.receiveShadow = true;
    this.envGroup.add(ground);

    // Outer wooden Ostrog palisade walls enclosing the Hub courtyard
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(20, 4.2, 0.6), logWallMat);
    backWall.position.set(0, 2.1, -15.5);
    const frontWall = new THREE.Mesh(new THREE.BoxGeometry(20, 3.2, 0.6), logWallMat);
    frontWall.position.set(0, 1.6, 7.2);
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.6, 4.2, 23), logWallMat);
    leftWall.position.set(-9.8, 2.1, -4);
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.6, 4.2, 23), logWallMat);
    rightWall.position.set(9.8, 2.1, -4);
    this.envGroup.add(backWall, frontWall, leftWall, rightWall);

    // Central stone & timber walkway
    for (let i = 0; i < 7; i++) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.06, 2.3), stoneMat);
      slab.position.set(0, 0.03, 4 - i * 2.8);
      this.envGroup.add(slab);
    }

    // Far Eastern Ostrog Palisade + Shinto Columns + Whalebone Arches
    for (let z = 4; z >= -14; z -= 4.5) {
      for (const side of [-1, 1]) {
        const col = new THREE.Mesh(
          new THREE.CylinderGeometry(0.28, 0.34, 4.4, 6),
          Math.abs(z) % 2 === 0 ? pillarMat : woodMat
        );
        col.position.set(side * 8.2, 2.2, z);
        this.envGroup.add(col);

        const lantern = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.26, 0),
          Math.abs(z) % 2 === 0 ? neonCyan : neonAmber
        );
        lantern.position.set(side * 7.3, 3.2, z);
        this.envGroup.add(lantern);
      }
    }

    // Giant Chukchi Whalebone Arch over the Hub entrance
    const archRib = new THREE.Mesh(new THREE.TorusGeometry(5.5, 0.22, 5, 12, Math.PI), boneMat);
    archRib.position.set(0, 0, -9.2);
    this.envGroup.add(archRib);

    // Spawn Hub Interactables
    this.spawnInteractable(
      world,
      scene,
      'shrine_bonfire',
      'Очаг Шамана и Мико',
      'Отдых: 100% ОЗ и пополнение сбитня',
      -3.6,
      -2.2,
      0.4
    );
    this.spawnInteractable(
      world,
      scene,
      'forge_anvil',
      'Пареньская Кузница',
      'Ковка клинков и доспехов борзой',
      3.6,
      -2.2,
      -0.4
    );
    this.spawnInteractable(
      world,
      scene,
      'vending_machine',
      'Идол Менового Торга',
      'Обмен душ на редкие материалы',
      -4.2,
      -7.4,
      0.5
    );
    this.spawnInteractable(
      world,
      scene,
      'portal_enter_abyss',
      'Тории Охотского Разлома',
      'Спуститься в залы подземелья',
      0,
      -12.5,
      0
    );
  }

  /**
   * Procedurally generates a Multi-Room Dungeon Graph (5-6 enclosed thematic rooms with full walls & doorways)
   */
  public buildDungeonFloorGeometry(
    world: World,
    scene: THREE.Scene,
    floorNum: number,
    playerComp: PlayerComponent
  ): void {
    this.clearEnvironment();

    const isBossFloor = floorNum % 5 === 0;
    const roomCount = isBossFloor ? 5 : 6;
    const stepSize = 22; // Distance between room centers
    const roomHalf = 7.6; // Each room is 15.2m x 15.2m enclosed chamber

    const occupied = new Set<string>();
    let gx = 0;
    let gz = 0;
    occupied.add(`${gx},${gz}`);

    const midThemes: RoomTheme[] = ['whalebone', 'taiga', 'bunker', 'treasure'];

    for (let i = 0; i < roomCount; i++) {
      let theme: RoomTheme = 'whalebone';
      if (i === 0) theme = 'entrance';
      else if (i === roomCount - 1) theme = 'exit';
      else {
        theme = midThemes[(floorNum + i * 3 + Math.floor(Math.random() * 4)) % midThemes.length];
      }

      const cx = gx * stepSize;
      const cz = gz * stepSize;

      const node: DungeonRoomNode = {
        index: i,
        gridX: gx,
        gridZ: gz,
        cx,
        cz,
        halfW: roomHalf,
        halfD: roomHalf,
        theme,
        name: ROOM_THEME_NAMES[theme],
        visited: i === 0,
        cleared: i === 0,
      };
      this.rooms.push(node);

      // Walkable interior of the room (inset 0.85m from walls so player never clips walls)
      this.walkableRects.push({
        minX: cx - roomHalf + 0.85,
        maxX: cx + roomHalf - 0.85,
        minZ: cz - roomHalf + 0.85,
        maxZ: cz + roomHalf - 0.85,
      });

      if (i < roomCount - 1) {
        const candidates: [number, number][] = [
          [gx, gz - 1], // North (-Z)
          [gx - 1, gz], // West (-X)
          [gx + 1, gz], // East (+X)
          [gx, gz - 1],
        ];
        for (let c = candidates.length - 1; c > 0; c--) {
          const j = Math.floor(Math.random() * (c + 1));
          const tmp = candidates[c];
          candidates[c] = candidates[j];
          candidates[j] = tmp;
        }

        let nextG: [number, number] = [gx, gz - 1];
        for (const cand of candidates) {
          if (!occupied.has(`${cand[0]},${cand[1]}`)) {
            nextG = cand;
            break;
          }
        }
        occupied.add(`${nextG[0]},${nextG[1]}`);

        const nextCx = nextG[0] * stepSize;
        const nextCz = nextG[1] * stepSize;
        this.buildCorridorBetween(cx, cz, nextCx, nextCz, roomHalf);

        gx = nextG[0];
        gz = nextG[1];
      }
    }

    // Build full 3D Room Architecture, Walls, Doorways & Thematic Set-Pieces for each room
    for (let i = 0; i < this.rooms.length; i++) {
      this.buildSingleRoomGeometry(
        this.rooms[i],
        i > 0 ? this.rooms[i - 1] : null,
        i < this.rooms.length - 1 ? this.rooms[i + 1] : null
      );
    }

    // Spawn Entrance Hub Portal in Room 0
    const r0 = this.rooms[0];
    this.spawnInteractable(
      world,
      scene,
      'portal_hub',
      'Тропа в Острог-Святилище',
      'Вернуться в безопасный Хаб (Ковка и Отдых)',
      r0.cx - 4.2,
      r0.cz + 3.8,
      0.4
    );

    // Spawn Exit Torii Portal in the Final Room
    const rLast = this.rooms[this.rooms.length - 1];
    this.spawnInteractable(
      world,
      scene,
      'portal_next_floor',
      `Врата Этажа ${floorNum + 1}`,
      'Шагните в Тории для спуска глубже',
      rLast.cx,
      rLast.cz - 4.0,
      0
    );

    populateDungeonRooms(world, scene, floorNum, this.rooms, playerComp);
  }

  private buildCorridorBetween(
    cx1: number,
    cz1: number,
    cx2: number,
    cz2: number,
    roomHalf: number
  ): void {
    const corrHalfWidth = 2.3;
    const minX = Math.min(cx1, cx2) - corrHalfWidth + 0.3;
    const maxX = Math.max(cx1, cx2) + corrHalfWidth - 0.3;
    const minZ = Math.min(cz1, cz2) - corrHalfWidth + 0.3;
    const maxZ = Math.max(cz1, cz2) + corrHalfWidth - 0.3;

    this.walkableRects.push({ minX, maxX, minZ, maxZ });

    const midX = (cx1 + cx2) / 2;
    const midZ = (cz1 + cz2) / 2;
    const isZAligned = Math.abs(cx1 - cx2) < 0.1;
    const bridgeLen = Math.hypot(cx2 - cx1, cz2 - cz1) - roomHalf * 2 + 0.8;

    const floorMat = makeLowPolyMat(0x161d2a, 0.7, 0.25);
    const wallMat = makeLowPolyMat(0x1e2636, 0.75, 0.25);
    const timberMat = makeLowPolyMat(0x3e1f0d, 0.85, 0.1);

    const floorGeo = isZAligned
      ? new THREE.BoxGeometry(corrHalfWidth * 2, 0.3, bridgeLen)
      : new THREE.BoxGeometry(bridgeLen, 0.3, corrHalfWidth * 2);
    const bridgeMesh = new THREE.Mesh(floorGeo, floorMat);
    bridgeMesh.position.set(midX, -0.15, midZ);
    this.envGroup.add(bridgeMesh);

    // Enclosed corridor side walls (4.5m tall) + overhead timber arch beam
    const wallH = 4.5;
    for (const side of [-1, 1]) {
      const wallGeo = isZAligned
        ? new THREE.BoxGeometry(0.35, wallH, bridgeLen)
        : new THREE.BoxGeometry(bridgeLen, wallH, 0.35);
      const wall = new THREE.Mesh(wallGeo, wallMat);
      wall.position.set(
        isZAligned ? midX + side * (corrHalfWidth + 0.15) : midX,
        wallH / 2,
        isZAligned ? midZ : midZ + side * (corrHalfWidth + 0.15)
      );
      this.envGroup.add(wall);
    }

    // Overhead lintel beam in the middle of the corridor
    const topBeamGeo = isZAligned
      ? new THREE.BoxGeometry(corrHalfWidth * 2 + 0.6, 0.45, 0.6)
      : new THREE.BoxGeometry(0.6, 0.45, corrHalfWidth * 2 + 0.6);
    const topBeam = new THREE.Mesh(topBeamGeo, timberMat);
    topBeam.position.set(midX, wallH, midZ);
    this.envGroup.add(topBeam);
  }

  private buildSingleRoomGeometry(
    room: DungeonRoomNode,
    prevRoom: DungeonRoomNode | null,
    nextRoom: DungeonRoomNode | null
  ): void {
    const group = new THREE.Group();
    group.position.set(room.cx, 0, room.cz);

    const size = room.halfW * 2;
    const wallH = 4.6;
    const doorW = 4.6;

    // Theme palettes
    const themeConfig: Record<
      RoomTheme,
      { floorHex: number; wallHex: number; trimHex: number; glowHex: number }
    > = {
      entrance: { floorHex: 0x161922, wallHex: 0x2b1b12, trimHex: 0x991b1b, glowHex: 0x00ffcc },
      whalebone: { floorHex: 0x0d1826, wallHex: 0x16283d, trimHex: 0xe2e8f0, glowHex: 0x38bdf8 },
      taiga: { floorHex: 0x191510, wallHex: 0x331c0e, trimHex: 0x78350f, glowHex: 0xf59e0b },
      bunker: { floorHex: 0x10181b, wallHex: 0x1e292b, trimHex: 0x7c2d12, glowHex: 0x10b981 },
      treasure: { floorHex: 0x1e1712, wallHex: 0x2d1f16, trimHex: 0xd97706, glowHex: 0xfbbf24 },
      exit: { floorHex: 0x1c0d16, wallHex: 0x26101c, trimHex: 0x991b1b, glowHex: 0xff0055 },
    };

    const cfg = themeConfig[room.theme];
    const floorMat = makeLowPolyMat(cfg.floorHex, 0.75, 0.2);
    const wallMat = makeLowPolyMat(cfg.wallHex, 0.8, 0.18);
    const trimMat = makeLowPolyMat(cfg.trimHex, 0.55, 0.35);
    const boneMat = makeLowPolyMat(0xe2e8f0, 0.42, 0.15);
    const woodMat = makeLowPolyMat(0x451a03, 0.85, 0.1);
    const ironMat = makeLowPolyMat(0x334155, 0.4, 0.8);
    const glowMat = makeLowPolyMat(cfg.glowHex, 0.2, 0.5, cfg.glowHex, 0.9);

    // 1. Room Floor Slab
    const floor = new THREE.Mesh(new THREE.BoxGeometry(size, 0.35, size), floorMat);
    floor.position.y = -0.175;
    group.add(floor);

    // 2. Full 4.6m Perimeter Walls (Solid Wall if closed, or Framed Doorway Arch if connected to neighbor!)
    const dirs: { dx: number; dz: number; rotY: number }[] = [
      { dx: 0, dz: -1, rotY: 0 }, // North wall (-Z)
      { dx: 0, dz: 1, rotY: 0 },  // South wall (+Z)
      { dx: -1, dz: 0, rotY: Math.PI / 2 }, // West wall (-X)
      { dx: 1, dz: 0, rotY: Math.PI / 2 },  // East wall (+X)
    ];

    for (const d of dirs) {
      const hasDoorway =
        (prevRoom &&
          prevRoom.gridX - room.gridX === d.dx &&
          prevRoom.gridZ - room.gridZ === d.dz) ||
        (nextRoom &&
          nextRoom.gridX - room.gridX === d.dx &&
          nextRoom.gridZ - room.gridZ === d.dz);

      const wallGroup = new THREE.Group();
      wallGroup.position.set(d.dx * room.halfW, 0, d.dz * room.halfD);
      wallGroup.rotation.y = d.rotY;

      if (!hasDoorway) {
        // Full-height Solid Architectural Wall
        const mainWall = new THREE.Mesh(new THREE.BoxGeometry(size, wallH, 0.45), wallMat);
        mainWall.position.y = wallH / 2;
        const baseTrim = new THREE.Mesh(new THREE.BoxGeometry(size, 0.4, 0.58), trimMat);
        baseTrim.position.y = 0.2;
        const topCornice = new THREE.Mesh(new THREE.BoxGeometry(size + 0.2, 0.35, 0.65), trimMat);
        topCornice.position.y = wallH;
        wallGroup.add(mainWall, baseTrim, topCornice);

        // Thematic Wall Relief Props on solid walls
        this.decorateSolidWall(wallGroup, room.theme, size, wallH, trimMat, glowMat, boneMat, woodMat, ironMat);
      } else {
        // Framed Doorway Wall: Left Wing + Right Wing + Overhead Lintel + Door Pillars
        const wingW = (size - doorW) / 2;
        for (const side of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.BoxGeometry(wingW, wallH, 0.45), wallMat);
          wing.position.set(side * (doorW / 2 + wingW / 2), wallH / 2, 0);
          const doorJamb = new THREE.Mesh(new THREE.BoxGeometry(0.45, wallH, 0.65), trimMat);
          doorJamb.position.set(side * (doorW / 2), wallH / 2, 0);
          wallGroup.add(wing, doorJamb);
        }
        // Overhead Lintel above the doorway
        const lintel = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.6, 1.1, 0.62), trimMat);
        lintel.position.set(0, wallH - 0.55, 0);
        const doorGlow = new THREE.Mesh(new THREE.BoxGeometry(doorW - 0.6, 0.14, 0.7), glowMat);
        doorGlow.position.set(0, wallH - 1.12, 0);
        wallGroup.add(lintel, doorGlow);
      }

      group.add(wallGroup);
    }

    // 3. Thematic Room Interior Architecture & Set-Pieces
    this.buildRoomThematicInterior(group, room, trimMat, glowMat, boneMat, woodMat, ironMat);

    this.envGroup.add(group);
  }

  private decorateSolidWall(
    wallGroup: THREE.Group,
    theme: RoomTheme,
    size: number,
    wallH: number,
    trimMat: THREE.Material,
    glowMat: THREE.Material,
    boneMat: THREE.Material,
    woodMat: THREE.Material,
    ironMat: THREE.Material
  ): void {
    if (theme === 'whalebone') {
      // Ice crystals & mounted whalebone ribs along the wall
      for (const side of [-1, 1]) {
        const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.6, 5), glowMat);
        crystal.position.set(side * 3.8, 1.3, 0.35);
        crystal.rotation.z = -side * 0.15;
        wallGroup.add(crystal);
      }
    } else if (theme === 'taiga' || theme === 'entrance') {
      // Shimenawa rope with hanging paper Ofuda talismans & timber beams
      const beam = new THREE.Mesh(new THREE.BoxGeometry(size - 2, 0.22, 0.6), woodMat);
      beam.position.set(0, 3.2, 0.1);
      wallGroup.add(beam);
      for (let i = -2; i <= 2; i++) {
        const ofuda = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.55, 0.05), glowMat);
        ofuda.position.set(i * 2.1, 2.8, 0.35);
        wallGroup.add(ofuda);
      }
    } else if (theme === 'bunker') {
      // Sealed round Soviet-Shinto blast door & industrial pipes on the wall
      const hatchRing = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.18, 6, 12), ironMat);
      hatchRing.position.set(0, 2.2, 0.25);
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.08, 4, 8), trimMat);
      wheel.position.set(0, 2.2, 0.38);
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, size - 1.5, 6), trimMat);
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(0, 3.8, 0.35);
      wallGroup.add(hatchRing, wheel, pipe);
    } else if (theme === 'treasure') {
      // Stacked contraband crates & iron-bound barrels along the wall
      for (const side of [-1, 1]) {
        const crate = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.2), woodMat);
        crate.position.set(side * 3.5, 0.7, 0.65);
        const chest = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.75, 0.8), trimMat);
        chest.position.set(side * 1.6, 0.38, 0.55);
        wallGroup.add(crate, chest);
      }
    } else if (theme === 'exit') {
      // Towering crimson Shinto wall shrines & bone skulls
      for (const side of [-1, 1]) {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, wallH, 6), trimMat);
        pillar.position.set(side * 3.2, wallH / 2, 0.3);
        const skull = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), boneMat);
        skull.position.set(side * 3.2, 2.6, 0.5);
        wallGroup.add(pillar, skull);
      }
    }
  }

  private buildRoomThematicInterior(
    group: THREE.Group,
    room: DungeonRoomNode,
    trimMat: THREE.Material,
    glowMat: THREE.Material,
    boneMat: THREE.Material,
    woodMat: THREE.Material,
    ironMat: THREE.Material
  ): void {
    const cOff = room.halfW - 1.4;

    if (room.theme === 'whalebone') {
      // Giant overhead Chukchi Whalebone Rib Vault spanning the room ceiling!
      for (const zPos of [-3.2, 3.2]) {
        const ribArch = new THREE.Mesh(
          new THREE.TorusGeometry(room.halfW - 0.5, 0.24, 5, 12, Math.PI),
          boneMat
        );
        ribArch.position.set(0, 0, zPos);
        group.add(ribArch);
      }
      // Corner bone totem poles
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const totem = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 4.2, 5), boneMat);
          totem.position.set(sx * cOff, 2.1, sz * cOff);
          const eye = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.5), glowMat);
          eye.position.set(sx * cOff, 3.1, sz * cOff);
          group.add(totem, eye);
        }
      }
    } else if (room.theme === 'taiga') {
      // 4 Carved Slavic Pagan Wooden Idols (Churs) with burning amber braziers in corners
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const chur = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.44, 4.2, 6), woodMat);
          chur.position.set(sx * cOff, 2.1, sz * cOff);
          const crown = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.7, 6), trimMat);
          crown.position.set(sx * cOff, 4.4, sz * cOff);
          const rune = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.55), glowMat);
          rune.position.set(sx * cOff, 2.9, sz * cOff);
          group.add(chur, crown, rune);
        }
      }
    } else if (room.theme === 'bunker') {
      // Flooded Bunker Columns with steel overhead trusses & emerald floodlights
      for (const zPos of [-3.4, 3.4]) {
        const truss = new THREE.Mesh(new THREE.BoxGeometry(room.halfW * 2 - 0.6, 0.38, 0.45), ironMat);
        truss.position.set(0, 4.4, zPos);
        group.add(truss);
      }
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const col = new THREE.Mesh(new THREE.BoxGeometry(0.75, 4.6, 0.75), ironMat);
          col.position.set(sx * cOff, 2.3, sz * cOff);
          const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.8, 0.22), glowMat);
          lamp.position.set(sx * (cOff - 0.35), 2.5, sz * (cOff - 0.35));
          group.add(col, lamp);
        }
      }
    } else {
      // Entrance, Treasure, Exit: Timber & Shinto Corner Pillars with overhead Torii rafters
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const col = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 4.6, 6), trimMat);
          col.position.set(sx * cOff, 2.3, sz * cOff);
          const lantern = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), glowMat);
          lantern.position.set(sx * (cOff - 0.5), 3.4, sz * (cOff - 0.5));
          group.add(col, lantern);
        }
      }
    }
  }

  private spawnInteractable(
    world: World,
    scene: THREE.Scene,
    kind: InteractableKind,
    title: string,
    subtitle: string,
    x: number,
    z: number,
    rotY = 0
  ): EntityId {
    const id = world.createEntity();
    const mesh = createInteractableMesh(kind);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = rotY;
    scene.add(mesh);

    world
      .addComponent(id, new TransformComponent(x, 0, z, rotY))
      .addComponent(id, new MeshComponent(mesh))
      .addComponent(id, new InteractableComponent(kind, title, subtitle, 2.5));

    return id;
  }
}

/**
 * Populates the generated Dungeon Rooms with wandering Yokai/Chukchi/Slavic monsters and 3D Loot
 */
export function populateDungeonRooms(
  world: World,
  scene: THREE.Scene,
  floor: number,
  rooms: DungeonRoomNode[],
  playerComp: PlayerComponent
): void {
  const isBossFloor = floor % 5 === 0;
  const nonBossCatalog = YOKAI_CATALOG.filter((y) => !y.isBoss);
  const bossDef = YOKAI_CATALOG.find((y) => y.isBoss)!;

  const matKeys: MaterialId[] = ['steel', 'silk', 'seal', 'ash', 'jade'];
  let totalEnemies = 0;

  for (let i = 1; i < rooms.length; i++) {
    const rm = rooms[i];
    const isFinalRoom = i === rooms.length - 1;

    if (rm.theme !== 'treasure' || isFinalRoom) {
      const isThisBoss = isBossFloor && isFinalRoom;
      const def = isThisBoss
        ? bossDef
        : nonBossCatalog[(floor + i * 2) % nonBossCatalog.length];

      const eId = world.createEntity();
      const yokaiModel = createYokaiMesh(def, floor);
      yokaiModel.mesh.position.set(rm.cx, 0, rm.cz);
      scene.add(yokaiModel.mesh);

      const hp = Math.round((28 + floor * 18) * def.hpMult);
      const dmg = Math.round((6 + floor * 3.5) * def.dmgMult);

      world
        .addComponent(eId, new TransformComponent(rm.cx, 0, rm.cz, 0))
        .addComponent(eId, new MeshComponent(yokaiModel.mesh, undefined, yokaiModel.parts))
        .addComponent(eId, new StatsComponent(hp, hp, dmg, floor))
        .addComponent(
          eId,
          new EnemyComponent(
            def.archetype,
            def.name,
            def.title,
            def.windupTime,
            def.attackInterval,
            Boolean(def.isBoss),
            rm.cx,
            rm.cz
          )
        );
      totalEnemies++;
    } else {
      rm.cleared = true;
    }

    const lootInRoom = rm.theme === 'treasure' ? 3 : 1 + (i % 2);
    for (let l = 0; l < lootInRoom; l++) {
      const angle = (l / lootInRoom) * Math.PI * 2 + i;
      const lx = rm.cx + Math.cos(angle) * 3.6;
      const lz = rm.cz + Math.sin(angle) * 3.6;
      const matKey = matKeys[(floor + i + l) % matKeys.length];
      spawnLootEntity(world, scene, lx, lz, matKey, 1 + Math.floor(floor / 4), 0, false);
    }

    if (rm.theme === 'treasure') {
      spawnLootEntity(world, scene, rm.cx, rm.cz, undefined, 1, 0, true);
    }
  }

  playerComp.enemiesSlainOnFloor = 0;
  playerComp.totalEnemiesOnFloor = totalEnemies;
}

export function spawnLootEntity(
  world: World,
  scene: THREE.Scene,
  x: number,
  z: number,
  materialId?: MaterialId,
  amount = 1,
  soulsAmount = 0,
  isHealOrb = false
): EntityId {
  const id = world.createEntity();
  let colorHex = 0x00ffcc;
  let cssColor = '#00ffcc';
  let label = 'Добыча';

  if (isHealOrb) {
    colorHex = 0x10b981;
    cssColor = '#10b981';
    label = 'Родник Духов (+35% ОЗ)';
  } else if (materialId) {
    const def = MATERIALS_CATALOG[materialId];
    colorHex = def.colorHex;
    cssColor = def.cssColor;
    label = `${def.shortName} x${amount}`;
  } else if (soulsAmount > 0) {
    colorHex = 0x38bdf8;
    cssColor = '#38bdf8';
    label = `Души +${soulsAmount}`;
  }

  const mesh = createLootDropMesh(materialId, colorHex, isHealOrb);
  mesh.position.set(x, 0, z);
  scene.add(mesh);

  world
    .addComponent(id, new TransformComponent(x, 0, z))
    .addComponent(id, new MeshComponent(mesh))
    .addComponent(
      id,
      new LootDropComponent({
        materialId,
        amount,
        soulsAmount,
        isHealOrb,
        label,
        colorHex,
        cssColor,
      })
    );

  return id;
}

export function refreshBorzoiEquipmentMesh(world: World, playerEntity: EntityId): void {
  const pComp = world.getComponent<PlayerComponent>(playerEntity, 'PlayerComponent');
  const mComp = world.getComponent<MeshComponent>(playerEntity, 'MeshComponent');
  if (!pComp || !mComp || !mComp.borzoiParts) return;

  const weaponDef =
    WEAPONS_CATALOG.find((w) => w.id === pComp.equippedWeaponId) ?? WEAPONS_CATALOG[0];
  const armorDef =
    ARMORS_CATALOG.find((a) => a.id === pComp.equippedArmorId) ?? ARMORS_CATALOG[0];
  const skinDef =
    COAT_SKINS.find((s) => s.id === pComp.equippedSkinId) ?? COAT_SKINS[0];

  const jawMount = mComp.borzoiParts.jawWeaponMount;
  while (jawMount.children.length > 0) {
    jawMount.remove(jawMount.children[0]);
  }
  const newWeapon = buildWeaponMesh(weaponDef);
  jawMount.add(newWeapon.group);

  const armorMount = mComp.borzoiParts.armorMount;
  while (armorMount.children.length > 0) {
    armorMount.remove(armorMount.children[0]);
  }
  const newArmor = buildArmorMesh(armorDef);
  armorMount.add(newArmor.group);

  mComp.borzoiParts.floatingOrnaments = [
    ...newArmor.floatingOrnaments,
    ...newWeapon.floatingOrbs,
  ];

  mComp.borzoiParts.bodyGroup.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh && obj.parent === mComp.borzoiParts?.bodyGroup) {
      const mat = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (mat && mat.color) {
        mat.color.setHex(skinDef.coatColor);
      }
    }
  });
}

export function getEffectivePlayerStats(
  stats: StatsComponent,
  player: PlayerComponent
): {
  totalDmg: number;
  totalMaxHp: number;
  critChance: number;
  critMult: number;
  chargeSpeed: number;
  parryWindow: number;
  defensePct: number;
  bleedDmg: number;
  moveSpeed: number;
  weapon: (typeof WEAPONS_CATALOG)[0];
  armor: (typeof ARMORS_CATALOG)[0];
} {
  const weapon =
    WEAPONS_CATALOG.find((w) => w.id === player.equippedWeaponId) ?? WEAPONS_CATALOG[0];
  const armor =
    ARMORS_CATALOG.find((a) => a.id === player.equippedArmorId) ?? ARMORS_CATALOG[0];

  const totalDmg = Math.round(
    weapon.baseDmg + (stats.level - 1) * 3 + (stats.jawsStrength - 1) * 5
  );
  const totalMaxHp = Math.round(
    100 + armor.maxHpBonus + (stats.level - 1) * 18 + (stats.vitality - 1) * 25
  );
  const critChance = Math.min(0.75, weapon.critChance + (stats.agility - 1) * 0.03);
  const critMult = weapon.critMult + (stats.jawsStrength - 1) * 0.08;
  const chargeSpeed = weapon.chargeSpeed + (stats.agility - 1) * 0.08;
  const parryWindow = 0.4 + weapon.parryWindowBonus + (stats.spirit - 1) * 0.03;
  const defensePct = Math.min(0.65, armor.defensePct + (stats.vitality - 1) * 0.02);
  const bleedDmg = weapon.bleedDmg + Math.floor((stats.spirit - 1) * 2);
  const moveSpeed = 6.5 + armor.moveSpeedBonus + (stats.agility - 1) * 0.25;

  return {
    totalDmg,
    totalMaxHp,
    critChance,
    critMult,
    chargeSpeed,
    parryWindow,
    defensePct,
    bleedDmg,
    moveSpeed,
    weapon,
    armor,
  };
}

/**
 * SYSTEM 1: Multi-Room Exploration, Camera-Relative Steering, Loot Magnet & Wandering Patrols
 */
export class ExplorationSystem extends System {
  public activeInteractable: InteractableComponent | null = null;
  public activeInteractableEntity: EntityId | null = null;
  public currentRoom: DungeonRoomNode | null = null;

  constructor(
    private scene: THREE.Scene,
    private envBuilder: EnvironmentBuilder,
    private onBanner: EventBannerCallback,
    private onSyncUI: StateSyncCallback,
    private onTriggerInteractable: (kind: InteractableKind) => void
  ) {
    super();
  }

  public update(dt: number, time: number): void {
    const players = this.world.query(
      'PlayerComponent',
      'TransformComponent',
      'VelocityComponent',
      'CombatComponent',
      'StatsComponent'
    );
    if (players.length === 0) return;

    const pId = players[0];
    const pComp = this.world.getComponent<PlayerComponent>(pId, 'PlayerComponent')!;
    const tComp = this.world.getComponent<TransformComponent>(pId, 'TransformComponent')!;
    const vComp = this.world.getComponent<VelocityComponent>(pId, 'VelocityComponent')!;
    const cComp = this.world.getComponent<CombatComponent>(pId, 'CombatComponent')!;
    const sComp = this.world.getComponent<StatsComponent>(pId, 'StatsComponent')!;

    const eff = getEffectivePlayerStats(sComp, pComp);
    sComp.maxHp = eff.totalMaxHp;
    if (sComp.hp > sComp.maxHp) sComp.hp = sComp.maxHp;

    if (cComp.state !== 'blocking') {
      sComp.stamina = Math.min(sComp.maxStamina, sComp.stamina + dt * 24);
    }

    // Track current dungeon room & mark visited
    if (!pComp.inHub) {
      const rm = this.envBuilder.getRoomAt(tComp.pos.x, tComp.pos.z);
      if (rm && rm !== this.currentRoom) {
        this.currentRoom = rm;
        if (!rm.visited) {
          rm.visited = true;
          this.onBanner(
            `${rm.name.toUpperCase()}`,
            '#38bdf8',
            `Зал ${rm.index + 1} из ${this.envBuilder.rooms.length}`
          );
        }
        this.onSyncUI();
      }
    } else {
      this.currentRoom = null;
    }

    // 1. Free Movement across Rooms & Corridors (Relative to Borzoi's Facing Direction!)
    if (!cComp.inCombat) {
      const inputX = vComp.moveInputX; // -1 (Left) .. +1 (Right)
      const inputZ = vComp.moveInputZ; // -1 (Forward/Up) .. +1 (Backward/Down)

      if (Math.abs(inputX) > 0.05 || Math.abs(inputZ) > 0.05) {
        // Manual Control:
        // Left/Right input smoothly turns the Borzoi's heading (tComp.rotY)
        const turnSpeed = 2.65;
        tComp.rotY -= inputX * turnSpeed * dt;

        // Forward/Backward speed (pushing Up/W or tilting joystick sideways moves the Borzoi forward along its nose)
        const forwardAmount =
          inputZ < -0.05
            ? -inputZ
            : inputZ > 0.05
            ? -inputZ * 0.65
            : Math.abs(inputX) * 0.65;

        const speed = eff.moveSpeed * (vComp.sprint ? 1.35 : 1.0) * forwardAmount;
        const fwdX = -Math.sin(tComp.rotY);
        const fwdZ = -Math.cos(tComp.rotY);

        const nextX = tComp.pos.x + fwdX * speed * dt;
        const nextZ = tComp.pos.z + fwdZ * speed * dt;

        if (this.envBuilder.isPointWalkable(nextX, tComp.pos.z)) {
          tComp.pos.x = nextX;
        }
        if (this.envBuilder.isPointWalkable(tComp.pos.x, nextZ)) {
          tComp.pos.z = nextZ;
        }

        vComp.isMoving = Math.abs(forwardAmount) > 0.05 || Math.abs(inputX) > 0.1;
      } else if (vComp.autoRun && !pComp.inHub) {
        // Smart Auto-Navigator through the Multi-Room Graph
        const targetPos = this.findNextAutoTarget();
        if (targetPos) {
          const dx = targetPos.x - tComp.pos.x;
          const dz = targetPos.z - tComp.pos.z;
          const d = Math.hypot(dx, dz);
          if (d > 0.25) {
            const desiredRotY = Math.atan2(-dx, -dz);
            tComp.rotY = dampAngle(tComp.rotY, desiredRotY, 8, dt);

            const speed = eff.moveSpeed;
            const nextX = tComp.pos.x + (dx / d) * speed * dt;
            const nextZ = tComp.pos.z + (dz / d) * speed * dt;

            if (this.envBuilder.isPointWalkable(nextX, tComp.pos.z)) {
              tComp.pos.x = nextX;
            }
            if (this.envBuilder.isPointWalkable(tComp.pos.x, nextZ)) {
              tComp.pos.z = nextZ;
            }
            vComp.isMoving = true;
          } else {
            vComp.isMoving = false;
          }
        } else {
          vComp.isMoving = false;
        }
      } else {
        vComp.isMoving = false;
      }
    } else {
      vComp.isMoving = false;
    }

    // 2. Update & Collect 3D Loot Drops
    const lootIds = this.world.query('LootDropComponent', 'TransformComponent', 'MeshComponent');
    for (const lId of lootIds) {
      const lComp = this.world.getComponent<LootDropComponent>(lId, 'LootDropComponent')!;
      const lt = this.world.getComponent<TransformComponent>(lId, 'TransformComponent')!;
      const lm = this.world.getComponent<MeshComponent>(lId, 'MeshComponent')!;

      const core = lm.mesh.getObjectByName('lootCore');
      if (core) {
        core.position.y = 0.52 + Math.sin(time * 3.5 + lComp.bobPhase) * 0.12;
        core.rotation.y = time * 2.2 + lComp.bobPhase;
      }

      const dist = tComp.pos.distanceTo(lt.pos);
      if (dist < lComp.pickupRadius || lComp.magnetized) {
        lComp.magnetized = true;
        lt.pos.lerp(tComp.pos, Math.min(1, dt * 14));
        lm.mesh.position.copy(lt.pos);

        if (dist < 0.6) {
          sfx.playPickup();
          if (lComp.isHealOrb) {
            const heal = Math.round(sComp.maxHp * 0.35);
            sComp.hp = Math.min(sComp.maxHp, sComp.hp + heal);
            this.onBanner(`+${heal} ОЗ (РОДНИК ДУХОВ)`, '#10b981');
          } else {
            if (lComp.materialId) {
              pComp.materials[lComp.materialId] =
                (pComp.materials[lComp.materialId] ?? 0) + lComp.amount;
            }
            if (lComp.soulsAmount > 0) {
              pComp.souls += lComp.soulsAmount;
            }
            this.onBanner(`+${lComp.label.toUpperCase()}`, lComp.cssColor);
          }
          this.world.removeEntity(lId);
          this.onSyncUI();
        }
      }
    }

    // 3. Check proximity to Interactables
    const interactables = this.world.query('InteractableComponent', 'TransformComponent');
    let foundInteractable: InteractableComponent | null = null;
    let foundEntity: EntityId | null = null;
    let bestDist = Infinity;

    for (const iId of interactables) {
      const iComp = this.world.getComponent<InteractableComponent>(iId, 'InteractableComponent')!;
      const it = this.world.getComponent<TransformComponent>(iId, 'TransformComponent')!;
      const d = tComp.pos.distanceTo(it.pos);
      if (d < iComp.radius && d < bestDist) {
        bestDist = d;
        foundInteractable = iComp;
        foundEntity = iId;

        if (iComp.kind === 'portal_next_floor' && d < 1.5 && !cComp.inCombat) {
          this.onTriggerInteractable(iComp.kind);
          return;
        }
      }
    }

    if (this.activeInteractable !== foundInteractable) {
      this.activeInteractable = foundInteractable;
      this.activeInteractableEntity = foundEntity;
      this.onSyncUI();
    }

    // 4. Wandering 2D Patrol for Yokai/Chukchi/Slavic Monsters in Rooms & Combat Engagement
    if (!cComp.inCombat && !pComp.inHub) {
      const enemies = this.world.query(
        'EnemyComponent',
        'TransformComponent',
        'StatsComponent',
        'MeshComponent'
      );
      for (const eId of enemies) {
        const et = this.world.getComponent<TransformComponent>(eId, 'TransformComponent')!;
        const eComp = this.world.getComponent<EnemyComponent>(eId, 'EnemyComponent')!;
        const em = this.world.getComponent<MeshComponent>(eId, 'MeshComponent')!;

        const radius = eComp.isBoss ? 1.8 : 3.4;
        const speed = 0.8 + (eId % 3) * 0.18;
        const prevX = et.pos.x;
        const prevZ = et.pos.z;
        et.pos.x = eComp.patrolOriginX + Math.cos(time * speed + eId) * radius;
        et.pos.z = eComp.patrolOriginZ + Math.sin(time * speed * 1.3 + eId) * radius;

        const vx = et.pos.x - prevX;
        const vz = et.pos.z - prevZ;
        if (Math.hypot(vx, vz) > 0.001) {
          em.mesh.rotation.y = Math.atan2(vx, vz);
        }

        const dist = tComp.pos.distanceTo(et.pos);
        if (dist < 3.6) {
          // ENGAGE COMBAT!
          cComp.inCombat = true;
          cComp.targetEntity = eId;
          cComp.state = 'idle';
          cComp.charge = 0;
          cComp.comboCount = 0;

          // Orient Borzoi and Monster facing each other along their current approach vector
          const duelAngle = Math.atan2(-(et.pos.x - tComp.pos.x), -(et.pos.z - tComp.pos.z));
          tComp.rotY = duelAngle;

          const fwdX = -Math.sin(duelAngle);
          const fwdZ = -Math.cos(duelAngle);
          et.pos.set(eComp.patrolOriginX + fwdX * 1.4, 0, eComp.patrolOriginZ + fwdZ * 1.4);
          em.mesh.rotation.y = duelAngle;

          tComp.pos.set(eComp.patrolOriginX - fwdX * 1.8, 0, eComp.patrolOriginZ - fwdZ * 1.8);

          eComp.state = 'idle';
          eComp.timer = 1.1;

          this.onBanner(`${eComp.name}`, '#ff0055', eComp.title);
          this.onSyncUI();
          break;
        }
      }
    }
  }

  private findNextAutoTarget(): { x: number; z: number } | null {
    const rm = this.currentRoom;
    if (rm) {
      const loots = this.world.query('LootDropComponent', 'TransformComponent');
      for (const lId of loots) {
        const lt = this.world.getComponent<TransformComponent>(lId, 'TransformComponent')!;
        if (Math.abs(lt.pos.x - rm.cx) <= rm.halfW && Math.abs(lt.pos.z - rm.cz) <= rm.halfD) {
          return { x: lt.pos.x, z: lt.pos.z };
        }
      }
      const enemies = this.world.query('EnemyComponent', 'TransformComponent');
      for (const eId of enemies) {
        const et = this.world.getComponent<TransformComponent>(eId, 'TransformComponent')!;
        if (Math.abs(et.pos.x - rm.cx) <= rm.halfW && Math.abs(et.pos.z - rm.cz) <= rm.halfD) {
          return { x: et.pos.x, z: et.pos.z };
        }
      }
      const nextRoom = this.envBuilder.rooms[rm.index + 1];
      if (nextRoom) {
        return { x: nextRoom.cx, z: nextRoom.cz };
      }
    }

    const lastRoom = this.envBuilder.rooms[this.envBuilder.rooms.length - 1];
    if (lastRoom) {
      return { x: lastRoom.cx, z: lastRoom.cz - 4.0 };
    }
    return null;
  }
}

/**
 * SYSTEM 2: TES: Blades Directional Swipe Combat, Timed Parry, Bleed & Special Skills
 */
export class CombatSystem extends System {
  constructor(
    private scene: THREE.Scene,
    private envBuilder: EnvironmentBuilder,
    private onBanner: EventBannerCallback,
    private onSyncUI: StateSyncCallback
  ) {
    super();
  }

  public update(dt: number, time: number): void {
    const players = this.world.query(
      'PlayerComponent',
      'CombatComponent',
      'StatsComponent',
      'TransformComponent'
    );
    if (players.length === 0) return;

    const pId = players[0];
    const pComp = this.world.getComponent<PlayerComponent>(pId, 'PlayerComponent')!;
    const cComp = this.world.getComponent<CombatComponent>(pId, 'CombatComponent')!;
    const pStats = this.world.getComponent<StatsComponent>(pId, 'StatsComponent')!;
    const pTrans = this.world.getComponent<TransformComponent>(pId, 'TransformComponent')!;

    if (cComp.skillDashCd > 0) cComp.skillDashCd = Math.max(0, cComp.skillDashCd - dt);
    if (cComp.skillHowlCd > 0) cComp.skillHowlCd = Math.max(0, cComp.skillHowlCd - dt);
    if (cComp.skillWhirlCd > 0) cComp.skillWhirlCd = Math.max(0, cComp.skillWhirlCd - dt);
    if (cComp.hitFlashTimer > 0) cComp.hitFlashTimer = Math.max(0, cComp.hitFlashTimer - dt);

    if (!cComp.inCombat || cComp.targetEntity === null) return;

    const eId = cComp.targetEntity;
    const eStats = this.world.getComponent<StatsComponent>(eId, 'StatsComponent');
    const eComp = this.world.getComponent<EnemyComponent>(eId, 'EnemyComponent');
    const eMesh = this.world.getComponent<MeshComponent>(eId, 'MeshComponent');
    const eTrans = this.world.getComponent<TransformComponent>(eId, 'TransformComponent');

    if (!eStats || !eComp || !eMesh || !eTrans) {
      this.endCombat(cComp);
      return;
    }

    const eff = getEffectivePlayerStats(pStats, pComp);

    if (cComp.attackCooldown > 0) cComp.attackCooldown = Math.max(0, cComp.attackCooldown - dt);
    if (cComp.comboResetTimer > 0) {
      cComp.comboResetTimer -= dt;
      if (cComp.comboResetTimer <= 0) cComp.comboCount = 0;
    }

    if (cComp.state === 'charging') {
      cComp.charge = Math.min(1.0, cComp.charge + dt * 1.35 * eff.chargeSpeed);
    } else if (cComp.state === 'blocking') {
      cComp.timer += dt;
    }

    if (eComp.bleedTimer > 0) {
      eComp.bleedTimer -= dt;
      eStats.hp -= eComp.bleedTickDmg * dt;
    }
    if (eComp.hitFlashTimer > 0) {
      eComp.hitFlashTimer = Math.max(0, eComp.hitFlashTimer - dt);
    }

    const eyeMat = eMesh.yokaiParts?.eye.material as THREE.MeshStandardMaterial | undefined;

    if (eComp.state === 'stunned') {
      eComp.stunTime -= dt;
      if (eyeMat) eyeMat.color.setHex(0x475569);
      if (eComp.stunTime <= 0) {
        eComp.state = 'idle';
        eComp.timer = eComp.attackInterval * 0.8;
      }
    } else if (eComp.state === 'idle') {
      eComp.timer -= dt;
      if (eyeMat) eyeMat.color.setHex(0xff0055);
      if (eComp.timer <= 0) {
        eComp.state = 'windup';
        eComp.isHeavyAttack = Math.random() < (eComp.isBoss ? 0.45 : 0.25);
        eComp.timer = eComp.isHeavyAttack ? eComp.windupTime * 1.25 : eComp.windupTime;
        this.onBanner(
          eComp.isHeavyAttack ? 'СОКРУШИТЕЛЬНЫЙ ЗАМАХ!' : 'ВРАГ АТАКУЕТ!',
          '#f59e0b',
          'Жмите ЩИТ для идеального парирования!'
        );
      }
    } else if (eComp.state === 'windup') {
      eComp.timer -= dt;
      if (eyeMat) {
        const flash = Math.floor(time * 22) % 2 === 0 ? 0xffffff : 0xff0000;
        eyeMat.color.setHex(flash);
      }
      if (eMesh.yokaiParts) {
        eMesh.yokaiParts.armR.rotation.x = THREE.MathUtils.lerp(
          eMesh.yokaiParts.armR.rotation.x,
          Math.PI * 0.85,
          dt * 10
        );
        if (eComp.isHeavyAttack) {
          eMesh.yokaiParts.armL.rotation.x = THREE.MathUtils.lerp(
            eMesh.yokaiParts.armL.rotation.x,
            Math.PI * 0.85,
            dt * 10
          );
        }
      }

      if (eComp.timer <= 0) {
        if (eMesh.yokaiParts) {
          eMesh.yokaiParts.armR.rotation.x = -0.65;
          eMesh.yokaiParts.armL.rotation.x = -0.45;
        }
        this.resolveEnemyStrike(cComp, pStats, eff, eStats, eComp);
        if ((eComp.state as string) !== 'stunned') {
          eComp.state = 'idle';
          eComp.timer = eComp.attackInterval * (0.85 + Math.random() * 0.3);
        }
      }
    }

    if (eStats.hp <= 0) {
      this.handleEnemyDefeated(pComp, pStats, pTrans, cComp, eId, eComp, eTrans);
      return;
    }

    if (pStats.hp <= 0) {
      sfx.playHitHurt();
      this.onBanner('БОРЗАЯ ОТСТУПАЕТ В ОСТРОГ-СВЯТИЛИЩЕ', '#ef4444');
      pStats.hp = pStats.maxHp;
      pComp.potions = pComp.maxPotions;
      this.endCombat(cComp);
      window.dispatchEvent(new CustomEvent('borzoi-player-died'));
      this.onSyncUI();
    }
  }

  private resolveEnemyStrike(
    cComp: CombatComponent,
    pStats: StatsComponent,
    eff: ReturnType<typeof getEffectivePlayerStats>,
    eStats: StatsComponent,
    eComp: EnemyComponent
  ): void {
    const rawDmg = eComp.isHeavyAttack ? Math.round(eStats.baseDmg * 1.45) : eStats.baseDmg;

    if (cComp.state === 'blocking') {
      if (cComp.timer <= eff.parryWindow) {
        sfx.playParry(true);
        eComp.state = 'stunned';
        eComp.stunTime = 2.8;
        pStats.stamina = Math.min(pStats.maxStamina, pStats.stamina + 35);
        const counterDmg = Math.round(eff.totalDmg * 0.65);
        eStats.hp -= counterDmg;
        eComp.hitFlashTimer = 0.25;
        this.onBanner(
          `ПАРИРОВАНИЕ! -${counterDmg}`,
          '#00ffcc',
          'Хтонь оглушена — рубите критами!'
        );
        this.onSyncUI();
        return;
      } else {
        sfx.playParry(false);
        const mitigated = Math.max(1, Math.round(rawDmg * (1 - eff.defensePct) * 0.25));
        pStats.hp -= mitigated;
        pStats.stamina = Math.max(0, pStats.stamina - 18);
        this.onBanner(`БЛОК (-${mitigated} ОЗ)`, '#94a3b8');
        this.onSyncUI();
        return;
      }
    }

    sfx.playHitHurt();
    const taken = Math.max(2, Math.round(rawDmg * (1 - eff.defensePct)));
    pStats.hp -= taken;
    cComp.hitFlashTimer = 0.25;
    if (cComp.state === 'charging') {
      cComp.state = 'idle';
      cComp.charge = 0;
    }
    this.onBanner(`-${taken} ОЗ`, '#ff0055');
    this.onSyncUI();
  }

  private handleEnemyDefeated(
    pComp: PlayerComponent,
    pStats: StatsComponent,
    _pTrans: TransformComponent,
    cComp: CombatComponent,
    eId: EntityId,
    eComp: EnemyComponent,
    eTrans: TransformComponent
  ): void {
    sfx.playCraftOrLevelUp();
    const soulReward = Math.round((12 + pComp.floor * 5) * (eComp.isBoss ? 2.5 : 1));
    pComp.souls += soulReward;
    pComp.enemiesSlainOnFloor++;
    pComp.totalKills++;

    pStats.hp = Math.min(pStats.maxHp, Math.round(pStats.hp + pStats.maxHp * 0.15));

    const rm = this.envBuilder.getRoomAt(eTrans.pos.x, eTrans.pos.z);
    if (rm) rm.cleared = true;

    const matKeys: MaterialId[] = ['steel', 'silk', 'seal', 'ash', 'jade'];
    const dropCount = eComp.isBoss ? 4 : 2;
    for (let i = 0; i < dropCount; i++) {
      const matId =
        eComp.isBoss && i === 0
          ? 'jade'
          : matKeys[(pComp.floor + i + pComp.totalKills) % matKeys.length];
      const offsetX = (i - (dropCount - 1) / 2) * 1.1;
      const offsetZ = -0.3 - (i % 2) * 0.6;
      spawnLootEntity(
        this.world,
        this.scene,
        eTrans.pos.x + offsetX,
        eTrans.pos.z + offsetZ,
        matId,
        eComp.isBoss ? 2 : 1,
        0,
        false
      );
    }

    if (Math.random() < 0.45 || eComp.isBoss) {
      spawnLootEntity(
        this.world,
        this.scene,
        eTrans.pos.x,
        eTrans.pos.z - 1.2,
        undefined,
        1,
        0,
        true
      );
    }

    this.onBanner(
      eComp.isBoss ? `БОСС ПОВЕРЖЕН! +${soulReward} ДУШ` : `ХТОНЬ ИЗГНАНА! +${soulReward} ДУШ`,
      '#00ffcc'
    );

    this.world.removeEntity(eId);
    this.endCombat(cComp);
    this.onSyncUI();
  }

  public executePlayerSwipeAttack(
    playerEntity: EntityId,
    dirX: number,
    dirY: number
  ): void {
    const cComp = this.world.getComponent<CombatComponent>(playerEntity, 'CombatComponent');
    const pStats = this.world.getComponent<StatsComponent>(playerEntity, 'StatsComponent');
    const pComp = this.world.getComponent<PlayerComponent>(playerEntity, 'PlayerComponent');
    const pTrans = this.world.getComponent<TransformComponent>(playerEntity, 'TransformComponent');
    if (!cComp || !pStats || !pComp || !pTrans || !cComp.inCombat || cComp.targetEntity === null)
      return;

    const eId = cComp.targetEntity;
    const eStats = this.world.getComponent<StatsComponent>(eId, 'StatsComponent');
    const eComp = this.world.getComponent<EnemyComponent>(eId, 'EnemyComponent');
    const eMesh = this.world.getComponent<MeshComponent>(eId, 'MeshComponent');
    if (!eStats || !eComp || !eMesh) return;

    const eff = getEffectivePlayerStats(pStats, pComp);

    cComp.state = 'attacking';
    cComp.attackCooldown = 0.26 / eff.chargeSpeed;
    cComp.chargeDirX = dirX;
    cComp.chargeDirY = dirY;
    cComp.comboCount = Math.min(6, cComp.comboCount + 1);
    cComp.comboResetTimer = 2.4;

    const isSweetSpot = cComp.charge >= 0.75 && cComp.charge <= 0.96;
    const isCrit =
      isSweetSpot ||
      eComp.state === 'stunned' ||
      Math.random() < eff.critChance;

    const chargeMult = 0.65 + cComp.charge * 0.85;
    const comboMult = 1 + (cComp.comboCount - 1) * 0.12;
    const dmg = Math.round(eff.totalDmg * chargeMult * comboMult * (isCrit ? eff.critMult : 1.0));

    sfx.playSlash(cComp.charge, isCrit);
    eStats.hp -= dmg;
    eComp.hitFlashTimer = 0.18;

    if (eff.bleedDmg > 0) {
      eComp.bleedTimer = 4.0;
      eComp.bleedTickDmg = eff.bleedDmg;
    }

    const fwdX = -Math.sin(pTrans.rotY);
    const fwdZ = -Math.cos(pTrans.rotY);
    eMesh.mesh.position.x += fwdX * 0.28;
    eMesh.mesh.position.z += fwdZ * 0.28;
    setTimeout(() => {
      if (eMesh.mesh) {
        eMesh.mesh.position.x -= fwdX * 0.28;
        eMesh.mesh.position.z -= fwdZ * 0.28;
      }
    }, 95);

    if (isCrit) {
      this.onBanner(`КРИТ! -${dmg} [x${cComp.comboCount}]`, '#00ffcc');
    } else {
      this.onBanner(`-${dmg} [x${cComp.comboCount}]`, '#f8fafc');
    }

    cComp.charge = 0;
    this.onSyncUI();

    setTimeout(() => {
      if (cComp.state === 'attacking') cComp.state = 'idle';
    }, 210);
  }

  public executeSpecialSkill(
    playerEntity: EntityId,
    skillId: 'dash' | 'howl' | 'whirl'
  ): void {
    const cComp = this.world.getComponent<CombatComponent>(playerEntity, 'CombatComponent');
    const pStats = this.world.getComponent<StatsComponent>(playerEntity, 'StatsComponent');
    const pComp = this.world.getComponent<PlayerComponent>(playerEntity, 'PlayerComponent');
    if (!cComp || !pStats || !pComp || !cComp.inCombat || cComp.targetEntity === null) return;

    const eId = cComp.targetEntity;
    const eStats = this.world.getComponent<StatsComponent>(eId, 'StatsComponent');
    const eComp = this.world.getComponent<EnemyComponent>(eId, 'EnemyComponent');
    if (!eStats || !eComp) return;

    const eff = getEffectivePlayerStats(pStats, pComp);

    if (skillId === 'dash' && cComp.skillDashCd <= 0) {
      cComp.skillDashCd = 6.0;
      cComp.state = 'attacking';
      cComp.chargeDirX = 1;
      const dmg = Math.round(eff.totalDmg * 2.1);
      eStats.hp -= dmg;
      eComp.hitFlashTimer = 0.3;
      if (eComp.state === 'windup') {
        eComp.state = 'stunned';
        eComp.stunTime = 2.0;
      }
      sfx.playSlash(1.0, true);
      this.onBanner(`ИАЙДО-РЫВОК! -${dmg}`, '#38bdf8', 'Замах врага сбит!');
    } else if (skillId === 'howl' && cComp.skillHowlCd <= 0) {
      cComp.skillHowlCd = 10.0;
      eComp.state = 'stunned';
      eComp.stunTime = 3.2;
      const heal = Math.round(pStats.maxHp * 0.22);
      pStats.hp = Math.min(pStats.maxHp, pStats.hp + heal);
      sfx.playSkillHowl();
      this.onBanner(`ВОЙ ВЬЮГИ! ОГЛУШЕНИЕ +${heal} ОЗ`, '#a855f7');
    } else if (skillId === 'whirl' && cComp.skillWhirlCd <= 0) {
      cComp.skillWhirlCd = 8.5;
      cComp.state = 'attacking';
      const dmg = Math.round(eff.totalDmg * 2.65);
      eStats.hp -= dmg;
      eComp.bleedTimer = 6.0;
      eComp.bleedTickDmg = eff.bleedDmg + 12;
      eComp.hitFlashTimer = 0.35;
      sfx.playSlash(1.0, true);
      this.onBanner(`БАГРОВЫЙ ВИХРЬ! -${dmg}`, '#f43f5e');
    }

    setTimeout(() => {
      if (cComp.state === 'attacking') cComp.state = 'idle';
    }, 260);
    this.onSyncUI();
  }

  public endCombat(cComp: CombatComponent): void {
    cComp.inCombat = false;
    cComp.targetEntity = null;
    cComp.state = 'idle';
    cComp.charge = 0;
    cComp.comboCount = 0;
  }
}

/**
 * SYSTEM 3: Procedural Low-Poly Limb Animation & Directional Behind-the-Back Chase Camera
 */
export class AnimationAndCameraSystem extends System {
  public inspectOrbitAngle: number = 0.5;
  public inspectOrbitPitch: number = 0.35;
  public inspectZoom: number = 3.5;
  public inspectModeActive: boolean = false;
  public camYaw: number = 0;

  constructor(
    private camera: THREE.PerspectiveCamera,
    private playerLight: THREE.PointLight
  ) {
    super();
  }

  public update(dt: number, time: number): void {
    const players = this.world.query(
      'PlayerComponent',
      'TransformComponent',
      'VelocityComponent',
      'MeshComponent',
      'CombatComponent'
    );
    if (players.length === 0) return;

    const pId = players[0];
    const pComp = this.world.getComponent<PlayerComponent>(pId, 'PlayerComponent')!;
    const tComp = this.world.getComponent<TransformComponent>(pId, 'TransformComponent')!;
    const vComp = this.world.getComponent<VelocityComponent>(pId, 'VelocityComponent')!;
    const mComp = this.world.getComponent<MeshComponent>(pId, 'MeshComponent')!;
    const cComp = this.world.getComponent<CombatComponent>(pId, 'CombatComponent')!;

    mComp.mesh.position.copy(tComp.pos);
    mComp.mesh.rotation.y = tComp.rotY;

    this.playerLight.position.set(tComp.pos.x, 3.0, tComp.pos.z);

    const parts = mComp.borzoiParts;
    if (parts) {
      for (let i = 0; i < parts.floatingOrnaments.length; i++) {
        const orn = parts.floatingOrnaments[i];
        orn.rotation.y = time * 2.0 + i;
        orn.position.y += Math.sin(time * 4 + i) * 0.002;
      }

      if (vComp.isMoving && !cComp.inCombat) {
        const freq = vComp.sprint ? 20 : 15;
        const amp = vComp.sprint ? 0.78 : 0.58;
        parts.legs[0].rotation.x = Math.sin(time * freq) * amp;
        parts.legs[1].rotation.x = Math.cos(time * freq) * amp;
        parts.legs[2].rotation.x = Math.cos(time * freq) * amp;
        parts.legs[3].rotation.x = Math.sin(time * freq) * amp;

        parts.bodyGroup.position.y = Math.abs(Math.sin(time * freq)) * 0.11;
        parts.bodyGroup.rotation.x = Math.sin(time * freq) * 0.05;
        parts.headGroup.rotation.set(0, 0, 0);
        parts.neckGroup.rotation.y = THREE.MathUtils.damp(parts.neckGroup.rotation.y, 0, 8, dt);
      } else if (cComp.inCombat) {
        parts.legs.forEach((l, idx) => {
          l.rotation.x = idx < 2 ? -0.12 : 0.15;
        });
        parts.bodyGroup.position.y = 0;
        parts.bodyGroup.rotation.x = 0.04;

        if (cComp.state === 'charging') {
          const targetYaw = 0.95 * cComp.chargeDirX;
          const targetPitch = cComp.chargeDirY * 0.45;
          parts.headGroup.rotation.y = THREE.MathUtils.damp(
            parts.headGroup.rotation.y,
            targetYaw,
            12,
            dt
          );
          parts.headGroup.rotation.x = THREE.MathUtils.damp(
            parts.headGroup.rotation.x,
            targetPitch,
            12,
            dt
          );
          parts.headGroup.rotation.z = THREE.MathUtils.damp(
            parts.headGroup.rotation.z,
            -0.2 * cComp.chargeDirX,
            12,
            dt
          );
          parts.neckGroup.position.z = -0.52;
        } else if (cComp.state === 'attacking') {
          const slashYaw = -1.25 * (cComp.chargeDirX || 1);
          parts.headGroup.rotation.y = THREE.MathUtils.damp(
            parts.headGroup.rotation.y,
            slashYaw,
            28,
            dt
          );
          parts.headGroup.rotation.z = 0.25 * (cComp.chargeDirX || 1);
          parts.neckGroup.position.z = -0.78;
        } else if (cComp.state === 'blocking') {
          parts.headGroup.rotation.z = THREE.MathUtils.damp(parts.headGroup.rotation.z, 0.72, 16, dt);
          parts.headGroup.rotation.y = THREE.MathUtils.damp(parts.headGroup.rotation.y, 0.15, 16, dt);
          parts.neckGroup.position.z = -0.62;
        } else {
          parts.headGroup.rotation.y = THREE.MathUtils.damp(parts.headGroup.rotation.y, 0, 8, dt);
          parts.headGroup.rotation.x = THREE.MathUtils.damp(parts.headGroup.rotation.x, 0, 8, dt);
          parts.headGroup.rotation.z = THREE.MathUtils.damp(parts.headGroup.rotation.z, 0, 8, dt);
          parts.neckGroup.position.z = -0.58;
          parts.headGroup.position.y = 0.36 + Math.sin(time * 5) * 0.025;
        }
      } else {
        parts.legs.forEach((l) => {
          l.rotation.x = THREE.MathUtils.damp(l.rotation.x, 0, 10, dt);
        });
        parts.bodyGroup.position.y = Math.sin(time * 3.2) * 0.02;
        parts.bodyGroup.rotation.x = 0;
        parts.headGroup.rotation.y = Math.sin(time * 1.3) * 0.12;
        parts.headGroup.rotation.z = 0;
      }

      parts.tail.rotation.y = Math.sin(time * 6.5) * 0.24;
    }

    // Smoothly align camera yaw with the Borzoi's facing direction (tComp.rotY)
    this.camYaw = dampAngle(this.camYaw, tComp.rotY, 7.5, dt);

    // Camera Choreography
    if (this.inspectModeActive) {
      const camX =
        tComp.pos.x +
        Math.sin(this.inspectOrbitAngle) * Math.cos(this.inspectOrbitPitch) * this.inspectZoom;
      const camY = tComp.pos.y + 1.05 + Math.sin(this.inspectOrbitPitch) * this.inspectZoom;
      const camZ =
        tComp.pos.z +
        Math.cos(this.inspectOrbitAngle) * Math.cos(this.inspectOrbitPitch) * this.inspectZoom;

      _camTargetPos.set(camX, Math.max(0.35, camY), camZ);
      _camLookAt.set(tComp.pos.x, tComp.pos.y + 1.05, tComp.pos.z);

      this.camera.position.lerp(_camTargetPos, Math.min(1, dt * 10));
      this.camera.lookAt(_camLookAt);
    } else if (cComp.inCombat && cComp.targetEntity !== null) {
      // Over-the-shoulder duel camera aligned with the Borzoi's combat facing angle
      const backX = Math.sin(this.camYaw);
      const backZ = Math.cos(this.camYaw);
      const rightX = Math.cos(this.camYaw);
      const rightZ = -Math.sin(this.camYaw);

      _camTargetPos.set(
        tComp.pos.x + backX * 2.75 + rightX * 0.55,
        2.15,
        tComp.pos.z + backZ * 2.75 + rightZ * 0.55
      );
      _camLookAt.set(
        tComp.pos.x - backX * 3.2,
        1.4,
        tComp.pos.z - backZ * 3.2
      );
      this.camera.position.lerp(_camTargetPos, Math.min(1, dt * 8));
      this.camera.lookAt(_camLookAt);
    } else {
      // True Behind-the-Back Third-Person Chase Camera following the Borzoi's heading!
      const dist = pComp.inHub ? 4.3 : 3.9;
      const height = pComp.inHub ? 2.45 : 2.35;
      const backX = Math.sin(this.camYaw);
      const backZ = Math.cos(this.camYaw);

      _camTargetPos.set(
        tComp.pos.x + backX * dist,
        height,
        tComp.pos.z + backZ * dist
      );
      _camLookAt.set(
        tComp.pos.x - backX * 3.2,
        1.2,
        tComp.pos.z - backZ * 3.2
      );
      this.camera.position.lerp(_camTargetPos, Math.min(1, dt * 8));
      this.camera.lookAt(_camLookAt);
    }

    // Animate Yokai/Far-East Monsters
    const enemies = this.world.query('EnemyComponent', 'MeshComponent', 'TransformComponent');
    for (const eId of enemies) {
      const eComp = this.world.getComponent<EnemyComponent>(eId, 'EnemyComponent')!;
      const em = this.world.getComponent<MeshComponent>(eId, 'MeshComponent')!;
      const et = this.world.getComponent<TransformComponent>(eId, 'TransformComponent')!;

      if (eComp.state !== 'windup') {
        em.mesh.position.x = et.pos.x;
        em.mesh.position.z = et.pos.z;
      }

      const yp = em.yokaiParts;
      if (!yp) continue;

      if (eComp.state === 'stunned') {
        yp.head.rotation.z = 0.85;
        yp.torso.rotation.x = 0.32;
      } else {
        if (Math.random() > 0.86) {
          yp.head.rotation.z = (Math.random() - 0.5) * 1.3;
          yp.head.position.x = (Math.random() - 0.5) * 0.2;
        } else {
          yp.head.rotation.z *= 0.88;
          yp.head.position.x *= 0.88;
        }
        yp.torso.rotation.x = 0;

        // Archetype-specific idle animations
        if (eComp.archetype === 'poludnitsa') {
          yp.torso.position.y = 1.45 + Math.sin(time * 3.2 + eId) * 0.16;
          yp.head.position.y = 2.75 + Math.sin(time * 3.2 + eId) * 0.16;
        } else if (eComp.archetype === 'kele') {
          for (let l = 0; l < yp.extraParts.length; l++) {
            yp.extraParts[l].rotation.x = Math.sin(time * 10 + l) * 0.35;
          }
        } else if (eComp.archetype === 'likho') {
          yp.head.position.y = 3.25 + Math.sin(time * 3.5 + eId) * 0.15;
          for (let s = 0; s < yp.extraParts.length; s++) {
            yp.extraParts[s].position.x = Math.sin(time * 4 + s * 0.8) * 0.3;
          }
        } else if (eComp.archetype === 'akamanto') {
          for (let s = 0; s < yp.extraParts.length; s++) {
            yp.extraParts[s].position.y += Math.sin(time * 5 + s) * 0.003;
          }
        }
      }
    }

    // Animate Interactables
    const interactables = this.world.query('InteractableComponent', 'MeshComponent');
    for (const iId of interactables) {
      const im = this.world.getComponent<MeshComponent>(iId, 'MeshComponent')!;
      const flame = im.mesh.getObjectByName('bonfireFlame');
      if (flame) {
        flame.scale.y = 1 + Math.sin(time * 12) * 0.18;
        flame.rotation.y = time * 2.5;
      }
      const vortex = im.mesh.getObjectByName('vortexPlane') as THREE.Mesh | undefined;
      if (vortex && vortex.material) {
        (vortex.material as THREE.MeshBasicMaterial).opacity = 0.28 + Math.sin(time * 4) * 0.12;
      }
    }
  }
}
