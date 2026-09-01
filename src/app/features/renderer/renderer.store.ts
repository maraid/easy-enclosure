
import { Geom3 } from '@jscad/modeling/src/geometries/types';

import { Feature } from '../../core/enclosure/feature';
import { Surface } from '../../core/enclosure';


export class FeatureStore {
    private objects = new Map<string, Feature>();

    set(feature: Feature): void {
        if (feature.id)
            this.objects.set(feature.id, feature);
    }

    get(id: string): Feature | undefined {
        return this.objects.get(id);
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

    values(): IterableIterator<Feature> {
        return this.objects.values();
    }

    entries(): IterableIterator<[string, Feature]> {
        return this.objects.entries();
    }
}

export class MoveableFeatureStore {
    private objects = new Map<string, Feature>();

    set(feature: Feature): void {
        if (feature.id)
            this.objects.set(feature.id, feature);
    }

    get(id: string): Feature | undefined {
        return this.objects.get(id);
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

    values(): IterableIterator<Feature> {
        return this.objects.values();
    }

    entries(): IterableIterator<[string, Feature]> {
        return this.objects.entries();
    }
}

class StaticFeatureStore {
    private objects = new Map<string, Feature>();

    set(feature: Feature): void {
        if (feature.id)
            this.objects.set(feature.id, feature);
    }

    get(id: string): Feature | undefined {
        return this.objects.get(id);
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

    values(): IterableIterator<Feature> {
        return this.objects.values();
    }

    entries(): IterableIterator<[string, Feature]> {
        return this.objects.entries();
    }
}