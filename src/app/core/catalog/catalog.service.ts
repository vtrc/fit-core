import { Injectable } from '@angular/core';
import { from, map, Observable } from 'rxjs';

import type { Exercise, ExerciseType } from '../domain/models';
import { InsforgeClientService } from '../insforge/insforge-client';

export interface CatalogFilter {
  type?: ExerciseType;
  muscleGroup?: string;
  equipment?: string;
  máquina?: string;
  query?: string;
}

interface ExerciseRow {
  id: string;
  name: string;
  type: ExerciseType;
  equipment: string | null;
  image_url: string | null;
  muscle_groups: string[] | null;
  supported_metrics: string[] | null;
  created_at: string;
  updated_at: string;
}

@Injectable({ providedIn: 'root' })
export class CatalogService {
  constructor(private readonly insforge: InsforgeClientService) { }

  listExercises(filter: CatalogFilter): Observable<Exercise[]> {
    const query = this.insforge.client.database
      .from('exercises')
      .select('id, name, type, equipment, image_url, muscle_groups, supported_metrics, created_at, updated_at');

    if (filter.type) {
      query.ilike('type', filter.type);
    }

    if (filter.muscleGroup) {
      query.contains('muscle_groups', [filter.muscleGroup]);
    }

    const equipment = filter.máquina ?? filter.equipment;
    if (equipment) {
      query.ilike('equipment', equipment);
    }

    return from(query.order('name', { ascending: true })).pipe(
      map(({ data, error }) => {
        if (error) {
          throw error;
        }

        return (data ?? []).map((row) => this.mapExercise(row as ExerciseRow));
      }),
    );
  }

  private mapExercise(row: ExerciseRow): Exercise {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      equipment: row.equipment,
      imageUrl: row.image_url,
      muscleGroups: row.muscle_groups ?? [],
      supportedMetrics: row.supported_metrics ?? [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
