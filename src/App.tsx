import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  Swords,
  Shield,
  Hammer,
  Eye,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronUp,
  Compass,
  Heart,
  Zap,
  Award,
  Footprints,
  Package,
  Wind,
  Flame,
  X,
} from 'lucide-react';
import { EntityId, World } from './ecs/Engine';
import {
  ARMORS_CATALOG,
  COAT_SKINS,
  MATERIALS_CATALOG,
  MaterialId,
  WEAPONS_CATALOG,
} from './ecs/catalog';
import {
  CombatComponent,
  EnemyComponent,
  InteractableKind,
  LootDropComponent,
  MeshComponent,
  PlayerComponent,
  StatsComponent,
  TransformComponent,
  VelocityComponent,
} from './ecs/components';
import { createBorzoiMesh } from './ecs/models';
import {
  AnimationAndCameraSystem,
  CombatSystem,
  DungeonRoomNode,
  EnvironmentBuilder,
  ExplorationSystem,
  getEffectivePlayerStats,
  refreshBorzoiEquipmentMesh,
} from './ecs/systems';
import { sfx } from './ecs/audio';

type ActiveModalTab = 'none' | 'weapons' | 'armors' | 'stats' | 'inventory';

interface HUDState {
  floor: number;
  maxFloor: number;
  inHub: boolean;
  level: number;
  souls: number;
  lvlCost: number;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  potions: number;
  maxPotions: number;
  totalDmg: number;
  critChancePct: number;
  defensePct: number;
  bleedDmg: number;
  jawsStrength: number;
  vitality: number;
  agility: number;
  spirit: number;
  materials: Record<MaterialId, number>;
  unlockedWeapons: string[];
  unlockedArmors: string[];
  equippedWeaponId: string;
  equippedArmorId: string;
  equippedSkinId: string;
  enemiesSlain: number;
  totalEnemies: number;
  inCombat: boolean;
  combatCharge: number;
  comboCount: number;
  skillDashCd: number;
  skillHowlCd: number;
  skillWhirlCd: number;
  autoRun: boolean;
  inspectMode: boolean;
  rooms: DungeonRoomNode[];
  currentRoomIndex: number;
  currentRoomName: string;
  enemy: {
    name: string;
    title: string;
    hp: number;
    maxHp: number;
    isBoss: boolean;
    state: string;
    bleeding: boolean;
  } | null;
  interactable: {
    kind: InteractableKind;
    title: string;
    subtitle: string;
  } | null;
}

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);

  const worldRef = useRef<World | null>(null);
  const playerEntityRef = useRef<EntityId | null>(null);
  const combatSysRef = useRef<CombatSystem | null>(null);
  const exploreSysRef = useRef<ExplorationSystem | null>(null);
  const animSysRef = useRef<AnimationAndCameraSystem | null>(null);
  const envBuilderRef = useRef<EnvironmentBuilder | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  const [activeTab, setActiveTab] = useState<ActiveModalTab>('none');
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(false);
  const [banner, setBanner] = useState<{ text: string; subtext?: string; color: string } | null>({
    text: 'ОХОТСКИЙ РАЗЛОМ: ЭТАЖ 1',
    subtext: 'Исследуйте залы, собирайте дары севера и рубите хтонь свайпами',
    color: '#00ffcc',
  });

  const [swipeVector, setSwipeVector] = useState<{
    active: boolean;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }>({ active: false, x1: 0, y1: 0, x2: 0, y2: 0 });

  const [joyPos, setJoyPos] = useState<{ active: boolean; dx: number; dy: number }>({
    active: false,
    dx: 0,
    dy: 0,
  });

  const [hud, setHud] = useState<HUDState>({
    floor: 1,
    maxFloor: 1,
    inHub: false,
    level: 1,
    souls: 20,
    lvlCost: 12,
    hp: 120,
    maxHp: 120,
    stamina: 100,
    maxStamina: 100,
    potions: 2,
    maxPotions: 3,
    totalDmg: 15,
    critChancePct: 16,
    defensePct: 6,
    bleedDmg: 0,
    jawsStrength: 1,
    vitality: 1,
    agility: 1,
    spirit: 1,
    materials: { steel: 3, silk: 2, seal: 1, ash: 1, jade: 0 },
    unlockedWeapons: ['shibuya_katana'],
    unlockedArmors: ['street_collar'],
    equippedWeaponId: 'shibuya_katana',
    equippedArmorId: 'street_collar',
    equippedSkinId: 'white_aristocrat',
    enemiesSlain: 0,
    totalEnemies: 4,
    inCombat: false,
    combatCharge: 0,
    comboCount: 0,
    skillDashCd: 0,
    skillHowlCd: 0,
    skillWhirlCd: 0,
    autoRun: false,
    inspectMode: false,
    rooms: [],
    currentRoomIndex: 0,
    currentRoomName: 'Пограничная Застава',
    enemy: null,
    interactable: null,
  });

  const bannerTimeoutRef = useRef<number | null>(null);
  const triggerBanner = useCallback((text: string, color: string, subtext?: string) => {
    setBanner({ text, color, subtext });
    if (bannerTimeoutRef.current) window.clearTimeout(bannerTimeoutRef.current);
    bannerTimeoutRef.current = window.setTimeout(() => {
      setBanner(null);
    }, 2100);
  }, []);

  const syncHUDFromECS = useCallback(() => {
    const world = worldRef.current;
    const pId = playerEntityRef.current;
    if (!world || pId === null) return;

    const pComp = world.getComponent<PlayerComponent>(pId, 'PlayerComponent');
    const sComp = world.getComponent<StatsComponent>(pId, 'StatsComponent');
    const cComp = world.getComponent<CombatComponent>(pId, 'CombatComponent');
    const vComp = world.getComponent<VelocityComponent>(pId, 'VelocityComponent');
    if (!pComp || !sComp || !cComp || !vComp) return;

    const eff = getEffectivePlayerStats(sComp, pComp);

    let enemyData: HUDState['enemy'] = null;
    if (cComp.inCombat && cComp.targetEntity !== null) {
      const eStats = world.getComponent<StatsComponent>(cComp.targetEntity, 'StatsComponent');
      const eComp = world.getComponent<EnemyComponent>(cComp.targetEntity, 'EnemyComponent');
      if (eStats && eComp) {
        enemyData = {
          name: eComp.name,
          title: eComp.title,
          hp: Math.max(0, Math.ceil(eStats.hp)),
          maxHp: eStats.maxHp,
          isBoss: eComp.isBoss,
          state: eComp.state,
          bleeding: eComp.bleedTimer > 0,
        };
      }
    }

    const activeInter = exploreSysRef.current?.activeInteractable ?? null;
    const curRoom = exploreSysRef.current?.currentRoom ?? null;
    const roomsList = envBuilderRef.current?.rooms ?? [];

    setHud({
      floor: pComp.floor,
      maxFloor: pComp.maxFloorReached,
      inHub: pComp.inHub,
      level: sComp.level,
      souls: pComp.souls,
      lvlCost: pComp.lvlCost,
      hp: Math.max(0, Math.round(sComp.hp)),
      maxHp: eff.totalMaxHp,
      stamina: Math.round(sComp.stamina),
      maxStamina: sComp.maxStamina,
      potions: pComp.potions,
      maxPotions: pComp.maxPotions,
      totalDmg: eff.totalDmg,
      critChancePct: Math.round(eff.critChance * 100),
      defensePct: Math.round(eff.defensePct * 100),
      bleedDmg: eff.bleedDmg,
      jawsStrength: sComp.jawsStrength,
      vitality: sComp.vitality,
      agility: sComp.agility,
      spirit: sComp.spirit,
      materials: { ...pComp.materials },
      unlockedWeapons: Array.from(pComp.unlockedWeapons),
      unlockedArmors: Array.from(pComp.unlockedArmors),
      equippedWeaponId: pComp.equippedWeaponId,
      equippedArmorId: pComp.equippedArmorId,
      equippedSkinId: pComp.equippedSkinId,
      enemiesSlain: pComp.enemiesSlainOnFloor,
      totalEnemies: pComp.totalEnemiesOnFloor,
      inCombat: cComp.inCombat,
      combatCharge: cComp.charge,
      comboCount: cComp.comboCount,
      skillDashCd: cComp.skillDashCd,
      skillHowlCd: cComp.skillHowlCd,
      skillWhirlCd: cComp.skillWhirlCd,
      autoRun: vComp.autoRun,
      inspectMode: Boolean(animSysRef.current?.inspectModeActive),
      rooms: [...roomsList],
      currentRoomIndex: curRoom ? curRoom.index : 0,
      currentRoomName: pComp.inHub
        ? 'Острог-Святилище'
        : curRoom
        ? curRoom.name
        : 'Переход',
      enemy: enemyData,
      interactable: activeInter
        ? {
            kind: activeInter.kind,
            title: activeInter.title,
            subtitle: activeInter.subtitle,
          }
        : null,
    });
  }, []);

  const enterHubSanctuary = useCallback(() => {
    const world = worldRef.current;
    const pId = playerEntityRef.current;
    const scene = sceneRef.current;
    const envBuilder = envBuilderRef.current;
    if (!world || pId === null || !scene || !envBuilder) return;

    const pComp = world.getComponent<PlayerComponent>(pId, 'PlayerComponent')!;
    const sComp = world.getComponent<StatsComponent>(pId, 'StatsComponent')!;
    const tComp = world.getComponent<TransformComponent>(pId, 'TransformComponent')!;
    const cComp = world.getComponent<CombatComponent>(pId, 'CombatComponent')!;
    const vComp = world.getComponent<VelocityComponent>(pId, 'VelocityComponent')!;

    combatSysRef.current?.endCombat(cComp);
    world.clearEntitiesExcept(new Set([pId]));

    pComp.inHub = true;
    vComp.autoRun = false;
    sComp.hp = sComp.maxHp;
    pComp.potions = pComp.maxPotions;
    tComp.pos.set(0, 0, 1.5);
    tComp.rotY = 0;

    envBuilder.buildHubGeometry(world, scene);
    sfx.playCraftOrLevelUp();
    triggerBanner(
      'ОСТРОГ-СВЯТИЛИЩЕ (БЕЗОПАСНЫЙ ХАБ)',
      '#00ffcc',
      'Здоровье и сбитень восстановлены!'
    );
    syncHUDFromECS();
  }, [syncHUDFromECS, triggerBanner]);

  const enterDungeonFloor = useCallback(
    (targetFloor: number) => {
      const world = worldRef.current;
      const pId = playerEntityRef.current;
      const scene = sceneRef.current;
      const envBuilder = envBuilderRef.current;
      if (!world || pId === null || !scene || !envBuilder) return;

      const pComp = world.getComponent<PlayerComponent>(pId, 'PlayerComponent')!;
      const tComp = world.getComponent<TransformComponent>(pId, 'TransformComponent')!;
      const cComp = world.getComponent<CombatComponent>(pId, 'CombatComponent')!;

      combatSysRef.current?.endCombat(cComp);
      world.clearEntitiesExcept(new Set([pId]));

      pComp.inHub = false;
      pComp.floor = targetFloor;
      if (targetFloor > pComp.maxFloorReached) {
        pComp.maxFloorReached = targetFloor;
      }

      if (animSysRef.current) {
        animSysRef.current.inspectModeActive = false;
      }
      setActiveTab('none');

      tComp.pos.set(0, 0, 0);
      tComp.rotY = 0;

      envBuilder.buildDungeonFloorGeometry(world, scene, targetFloor, pComp);

      const isBoss = targetFloor % 5 === 0;
      triggerBanner(
        isBoss ? `ЭТАЖ ${targetFloor} — КУРГАН КОЩЕЯ-ГАСЯДОКУРО!` : `ОХОТСКИЙ РАЗЛОМ: ЭТАЖ ${targetFloor}`,
        isBoss ? '#ff0055' : '#00ffcc',
        `Сгенерировано залов: ${envBuilder.rooms.length}`
      );
      syncHUDFromECS();
    },
    [syncHUDFromECS, triggerBanner]
  );

  const handleInteractableAction = useCallback(
    (kind: InteractableKind) => {
      const world = worldRef.current;
      const pId = playerEntityRef.current;
      if (!world || pId === null) return;
      const pComp = world.getComponent<PlayerComponent>(pId, 'PlayerComponent')!;
      const sComp = world.getComponent<StatsComponent>(pId, 'StatsComponent')!;

      if (kind === 'portal_next_floor') {
        enterDungeonFloor(pComp.floor + 1);
      } else if (kind === 'portal_hub') {
        enterHubSanctuary();
      } else if (kind === 'portal_enter_abyss') {
        enterDungeonFloor(pComp.maxFloorReached);
      } else if (kind === 'shrine_bonfire') {
        sComp.hp = sComp.maxHp;
        pComp.potions = pComp.maxPotions;
        sfx.playCraftOrLevelUp();
        triggerBanner('ОЧАГ ШАМАНА И МИКО', '#00ffcc', 'Здоровье и фляги полностью восстановлены!');
        setActiveTab('stats');
        syncHUDFromECS();
      } else if (kind === 'forge_anvil') {
        setActiveTab('weapons');
        if (animSysRef.current) animSysRef.current.inspectModeActive = true;
        syncHUDFromECS();
      } else if (kind === 'vending_machine') {
        setActiveTab('inventory');
        syncHUDFromECS();
      }
    },
    [enterDungeonFloor, enterHubSanctuary, syncHUDFromECS, triggerBanner]
  );

  useEffect(() => {
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mountEl.clientWidth, mountEl.clientHeight);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    mountEl.innerHTML = '';
    mountEl.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06080e);
    scene.fog = new THREE.FogExp2(0x06080e, 0.036);
    sceneRef.current = scene;

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      58,
      mountEl.clientWidth / mountEl.clientHeight,
      0.1,
      110
    );
    camera.position.set(0, 3.2, 5.0);
    cameraRef.current = camera;

    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x0f172a, 0.7);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfffbeb, 1.15);
    keyLight.position.set(5, 11, 7);
    scene.add(keyLight);

    const playerLight = new THREE.PointLight(0x00ffcc, 2.2, 18);
    playerLight.position.set(0, 2.8, 0);
    scene.add(playerLight);

    const world = new World();
    worldRef.current = world;

    const pId = world.createEntity();
    playerEntityRef.current = pId;

    const pComp = new PlayerComponent();
    const sComp = new StatsComponent(120, 120, 15, 1);
    const tComp = new TransformComponent(0, 0, 0, 0);
    const vComp = new VelocityComponent();
    const cComp = new CombatComponent();

    const borzoiModel = createBorzoiMesh(
      COAT_SKINS[0],
      WEAPONS_CATALOG[0],
      ARMORS_CATALOG[0]
    );
    scene.add(borzoiModel.mesh);

    world
      .addComponent(pId, tComp)
      .addComponent(pId, vComp)
      .addComponent(pId, sComp)
      .addComponent(pId, pComp)
      .addComponent(pId, cComp)
      .addComponent(pId, new MeshComponent(borzoiModel.mesh, borzoiModel.parts));

    const envBuilder = new EnvironmentBuilder(scene);
    envBuilderRef.current = envBuilder;

    const exploreSys = new ExplorationSystem(
      scene,
      envBuilder,
      triggerBanner,
      syncHUDFromECS,
      (kind) => handleInteractableAction(kind)
    );
    const combatSys = new CombatSystem(scene, envBuilder, triggerBanner, syncHUDFromECS);
    const animSys = new AnimationAndCameraSystem(camera, playerLight);

    exploreSysRef.current = exploreSys;
    combatSysRef.current = combatSys;
    animSysRef.current = animSys;

    world.addSystem(exploreSys).addSystem(combatSys).addSystem(animSys);

    envBuilder.buildDungeonFloorGeometry(world, scene, 1, pComp);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    syncHUDFromECS();

    const onPlayerDied = () => enterHubSanctuary();
    window.addEventListener('borzoi-player-died', onPlayerDied);

    const keysPressed: Record<string, boolean> = {};
    const updateKeyboardVelocity = () => {
      const vc = world.getComponent<VelocityComponent>(pId, 'VelocityComponent');
      if (!vc) return;
      let kx = 0;
      let kz = 0;
      if (keysPressed['KeyA'] || keysPressed['ArrowLeft']) kx -= 1;
      if (keysPressed['KeyD'] || keysPressed['ArrowRight']) kx += 1;
      if (keysPressed['KeyW'] || keysPressed['ArrowUp']) kz -= 1;
      if (keysPressed['KeyS'] || keysPressed['ArrowDown']) kz += 1;
      vc.moveInputX = kx;
      vc.moveInputZ = kz;
      vc.sprint = Boolean(keysPressed['ShiftLeft'] || keysPressed['ShiftRight']);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      keysPressed[e.code] = true;
      updateKeyboardVelocity();

      const cc = world.getComponent<CombatComponent>(pId, 'CombatComponent');
      if (e.code === 'Space' && cc && cc.inCombat && cc.state !== 'blocking') {
        cc.state = 'blocking';
        cc.timer = 0;
        syncHUDFromECS();
      } else if (e.code === 'KeyE') {
        const activeInter = exploreSys.activeInteractable;
        if (activeInter) handleInteractableAction(activeInter.kind);
      } else if (e.code === 'Digit1' && cc?.inCombat) {
        combatSys.executeSpecialSkill(pId, 'dash');
      } else if (e.code === 'Digit2' && cc?.inCombat) {
        combatSys.executeSpecialSkill(pId, 'howl');
      } else if (e.code === 'Digit3' && cc?.inCombat) {
        combatSys.executeSpecialSkill(pId, 'whirl');
      } else if (e.code === 'KeyH') {
        setDockCollapsed((prev) => !prev);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysPressed[e.code] = false;
      updateKeyboardVelocity();

      const cc = world.getComponent<CombatComponent>(pId, 'CombatComponent');
      if (e.code === 'Space' && cc && cc.state === 'blocking') {
        cc.state = 'idle';
        syncHUDFromECS();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const onResize = () => {
      if (!mountEl) return;
      camera.aspect = mountEl.clientWidth / mountEl.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountEl.clientWidth, mountEl.clientHeight);
    };
    window.addEventListener('resize', onResize);

    let frameId = 0;
    let isDisposed = false;
    let lastTime = performance.now();
    let uiSyncAccumulator = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      const poll = () => {
        if (isDisposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (isDisposed) return;
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      const elapsed = now / 1000;

      world.update(dt, elapsed);
      renderer.render(scene, camera);

      uiSyncAccumulator += dt;
      if (uiSyncAccumulator >= 0.08) {
        uiSyncAccumulator = 0;
        syncHUDFromECS();
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      isDisposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('borzoi-player-died', onPlayerDied);
      renderer.dispose();
    };
  }, [enterHubSanctuary, handleInteractableAction, syncHUDFromECS, triggerBanner]);

  const pointerStateRef = useRef<{
    isDown: boolean;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    mode: 'combat_swipe' | 'orbit' | 'none';
  }>({ isDown: false, startX: 0, startY: 0, lastX: 0, lastY: 0, mode: 'none' });

  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseVecRef = useRef(new THREE.Vector2());

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const world = worldRef.current;
    const pId = playerEntityRef.current;
    const camera = cameraRef.current;
    if (!world || pId === null || !camera) return;

    const cComp = world.getComponent<CombatComponent>(pId, 'CombatComponent');
    if (!cComp) return;

    const clientX = e.clientX;
    const clientY = e.clientY;

    if (cComp.inCombat) {
      if (cComp.attackCooldown > 0 || cComp.state === 'blocking') return;
      cComp.state = 'charging';
      cComp.charge = 0;
      cComp.chargeDirX = clientX < window.innerWidth / 2 ? -1 : 1;
      cComp.chargeDirY = 0;

      pointerStateRef.current = {
        isDown: true,
        startX: clientX,
        startY: clientY,
        lastX: clientX,
        lastY: clientY,
        mode: 'combat_swipe',
      };
      setSwipeVector({ active: true, x1: clientX, y1: clientY, x2: clientX, y2: clientY });
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    mouseVecRef.current.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouseVecRef.current.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycasterRef.current.setFromCamera(mouseVecRef.current, camera);

    const lootIds = world.query('LootDropComponent', 'MeshComponent');
    for (const lId of lootIds) {
      const lm = world.getComponent<MeshComponent>(lId, 'MeshComponent')!;
      const hits = raycasterRef.current.intersectObject(lm.mesh, true);
      if (hits.length > 0) {
        const lComp = world.getComponent<LootDropComponent>(lId, 'LootDropComponent')!;
        lComp.magnetized = true;
        return;
      }
    }

    if (animSysRef.current) {
      pointerStateRef.current = {
        isDown: true,
        startX: clientX,
        startY: clientY,
        lastX: clientX,
        lastY: clientY,
        mode: 'orbit',
      };
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const pState = pointerStateRef.current;
    if (!pState.isDown) return;

    const world = worldRef.current;
    const pId = playerEntityRef.current;
    if (!world || pId === null) return;

    const clientX = e.clientX;
    const clientY = e.clientY;

    if (pState.mode === 'combat_swipe') {
      const cComp = world.getComponent<CombatComponent>(pId, 'CombatComponent');
      if (!cComp || cComp.state !== 'charging') return;

      const dx = clientX - pState.startX;
      const dy = clientY - pState.startY;
      if (Math.hypot(dx, dy) > 20) {
        cComp.chargeDirX = dx >= 0 ? 1 : -1;
        cComp.chargeDirY = Math.abs(dy) > Math.abs(dx) ? Math.sign(dy) : 0;
      }
      setSwipeVector({
        active: true,
        x1: pState.startX,
        y1: pState.startY,
        x2: clientX,
        y2: clientY,
      });
    } else if (pState.mode === 'orbit' && animSysRef.current) {
      const dx = clientX - pState.lastX;
      const dy = clientY - pState.lastY;
      pState.lastX = clientX;
      pState.lastY = clientY;

      if (Math.hypot(clientX - pState.startX, clientY - pState.startY) > 6) {
        animSysRef.current.inspectModeActive = true;
        animSysRef.current.inspectOrbitAngle -= dx * 0.008;
        animSysRef.current.inspectOrbitPitch = THREE.MathUtils.clamp(
          animSysRef.current.inspectOrbitPitch + dy * 0.006,
          0.08,
          1.15
        );
      }
    }
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const pState = pointerStateRef.current;
    if (!pState.isDown) return;
    pState.isDown = false;

    const world = worldRef.current;
    const pId = playerEntityRef.current;
    if (!world || pId === null) return;

    if (pState.mode === 'combat_swipe') {
      setSwipeVector((prev) => ({ ...prev, active: false }));
      const cComp = world.getComponent<CombatComponent>(pId, 'CombatComponent');
      if (!cComp || cComp.state !== 'charging') return;

      const dx = e.clientX - pState.startX;
      const dy = e.clientY - pState.startY;
      const dirX = Math.abs(dx) > 12 ? Math.sign(dx) : cComp.chargeDirX;
      const dirY = Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 25 ? Math.sign(dy) : 0;

      if (cComp.charge >= 0.12) {
        combatSysRef.current?.executePlayerSwipeAttack(pId, dirX, dirY);
      } else {
        cComp.state = 'idle';
        cComp.charge = 0;
      }
    }
  };

  // Virtual Touch Joystick Handlers
  const joyOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const handleJoystickDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    joyOriginRef.current = { x: cx, y: cy };
    updateJoystickDelta(e.clientX, e.clientY);
  };

  const handleJoystickMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!joyPos.active) return;
    e.stopPropagation();
    updateJoystickDelta(e.clientX, e.clientY);
  };

  const handleJoystickUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setJoyPos({ active: false, dx: 0, dy: 0 });
    const world = worldRef.current;
    const pId = playerEntityRef.current;
    if (world && pId !== null) {
      const vc = world.getComponent<VelocityComponent>(pId, 'VelocityComponent');
      if (vc) {
        vc.moveInputX = 0;
        vc.moveInputZ = 0;
      }
    }
  };

  const updateJoystickDelta = (clientX: number, clientY: number) => {
    const maxR = 32;
    let dx = clientX - joyOriginRef.current.x;
    let dy = clientY - joyOriginRef.current.y;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    setJoyPos({ active: true, dx, dy });

    const world = worldRef.current;
    const pId = playerEntityRef.current;
    if (world && pId !== null) {
      const vc = world.getComponent<VelocityComponent>(pId, 'VelocityComponent');
      if (vc) {
        vc.moveInputX = dx / maxR;
        vc.moveInputZ = dy / maxR;
      }
      if (animSysRef.current) {
        animSysRef.current.inspectModeActive = false;
      }
    }
  };

  const startBlocking = (e: React.PointerEvent) => {
    e.stopPropagation();
    const world = worldRef.current;
    const pId = playerEntityRef.current;
    if (!world || pId === null) return;
    const cComp = world.getComponent<CombatComponent>(pId, 'CombatComponent');
    if (cComp && cComp.inCombat) {
      cComp.state = 'blocking';
      cComp.timer = 0;
      syncHUDFromECS();
    }
  };

  const stopBlocking = (e: React.PointerEvent) => {
    e.stopPropagation();
    const world = worldRef.current;
    const pId = playerEntityRef.current;
    if (!world || pId === null) return;
    const cComp = world.getComponent<CombatComponent>(pId, 'CombatComponent');
    if (cComp && cComp.state === 'blocking') {
      cComp.state = 'idle';
      syncHUDFromECS();
    }
  };

  const handleUsePotion = () => {
    const world = worldRef.current;
    const pId = playerEntityRef.current;
    if (!world || pId === null) return;
    const pComp = world.getComponent<PlayerComponent>(pId, 'PlayerComponent')!;
    const sComp = world.getComponent<StatsComponent>(pId, 'StatsComponent')!;

    if (pComp.potions <= 0) {
      triggerBanner('ФЛЯГИ ПУСТЫ!', '#f43f5e', 'Отдохните у очага в Остроге-Святилище');
      return;
    }
    if (sComp.hp >= sComp.maxHp) {
      triggerBanner('ЗДОРОВЬЕ ПОЛНОЕ', '#38bdf8');
      return;
    }
    pComp.potions--;
    const heal = Math.round(sComp.maxHp * 0.45);
    sComp.hp = Math.min(sComp.maxHp, sComp.hp + heal);
    sfx.playPickup();
    triggerBanner(`+${heal} ОЗ (ТАЁЖНЫЙ СБИТЕНЬ)`, '#10b981');
    syncHUDFromECS();
  };

  const handleToggleAutoRun = () => {
    const world = worldRef.current;
    const pId = playerEntityRef.current;
    if (!world || pId === null) return;
    const vc = world.getComponent<VelocityComponent>(pId, 'VelocityComponent')!;
    vc.autoRun = !vc.autoRun;
    if (vc.autoRun && animSysRef.current) {
      animSysRef.current.inspectModeActive = false;
    }
    syncHUDFromECS();
  };

  const handleToggleInspect360 = () => {
    if (!animSysRef.current) return;
    animSysRef.current.inspectModeActive = !animSysRef.current.inspectModeActive;
    if (animSysRef.current.inspectModeActive) {
      triggerBanner('ОСМОТР БОРЗОЙ 360°', '#38bdf8', 'Вращайте камеру пальцем или мышью');
    }
    syncHUDFromECS();
  };

  const handleUpgradeStat = (statKey: 'jawsStrength' | 'vitality' | 'agility' | 'spirit') => {
    const world = worldRef.current;
    const pId = playerEntityRef.current;
    if (!world || pId === null) return;
    const pComp = world.getComponent<PlayerComponent>(pId, 'PlayerComponent')!;
    const sComp = world.getComponent<StatsComponent>(pId, 'StatsComponent')!;

    if (pComp.souls < pComp.lvlCost) {
      triggerBanner('НЕДОСТАТОЧНО ДУШ', '#f43f5e');
      return;
    }

    pComp.souls -= pComp.lvlCost;
    sComp.level++;
    sComp[statKey]++;
    pComp.lvlCost = Math.round(pComp.lvlCost * 1.35);

    const eff = getEffectivePlayerStats(sComp, pComp);
    sComp.maxHp = eff.totalMaxHp;
    sComp.hp = sComp.maxHp;

    sfx.playCraftOrLevelUp();
    triggerBanner(`УРОВЕНЬ ${sComp.level}!`, '#00ffcc');
    syncHUDFromECS();
  };

  const handleWeaponAction = (weaponId: string) => {
    const world = worldRef.current;
    const pId = playerEntityRef.current;
    if (!world || pId === null) return;
    const pComp = world.getComponent<PlayerComponent>(pId, 'PlayerComponent')!;
    const weapon = WEAPONS_CATALOG.find((w) => w.id === weaponId);
    if (!weapon) return;

    if (pComp.unlockedWeapons.has(weaponId)) {
      pComp.equippedWeaponId = weaponId;
      refreshBorzoiEquipmentMesh(world, pId);
      sfx.playSlash(0.8, true);
      triggerBanner(`В ПАСТИ: ${weapon.name.toUpperCase()}`, weapon.glowColor);
      syncHUDFromECS();
      return;
    }

    if (pComp.souls < weapon.soulsCost) {
      triggerBanner('НЕХВАТКА ДУШ ДЛЯ КОВКИ', '#f43f5e');
      return;
    }
    for (const [mKey, reqAmt] of Object.entries(weapon.recipe)) {
      const matId = mKey as MaterialId;
      if ((pComp.materials[matId] ?? 0) < (reqAmt ?? 0)) {
        triggerBanner(`НУЖЕН МАТЕРИАЛ: ${MATERIALS_CATALOG[matId].shortName}`, '#f43f5e');
        return;
      }
    }

    pComp.souls -= weapon.soulsCost;
    for (const [mKey, reqAmt] of Object.entries(weapon.recipe)) {
      const matId = mKey as MaterialId;
      pComp.materials[matId] -= reqAmt ?? 0;
    }
    pComp.unlockedWeapons.add(weaponId);
    pComp.equippedWeaponId = weaponId;
    refreshBorzoiEquipmentMesh(world, pId);
    sfx.playCraftOrLevelUp();
    triggerBanner(`ВЫКОВАНО: ${weapon.name.toUpperCase()}!`, weapon.glowColor);
    syncHUDFromECS();
  };

  const handleArmorAction = (armorId: string) => {
    const world = worldRef.current;
    const pId = playerEntityRef.current;
    if (!world || pId === null) return;
    const pComp = world.getComponent<PlayerComponent>(pId, 'PlayerComponent')!;
    const sComp = world.getComponent<StatsComponent>(pId, 'StatsComponent')!;
    const armor = ARMORS_CATALOG.find((a) => a.id === armorId);
    if (!armor) return;

    if (pComp.unlockedArmors.has(armorId)) {
      pComp.equippedArmorId = armorId;
      refreshBorzoiEquipmentMesh(world, pId);
      const eff = getEffectivePlayerStats(sComp, pComp);
      sComp.maxHp = eff.totalMaxHp;
      sfx.playPickup();
      triggerBanner(`НАДЕТО: ${armor.name.toUpperCase()}`, armor.cssColor);
      syncHUDFromECS();
      return;
    }

    if (pComp.souls < armor.soulsCost) {
      triggerBanner('НЕХВАТКА ДУШ ДЛЯ БРОНИ', '#f43f5e');
      return;
    }
    for (const [mKey, reqAmt] of Object.entries(armor.recipe)) {
      const matId = mKey as MaterialId;
      if ((pComp.materials[matId] ?? 0) < (reqAmt ?? 0)) {
        triggerBanner(`НУЖЕН МАТЕРИАЛ: ${MATERIALS_CATALOG[matId].shortName}`, '#f43f5e');
        return;
      }
    }

    pComp.souls -= armor.soulsCost;
    for (const [mKey, reqAmt] of Object.entries(armor.recipe)) {
      const matId = mKey as MaterialId;
      pComp.materials[matId] -= reqAmt ?? 0;
    }
    pComp.unlockedArmors.add(armorId);
    pComp.equippedArmorId = armorId;
    refreshBorzoiEquipmentMesh(world, pId);
    const eff = getEffectivePlayerStats(sComp, pComp);
    sComp.maxHp = eff.totalMaxHp;
    sComp.hp = sComp.maxHp;
    sfx.playCraftOrLevelUp();
    triggerBanner(`СОЗДАНО: ${armor.name.toUpperCase()}!`, armor.cssColor);
    syncHUDFromECS();
  };

  const handleSelectSkin = (skinId: string) => {
    const world = worldRef.current;
    const pId = playerEntityRef.current;
    if (!world || pId === null) return;
    const pComp = world.getComponent<PlayerComponent>(pId, 'PlayerComponent')!;
    pComp.equippedSkinId = skinId;
    refreshBorzoiEquipmentMesh(world, pId);
    sfx.playPickup();
    syncHUDFromECS();
  };

  const handleBuyMaterial = (matId: MaterialId, costSouls: number) => {
    const world = worldRef.current;
    const pId = playerEntityRef.current;
    if (!world || pId === null) return;
    const pComp = world.getComponent<PlayerComponent>(pId, 'PlayerComponent')!;
    if (pComp.souls < costSouls) {
      triggerBanner('НЕДОСТАТОЧНО ДУШ', '#f43f5e');
      return;
    }
    pComp.souls -= costSouls;
    pComp.materials[matId] = (pComp.materials[matId] ?? 0) + 1;
    sfx.playPickup();
    triggerBanner(`+1 ${MATERIALS_CATALOG[matId].shortName.toUpperCase()}`, MATERIALS_CATALOG[matId].cssColor);
    syncHUDFromECS();
  };

  const toggleMute = () => {
    sfx.muted = !muted;
    setMuted(!muted);
  };

  const isSweetSpot = hud.combatCharge >= 0.75 && hud.combatCharge <= 0.96;

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#06080e] select-none">
      {/* 1. Isolated WebGL Canvas Mount */}
      <div
        ref={canvasMountRef}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
        onPointerCancel={handleCanvasPointerUp}
        className="w-full h-full cursor-crosshair touch-none"
      />

      {/* 2. TES: Blades Directional Swipe SVG Overlay */}
      <svg className="fixed inset-0 w-full h-full pointer-events-none z-10">
        {swipeVector.active && (
          <g>
            <line
              x1={swipeVector.x1}
              y1={swipeVector.y1}
              x2={swipeVector.x2}
              y2={swipeVector.y2}
              stroke={isSweetSpot ? '#00ffcc' : '#f43f5e'}
              strokeWidth={isSweetSpot ? 6 : 4}
              strokeLinecap="round"
            />
            <circle
              cx={swipeVector.x1}
              cy={swipeVector.y1}
              r={16 + hud.combatCharge * 24}
              fill="none"
              stroke={isSweetSpot ? '#00ffcc' : '#f59e0b'}
              strokeWidth="3"
              strokeDasharray="6 4"
            />
          </g>
        )}
      </svg>

      {/* 3. Ultra-Compact Top HUD Bar (Never overlaps on mobile) */}
      <header className="fixed top-2 inset-x-2 z-20 pointer-events-none max-w-5xl mx-auto flex flex-col gap-1.5">
        <div className="bg-[#0b0d14]/92 border border-slate-800/90 rounded-xl px-2.5 py-1.5 pointer-events-auto flex items-center justify-between gap-2 shadow-lg">
          {/* Left: HP + Charge/Stamina + Level & Souls */}
          <div className="flex flex-col gap-1 min-w-[135px] sm:min-w-[190px] flex-1 max-w-xs">
            <div className="flex items-center justify-between text-[11px] font-mono-num leading-none">
              <span className="text-rose-400 font-bold">
                ОЗ {hud.hp}/{hud.maxHp}
              </span>
              <span className="text-cyan-300 font-semibold">
                Ур.{hud.level} · {hud.souls} Душ
              </span>
            </div>
            <div className="w-full h-2 bg-slate-900 rounded-sm overflow-hidden border border-slate-800">
              <div
                className="h-full bg-rose-600 transition-all duration-150"
                style={{ width: `${Math.min(100, (hud.hp / Math.max(1, hud.maxHp)) * 100)}%` }}
              />
            </div>
            <div className="w-full h-1 bg-slate-900 rounded-sm overflow-hidden">
              {hud.inCombat && hud.combatCharge > 0 ? (
                <div
                  className={`h-full ${isSweetSpot ? 'bg-cyan-400' : 'bg-amber-400'}`}
                  style={{ width: `${hud.combatCharge * 100}%` }}
                />
              ) : (
                <div
                  className="h-full bg-teal-500/80 transition-all duration-150"
                  style={{ width: `${(hud.stamina / Math.max(1, hud.maxStamina)) * 100}%` }}
                />
              )}
            </div>
          </div>

          {/* Center: Floor & Room Mini-Map Chain */}
          <div className="flex flex-col items-center justify-center px-1">
            <div className="text-[11px] font-display font-bold text-slate-200 tracking-wide whitespace-nowrap">
              {hud.inHub ? 'ОСТРОГ-СВЯТИЛИЩЕ' : `ЭТАЖ ${hud.floor} · ЗАЛ ${hud.currentRoomIndex + 1}/${hud.rooms.length}`}
            </div>
            {!hud.inHub && hud.rooms.length > 0 ? (
              <div className="flex items-center gap-1 mt-1" title={hud.currentRoomName}>
                {hud.rooms.map((rm) => {
                  const isCurrent = rm.index === hud.currentRoomIndex;
                  const isExit = rm.theme === 'exit';
                  return (
                    <div
                      key={rm.index}
                      className={`h-2 rounded-xs transition-all ${
                        isCurrent
                          ? 'w-4 bg-cyan-400 border border-white'
                          : isExit
                          ? 'w-2 bg-rose-500/80'
                          : rm.visited
                          ? 'w-2 bg-emerald-500/70'
                          : 'w-2 bg-slate-700'
                      }`}
                    />
                  );
                })}
              </div>
            ) : (
              <span className="text-[10px] text-cyan-400 leading-none mt-0.5">Безопасный Хаб</span>
            )}
          </div>

          {/* Right: Hub Teleport, Export Archive & Audio */}
          <div className="flex items-center gap-1.5 shrink-0">
            {!hud.inCombat && (
              <>
                <button
                  onClick={() =>
                    hud.inHub ? enterDungeonFloor(hud.maxFloor) : enterHubSanctuary()
                  }
                  className="h-8 px-2.5 rounded-lg text-[11px] font-semibold bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 transition-colors whitespace-nowrap cursor-pointer"
                >
                  {hud.inHub ? `В Разлом (Эт.${hud.maxFloor})` : 'В Острог'}
                </button>
              </>
            )}
            <button
              onClick={toggleMute}
              title={muted ? 'Включить звук' : 'Выключить звук'}
              className="h-8 w-8 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center justify-center transition-colors cursor-pointer"
            >
              {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Slim Enemy Target Bar (Only visible during Combat) */}
        {hud.inCombat && hud.enemy && (
          <div className="bg-[#160b18]/92 border border-rose-500/50 rounded-xl px-3 py-1.5 flex flex-col gap-1 shadow-md">
            <div className="flex items-center justify-between text-[11px] font-mono-num leading-none">
              <span className="text-fuchsia-300 font-bold truncate">
                {hud.enemy.name} {hud.enemy.bleeding ? '· КРОВОТОК' : ''}
              </span>
              <span className="text-amber-300 font-semibold shrink-0 ml-2">
                {hud.enemy.state === 'windup'
                  ? 'ЗАМАХ! ЖМИТЕ ЩИТ!'
                  : hud.enemy.state === 'stunned'
                  ? 'ОГЛУШЁН'
                  : `${hud.enemy.hp}/${hud.enemy.maxHp} ОЗ`}
              </span>
            </div>
            <div className="w-full h-2 bg-slate-950 rounded-sm overflow-hidden border border-rose-900/50">
              <div
                className="h-full bg-fuchsia-600 transition-all duration-150"
                style={{
                  width: `${Math.min(100, (hud.enemy.hp / Math.max(1, hud.enemy.maxHp)) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}
      </header>

      {/* 4. Compact Non-Occluding Floating Banner */}
      {banner && (
        <div
          className={`fixed left-1/2 -translate-x-1/2 z-20 pointer-events-none text-center px-3 w-full max-w-md ${
            hud.inCombat ? 'top-28' : 'top-16'
          }`}
        >
          <div
            className="font-display font-bold text-base sm:text-lg tracking-wider drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]"
            style={{ color: banner.color }}
          >
            {banner.text}
          </div>
          {banner.subtext && (
            <div className="text-[11px] text-slate-200 bg-black/75 px-2.5 py-0.5 rounded border border-white/10 inline-block">
              {banner.subtext}
            </div>
          )}
        </div>
      )}

      {/* 5. EXPLORATION MODE CONTROLS (Left Joystick + Right Action Cluster — Never Overlaps!) */}
      {!hud.inCombat && activeTab === 'none' && (
        <>
          {/* Left Thumb Zone: Compact Virtual Touch Joystick */}
          <div
            onPointerDown={handleJoystickDown}
            onPointerMove={handleJoystickMove}
            onPointerUp={handleJoystickUp}
            onPointerCancel={handleJoystickUp}
            className="fixed bottom-16 left-3 z-20 w-20 h-20 rounded-full bg-[#0b0d14]/85 border-2 border-slate-700/80 flex items-center justify-center touch-none cursor-grab active:cursor-grabbing shadow-lg pointer-events-auto"
          >
            <div
              className="w-8 h-8 rounded-full bg-cyan-400/85 border border-white shadow pointer-events-none"
              style={{
                transform: `translate(${joyPos.dx}px, ${joyPos.dy}px)`,
              }}
            />
            <span className="absolute -top-4 text-[9px] font-mono-num text-slate-400 whitespace-nowrap">
              ХОДЬБА
            </span>
          </div>

          {/* Right Thumb Zone: Contextual Interact Prompt + Auto-Walk + Potion */}
          <div className="fixed bottom-16 right-3 z-20 flex flex-col items-end gap-2 pointer-events-auto">
            {hud.interactable && (
              <button
                onClick={() => handleInteractableAction(hud.interactable!.kind)}
                className="bg-[#0b0d14]/95 hover:bg-slate-900 text-white border-2 border-cyan-400 rounded-xl px-3.5 py-2 shadow-xl transition-transform active:scale-95 text-right max-w-[210px] cursor-pointer"
              >
                <div className="font-display font-bold text-xs text-cyan-300 truncate">
                  [E] {hud.interactable.title}
                </div>
                <div className="text-[10px] text-slate-300 truncate">
                  {hud.interactable.subtitle}
                </div>
              </button>
            )}

            <div className="flex items-center gap-1.5">
              <button
                onClick={handleUsePotion}
                className="h-10 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 shadow cursor-pointer"
              >
                <Heart className="w-3.5 h-3.5" />
                <span className="font-mono-num">{hud.potions}</span>
              </button>

              {!hud.inHub && (
                <button
                  onClick={handleToggleAutoRun}
                  className={`h-10 px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 shadow transition-colors cursor-pointer ${
                    hud.autoRun
                      ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
                      : 'bg-[#0b0d14]/90 border-slate-700 text-slate-300'
                  }`}
                >
                  <Footprints className="w-3.5 h-3.5" />
                  <span>{hud.autoRun ? 'Авто: ВКЛ' : 'Авто-Путь'}</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* 6. COMBAT MODE CONTROLS (Single Ultra-Compact Bottom Row — < 12% Screen Height!) */}
      {hud.inCombat && (
        <div className="fixed bottom-2.5 inset-x-2.5 z-30 max-w-lg mx-auto flex flex-col items-center gap-1 pointer-events-none">
          <div className="text-[10px] text-slate-300 bg-black/75 px-2.5 py-0.5 rounded border border-slate-800/80">
            Зажмите и свайпните по экрану для удара · Комбо x{hud.comboCount}
          </div>

          <div className="w-full bg-[#0b0d14]/95 border border-slate-800 rounded-2xl p-1.5 flex items-center gap-1.5 pointer-events-auto shadow-2xl">
            {/* Potion Button */}
            <button
              onClick={handleUsePotion}
              title="Выпить Таёжный Сбитень"
              className="h-11 min-w-[48px] px-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-300 flex flex-col items-center justify-center cursor-pointer shrink-0"
            >
              <Heart className="w-4 h-4" />
              <span className="text-[10px] font-mono-num font-bold leading-none mt-0.5">
                {hud.potions}
              </span>
            </button>

            {/* Primary Hold-to-Block / Timed Parry Button */}
            <button
              onPointerDown={startBlocking}
              onPointerUp={stopBlocking}
              onPointerLeave={stopBlocking}
              className="flex-1 h-11 px-3 rounded-xl font-display font-bold text-xs sm:text-sm bg-amber-500/20 hover:bg-amber-500/30 active:bg-amber-400 active:text-slate-950 text-amber-300 border-2 border-amber-400 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Shield className="w-4 h-4 shrink-0" />
              <span className="truncate">ЩИТ / ПАРИРОВАНИЕ</span>
            </button>

            {/* 3 Compact Skill Buttons */}
            <button
              onClick={() =>
                playerEntityRef.current &&
                combatSysRef.current?.executeSpecialSkill(playerEntityRef.current, 'dash')
              }
              disabled={hud.skillDashCd > 0}
              title="Иайдо-Рывок (Сбивает замах врага)"
              className={`h-11 min-w-[50px] px-2 rounded-xl border flex flex-col items-center justify-center transition-colors cursor-pointer shrink-0 ${
                hud.skillDashCd > 0
                  ? 'bg-slate-900 border-slate-800 text-slate-500'
                  : 'bg-sky-500/20 hover:bg-sky-500/30 border-sky-400/60 text-sky-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span className="text-[9px] font-mono-num font-bold leading-none mt-1">
                {hud.skillDashCd > 0 ? `${hud.skillDashCd.toFixed(0)}с` : 'Рывок'}
              </span>
            </button>

            <button
              onClick={() =>
                playerEntityRef.current &&
                combatSysRef.current?.executeSpecialSkill(playerEntityRef.current, 'howl')
              }
              disabled={hud.skillHowlCd > 0}
              title="Вой Вьюги (Оглушение + Исцеление)"
              className={`h-11 min-w-[50px] px-2 rounded-xl border flex flex-col items-center justify-center transition-colors cursor-pointer shrink-0 ${
                hud.skillHowlCd > 0
                  ? 'bg-slate-900 border-slate-800 text-slate-500'
                  : 'bg-purple-500/20 hover:bg-purple-500/30 border-purple-400/60 text-purple-200'
              }`}
            >
              <Wind className="w-3.5 h-3.5" />
              <span className="text-[9px] font-mono-num font-bold leading-none mt-1">
                {hud.skillHowlCd > 0 ? `${hud.skillHowlCd.toFixed(0)}с` : 'Вой'}
              </span>
            </button>

            <button
              onClick={() =>
                playerEntityRef.current &&
                combatSysRef.current?.executeSpecialSkill(playerEntityRef.current, 'whirl')
              }
              disabled={hud.skillWhirlCd > 0}
              title="Багровый Вихрь (Кровотечение)"
              className={`h-11 min-w-[50px] px-2 rounded-xl border flex flex-col items-center justify-center transition-colors cursor-pointer shrink-0 ${
                hud.skillWhirlCd > 0
                  ? 'bg-slate-900 border-slate-800 text-slate-500'
                  : 'bg-rose-500/20 hover:bg-rose-500/30 border-rose-400/60 text-rose-200'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span className="text-[9px] font-mono-num font-bold leading-none mt-1">
                {hud.skillWhirlCd > 0 ? `${hud.skillWhirlCd.toFixed(0)}с` : 'Вихрь'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* 7. Modal Sheet Drawer (Weapons, Armors & Coat, Stats, Materials) */}
      {activeTab !== 'none' && !hud.inCombat && (
        <div className="fixed inset-x-0 bottom-14 z-30 max-w-4xl mx-auto px-2.5 pointer-events-auto">
          <div className="bg-[#0b0d14]/96 border border-slate-700 rounded-2xl p-3.5 sm:p-5 shadow-2xl max-h-[66vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-800">
              <div>
                <h2 className="font-display font-bold text-sm sm:text-base text-white">
                  {activeTab === 'weapons' && 'ПАРЕНЬСКАЯ КУЗНИЦА (ОРУЖИЕ В ЗУБАХ)'}
                  {activeTab === 'armors' && 'ДОСПЕХИ И ОКРАС БОРЗОЙ'}
                  {activeTab === 'stats' && 'ПРОКАЧКА ХАРАКТЕРИСТИК БОРЗОЙ'}
                  {activeTab === 'inventory' && 'ПРИПАСЫ И ИДОЛ МЕНОВОГО ТОРГА'}
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5 font-mono-num">
                  Души: <span className="text-cyan-300">{hud.souls}</span> · Сталь:{' '}
                  <span className="text-sky-300">{hud.materials.steel}</span> · Шёлк:{' '}
                  <span className="text-rose-300">{hud.materials.silk}</span> · Обереги:{' '}
                  <span className="text-amber-300">{hud.materials.seal}</span> · Янтарь:{' '}
                  <span className="text-purple-300">{hud.materials.ash}</span> · Нефрит:{' '}
                  <span className="text-emerald-300">{hud.materials.jade}</span>
                </p>
              </div>
              <button
                onClick={() => setActiveTab('none')}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {activeTab === 'weapons' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {WEAPONS_CATALOG.map((w) => {
                  const unlocked = hud.unlockedWeapons.includes(w.id);
                  const equipped = hud.equippedWeaponId === w.id;
                  return (
                    <div
                      key={w.id}
                      className={`p-3 rounded-xl border flex flex-col justify-between gap-2.5 ${
                        equipped
                          ? 'bg-slate-900/95 border-cyan-400'
                          : 'bg-slate-900/60 border-slate-800'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className="font-display font-bold text-sm"
                            style={{ color: w.glowColor }}
                          >
                            {w.name}
                          </span>
                          <span className="text-[11px] font-mono-num text-slate-400 shrink-0">
                            {equipped ? 'В ЗУБАХ' : unlocked ? 'ДОСТУПНО' : `${w.soulsCost} Душ`}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                          {w.description}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono-num text-slate-300 mt-2">
                          <span>Урон: {w.baseDmg}</span>
                          <span>·</span>
                          <span>Крит: {Math.round(w.critChance * 100)}%</span>
                          {w.bleedDmg > 0 && (
                            <>
                              <span>·</span>
                              <span className="text-rose-400">Кровоток: {w.bleedDmg}/с</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                        <div className="text-[11px] font-mono-num text-slate-400">
                          {unlocked
                            ? 'В арсенале'
                            : Object.entries(w.recipe)
                                .map(
                                  ([k, v]) =>
                                    `${MATERIALS_CATALOG[k as MaterialId].shortName} ${v}`
                                )
                                .join(' · ')}
                        </div>
                        <button
                          onClick={() => handleWeaponAction(w.id)}
                          disabled={equipped}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                            equipped
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                              : unlocked
                              ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-600'
                              : 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold'
                          }`}
                        >
                          {equipped ? 'В пасти' : unlocked ? 'Взять' : 'Выковать'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === 'armors' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-semibold text-slate-300 mb-2">
                    Окрас Шерсти Борзой:
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {COAT_SKINS.map((skin) => {
                      const active = hud.equippedSkinId === skin.id;
                      return (
                        <button
                          key={skin.id}
                          onClick={() => handleSelectSkin(skin.id)}
                          className={`px-3 py-2 rounded-xl border text-xs font-medium text-left transition-colors cursor-pointer ${
                            active
                              ? 'bg-cyan-500/20 border-cyan-400 text-white'
                              : 'bg-slate-900/70 border-slate-800 text-slate-300'
                          }`}
                        >
                          {skin.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {ARMORS_CATALOG.map((a) => {
                    const unlocked = hud.unlockedArmors.includes(a.id);
                    const equipped = hud.equippedArmorId === a.id;
                    return (
                      <div
                        key={a.id}
                        className={`p-3 rounded-xl border flex flex-col justify-between gap-2.5 ${
                          equipped
                            ? 'bg-slate-900/95 border-cyan-400'
                            : 'bg-slate-900/60 border-slate-800'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className="font-display font-bold text-sm"
                              style={{ color: a.cssColor }}
                            >
                              {a.name}
                            </span>
                            <span className="text-[11px] font-mono-num text-slate-400">
                              {equipped ? 'НАДЕТО' : unlocked ? 'ДОСТУПНО' : `${a.soulsCost} Душ`}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                            {a.description}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono-num text-slate-300 mt-2">
                            <span>ОЗ: +{a.maxHpBonus}</span>
                            <span>·</span>
                            <span>Защита: {Math.round(a.defensePct * 100)}%</span>
                            <span>·</span>
                            <span>Бег: +{a.moveSpeedBonus}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                          <div className="text-[11px] font-mono-num text-slate-400">
                            {unlocked
                              ? 'Создано'
                              : Object.entries(a.recipe)
                                  .map(
                                    ([k, v]) =>
                                      `${MATERIALS_CATALOG[k as MaterialId].shortName} ${v}`
                                  )
                                  .join(' · ')}
                          </div>
                          <button
                            onClick={() => handleArmorAction(a.id)}
                            disabled={equipped}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                              equipped
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                                : unlocked
                                ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-600'
                                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold'
                            }`}
                          >
                            {equipped ? 'Надето' : unlocked ? 'Надеть' : 'Создать'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'stats' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  {
                    key: 'jawsStrength' as const,
                    title: 'Стальная Хватка Челюстей',
                    val: hud.jawsStrength,
                    desc: '+5 к урону клинка и +8% к критическому множителю.',
                  },
                  {
                    key: 'vitality' as const,
                    title: 'Таёжная Живучесть',
                    val: hud.vitality,
                    desc: '+25 к здоровью, +2% к защите и полное исцеление.',
                  },
                  {
                    key: 'agility' as const,
                    title: 'Ретивость Борзой',
                    val: hud.agility,
                    desc: '+8% к скорости замаха, +3% к шансу крита и скорости бега.',
                  },
                  {
                    key: 'spirit' as const,
                    title: 'Шаманский Резонанс Оммёдо',
                    val: hud.spirit,
                    desc: 'Расширяет окно Парирования и усиливает Кровотечение.',
                  },
                ].map((st) => (
                  <div
                    key={st.key}
                    className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between gap-2.5"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-display font-bold text-sm text-cyan-300">
                          {st.title}
                        </span>
                        <span className="font-mono-num text-xs text-white">Ранг {st.val}</span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1">{st.desc}</p>
                    </div>
                    <button
                      onClick={() => handleUpgradeStat(st.key)}
                      className="w-full py-2 px-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
                    >
                      Повысить ({hud.lvlCost} Душ)
                    </button>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'inventory' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {(Object.keys(MATERIALS_CATALOG) as MaterialId[]).map((matId) => {
                  const def = MATERIALS_CATALOG[matId];
                  const count = hud.materials[matId] ?? 0;
                  const soulPrice = matId === 'jade' ? 26 : matId === 'ash' ? 16 : 10;
                  return (
                    <div
                      key={matId}
                      className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between gap-2.5"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span
                            className="font-display font-bold text-sm"
                            style={{ color: def.cssColor }}
                          >
                            {def.name}
                          </span>
                          <span className="font-mono-num text-sm font-bold text-white">
                            x{count}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{def.description}</p>
                      </div>
                      <button
                        onClick={() => handleBuyMaterial(matId, soulPrice)}
                        className="w-full py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
                      >
                        Обменять за {soulPrice} Душ
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}


      {/* 8. Unified Compact Bottom Navigation Dock (Hidden during Combat so Combat Bar has 100% clean space) */}
      {!hud.inCombat && (
        <div className="fixed bottom-2 inset-x-2 z-30 max-w-xl mx-auto flex flex-col items-center pointer-events-none">
          {!dockCollapsed ? (
            <div className="pointer-events-auto w-full bg-[#0b0d14]/95 border border-slate-800 rounded-2xl p-1 shadow-2xl grid grid-cols-5 gap-1">
              <button
                onClick={() => setActiveTab(activeTab === 'weapons' ? 'none' : 'weapons')}
                className={`h-10 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                  activeTab === 'weapons'
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-200 hover:bg-slate-800/80'
                }`}
              >
                <Swords className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Оружие</span>
              </button>

              <button
                onClick={() => setActiveTab(activeTab === 'armors' ? 'none' : 'armors')}
                className={`h-10 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                  activeTab === 'armors'
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-200 hover:bg-slate-800/80'
                }`}
              >
                <Hammer className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Броня</span>
              </button>

              <button
                onClick={() => setActiveTab(activeTab === 'stats' ? 'none' : 'stats')}
                className={`h-10 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                  activeTab === 'stats'
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-200 hover:bg-slate-800/80'
                }`}
              >
                <Award className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Ур.+ ({hud.lvlCost})</span>
              </button>

              <button
                onClick={() => setActiveTab(activeTab === 'inventory' ? 'none' : 'inventory')}
                className={`h-10 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                  activeTab === 'inventory'
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-200 hover:bg-slate-800/80'
                }`}
              >
                <Package className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Торг</span>
              </button>

              <button
                onClick={handleToggleInspect360}
                className={`h-10 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                  hud.inspectMode
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-200 hover:bg-slate-800/80'
                }`}
              >
                <Eye className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">360°</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setDockCollapsed(false)}
              className="pointer-events-auto px-3 py-1 rounded-lg bg-[#0b0d14]/90 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-1 cursor-pointer"
            >
              <ChevronUp className="w-3.5 h-3.5" />
              <span>Меню</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
