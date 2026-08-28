
import { Geom3 } from '@jscad/modeling/src/geometries/types';

import { Feature } from '../../core/enclosure/feature';
import { Surface } from '../../core/enclosure';


export type StoredObject = {
    geometry: Geom3;
    x: number;
    y: number;
    z: number;
    surface: Surface;
};

export class ObjectStore {
    private objects = new Map<string, StoredObject>();

    set(
        id: string,
        geometry: Geom3,
        surface: Surface,
        position: [number, number, number] = [0, 0, 0],
    ): void {
        const [x, y, z] = position;

        this.objects.set(id, {
            geometry,
            x,
            y,
            z,
            surface,
        });
    }

    get(id: string): StoredObject | undefined {
        return this.objects.get(id);
    }

    getFeature(id: string): Feature | undefined {
        const obj = this.get(id);
        if (!obj) {
            return undefined;
        }
        return {
            geometry: obj.geometry,
            surface: obj.surface,
            x: obj.x,
            y: obj.y,
            z: obj.z,
        };
    }

    setPosition(
        id: string,
        position: [number, number, number],
    ): void {
        const object = this.objects.get(id);

        if (!object) {
            return;
        }

        [object.x, object.y, object.z] = position;
    }

    delete(id: string): boolean {
        return this.objects.delete(id);
    }

    has(id: string): boolean {
        return this.objects.has(id);
    }

    clear(): void {
        this.objects.clear();
    }

    values(): IterableIterator<StoredObject> {
        return this.objects.values();
    }

    entries(): IterableIterator<[string, StoredObject]> {
        return this.objects.entries();
    }
}