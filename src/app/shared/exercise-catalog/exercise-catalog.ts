import { Component, computed, debounced, effect, inject, input, output, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';

import type { Exercise, ExerciseType } from '../../core/domain/models';
import { CatalogService, type CatalogFilter } from '../../core/catalog/catalog.service';

@Component({
  selector: 'app-exercise-catalog',
  standalone: true,
  imports: [FormField],
  templateUrl: './exercise-catalog.html',
  styleUrl: './exercise-catalog.scss',
})
export class ExerciseCatalogComponent {
  private readonly catalogService = inject(CatalogService);

  readonly label = input('Catálogo de ejercicios');
  readonly filterMode = input<'minimal' | 'full' | 'none'>('minimal');
  readonly selectedExerciseIds = input<Set<string>>(new Set());
  readonly exerciseAdded = output<Exercise>();

  protected readonly showFilters = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly exercises = signal<Exercise[]>([]);

  protected readonly filterModel = signal({ query: '', typeFilter: '', muscleGroup: '', equipment: '' });
  protected readonly filterForm = form(this.filterModel);
  protected readonly debouncedFilterModel = debounced(this.filterModel, 500);

  protected readonly filtered = computed(() => {
    const data = this.exercises();
    const { query, typeFilter, muscleGroup, equipment } = this.debouncedFilterModel.value();

    return data.filter((e) => {
      if (typeFilter && e.type !== typeFilter) return false;
      if (muscleGroup && !e.muscleGroups.some((g) => g.toLowerCase().includes(muscleGroup.toLowerCase()))) return false;
      if (equipment && !(e.equipment ?? '').toLowerCase().includes(equipment.toLowerCase())) return false;
      if (query) {
        const haystack = [e.name, e.equipment ?? '', ...e.muscleGroups].join(' ').toLowerCase();
        if (!haystack.includes(query.trim().toLowerCase())) return false;
      }
      return true;
    });
  });

  constructor() {
    effect(() => {
      const { typeFilter } = this.debouncedFilterModel.value();
      this.load({ type: (typeFilter || undefined) as ExerciseType | undefined });
    });
  }

  protected toggleFilters(): void {
    this.showFilters.update((value) => !value);
  }

  protected clearField(field: 'query' | 'typeFilter' | 'muscleGroup' | 'equipment'): void {
    this.filterModel.update((m) => ({ ...m, [field]: '' }));
  }

  protected add(exercise: Exercise): void {
    if (this.selectedExerciseIds().has(exercise.id)) return;
    this.exerciseAdded.emit(exercise);
  }

  protected refresh(): void {
    const { typeFilter } = this.filterModel();
    this.load({ type: (typeFilter || undefined) as ExerciseType | undefined });
  }

  private load(filter: CatalogFilter = {}): void {
    this.loading.set(true);
    this.error.set(null);

    this.catalogService.listExercises(filter).subscribe({
      next: (exercises) => {
        this.exercises.set(exercises);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(this.toMessage(err, 'No se pudo cargar el catálogo.'));
        this.loading.set(false);
      },
    });
  }

  private toMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
  }
}
