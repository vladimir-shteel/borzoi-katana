import * as THREE from 'three';

export type EntityId = number;

export interface Component {
  readonly _type: string;
}

export abstract class System {
  public world!: World;
  abstract update(dt: number, time: number): void;
}

export class World {
  private entities = new Map<EntityId, Map<string, Component>>();
  private systems: System[] = [];
  private nextId: EntityId = 1;

  public createEntity(): EntityId {
    const id = this.nextId++;
    this.entities.set(id, new Map());
    return id;
  }

  public addComponent<T extends Component>(entity: EntityId, component: T): this {
    const map = this.entities.get(entity);
    if (map) {
      map.set(component._type, component);
    }
    return this;
  }

  public getComponent<T extends Component>(entity: EntityId, typeName: string): T | undefined {
    return this.entities.get(entity)?.get(typeName) as T | undefined;
  }

  public hasComponents(entity: EntityId, typeNames: string[]): boolean {
    const comps = this.entities.get(entity);
    if (!comps) return false;
    for (let i = 0; i < typeNames.length; i++) {
      if (!comps.has(typeNames[i])) return false;
    }
    return true;
  }

  public removeComponent(entity: EntityId, typeName: string): void {
    this.entities.get(entity)?.delete(typeName);
  }

  public removeEntity(entity: EntityId): void {
    const comps = this.entities.get(entity);
    if (comps) {
      const meshComp = comps.get('MeshComponent') as { mesh?: THREE.Object3D } | undefined;
      if (meshComp?.mesh && meshComp.mesh.parent) {
        meshComp.mesh.parent.remove(meshComp.mesh);
      }
    }
    this.entities.delete(entity);
  }

  public query(...typeNames: string[]): EntityId[] {
    const result: EntityId[] = [];
    for (const [id] of this.entities) {
      if (this.hasComponents(id, typeNames)) {
        result.push(id);
      }
    }
    return result;
  }

  public addSystem(system: System): this {
    system.world = this;
    this.systems.push(system);
    return this;
  }

  public update(dt: number, time: number): void {
    for (let i = 0; i < this.systems.length; i++) {
      this.systems[i].update(dt, time);
    }
  }

  public clearEntitiesExcept(keepIds: Set<EntityId>): void {
    for (const [id] of this.entities) {
      if (!keepIds.has(id)) {
        this.removeEntity(id);
      }
    }
  }
}
