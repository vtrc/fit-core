import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';

import type { Exercise } from '../../core/domain/models';
import { CatalogService, type CatalogFilter } from '../../core/catalog/catalog.service';

@Component({
  selector: 'app-exercise-catalog',
  standalone: true,
  imports: [FormField],
  template: `
    <aside class="catalog">
      <header class="catalog-head">
        <h2>{{ label() }}</h2>
        <div class="head-actions">
          <button class="btn btn-ghost" type="button" (click)="refresh()">Actualizar</button>
          @if (filterMode() !== 'none') {
            <button class="btn btn-ghost" type="button" (click)="toggleFilters()">
              {{ showFilters() ? 'Ocultar filtros' : 'Mostrar filtros' }}
            </button>
          }
        </div>
      </header>

      @if (showFilters() && filterMode() !== 'none') {
        <div class="filter-panel">
          <div class="filter-row">
            <div class="search-wrap">
              <span class="search-icon">⌕</span>
              <input type="text" [formField]="filterForm.query" placeholder="Buscar ejercicio…" class="search-input" />
            </div>
          </div>
          <div class="filter-row filter-chips">
            <div class="chip-field">
              <select [formField]="filterForm.typeFilter" class="chip-select">
                <option value="">Todos</option>
                <option value="strength">Fuerza</option>
                <option value="cardio">Cardio</option>
              </select>
            </div>
            @if (filterMode() === 'full') {
              <div class="chip-field">
                <input type="text" [formField]="filterForm.muscleGroup" placeholder="Grupo muscular" class="chip-input" />
              </div>
              <div class="chip-field">
                <input type="text" [formField]="filterForm.equipment" placeholder="Equipamiento" class="chip-input" />
              </div>
            }
          </div>
        </div>
      }

      @if (loading()) {
        <div class="loading-state">
          <div class="spinner"></div>
          <span>Cargando catálogo…</span>
        </div>
      } @else if (error(); as err) {
        <div class="error-state">
          <p>{{ err }}</p>
        </div>
      } @else {
        <div class="catalog-list">
          @for (exercise of filtered(); track exercise.id) {
            <article
              class="exercise-row"
              [class.selected]="selectedExerciseIds().has(exercise.id)"
              (click)="add(exercise)"
              role="option"
              tabindex="0"
              (keydown.enter)="add(exercise)"
              (keydown.space)="add(exercise); $event.preventDefault()"
              [attr.aria-selected]="selectedExerciseIds().has(exercise.id)"
            >
              <div class="exercise-thumb">
                @if (exercise.imageUrl) {
                  <img [src]="exercise.imageUrl" [alt]="exercise.name" />
                } @else {
                  <span>{{ exercise.type === 'strength' ? 'F' : 'C' }}</span>
                }
              </div>
              <div class="exercise-info">
                <span class="exercise-type">{{ exercise.type === 'strength' ? 'Fuerza' : 'Cardio' }}</span>
                <h3>{{ exercise.name }}</h3>
                <span class="exercise-meta">{{ exercise.equipment || 'Equipamiento general' }}</span>
              </div>
              <div class="card-check" aria-hidden="true">{{ selectedExerciseIds().has(exercise.id) ? '✓' : '' }}</div>
            </article>
          } @empty {
            <div class="empty-state">
              <p>Ningún ejercicio coincide con estos filtros.</p>
            </div>
          }
        </div>
      }
    </aside>
  `,
  styles: `
    :host { display: block; }
    .catalog { width: 100%; box-sizing: border-box; background: #fffdf8; border: 1px solid #e3dacb; border-radius: 1rem; padding: .9rem; }

    .catalog-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: .6rem; }
    .catalog-head h2 { margin: 0; font-size: 1rem; font-weight: 700; color: #1f3028; }
    .head-actions { display: flex; gap: .25rem; }

    .btn { min-height: 2.75rem; padding: .45rem .7rem; border: 0; border-radius: .55rem; font: inherit; font-size: .78rem; cursor: pointer; transition: background .12s; }
    .btn-ghost { background: transparent; color: #617064; }
    .btn-ghost:hover { background: #e8dfd0; }

    .filter-panel { display: grid; gap: .5rem; margin-bottom: .75rem; animation: slideIn .15s ease-out; }
    @keyframes slideIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }

    .filter-row { display: flex; gap: .5rem; }
    .search-wrap { flex: 1; position: relative; }
    .search-icon { position: absolute; left: .75rem; top: 50%; transform: translateY(-50%); color: #a4b0a6; font-size: .95rem; pointer-events: none; }
    .search-input { width: 100%; padding: .55rem .75rem .55rem 2rem; border: 1px solid #d7ccb7; border-radius: .65rem; font: inherit; font-size: .9rem; background: #fff; outline: none; transition: border-color .15s; }
    .search-input:focus { border-color: #1f3028; }

    .filter-chips { flex-wrap: wrap; }
    .chip-field { flex: 0 1 auto; min-width: 7rem; }
    .chip-select, .chip-input { width: 100%; padding: .35rem .6rem; border: 1px solid #d7ccb7; border-radius: .5rem; font: inherit; font-size: .8rem; background: #fff; outline: none; transition: border-color .15s; cursor: pointer; }
    .chip-select:focus, .chip-input:focus { border-color: #1f3028; }

    .loading-state { display: flex; align-items: center; gap: .6rem; padding: 1.5rem; color: #617064; font-size: .9rem; justify-content: center; }
    .spinner { width: 1.2rem; height: 1.2rem; border: 2px solid #d7ccb7; border-top-color: #1f3028; border-radius: 50%; animation: spin .6s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .error-state { padding: 1rem; color: #9d2f2f; font-size: .9rem; background: #fce9e6; border-radius: .75rem; }

    .catalog-list { display: grid; gap: .45rem; }
    .exercise-row { display: grid; grid-template-columns: 3.5rem minmax(0, 1fr) 2.75rem; gap: .7rem; align-items: center; min-height: 4.5rem; padding: .45rem; border: 1px solid #e8dfd0; border-radius: .7rem; background: #fff; cursor: pointer; transition: background .12s, border-color .12s; }
    .exercise-row:hover, .exercise-row:focus-visible { border-color: #b8a98f; outline: none; }
    .exercise-row.selected { border-color: #1f3028; background: #f2f8f3; }
    .exercise-thumb { width: 3.5rem; height: 3.5rem; overflow: hidden; display: grid; place-items: center; border-radius: .55rem; background: #f5f1e8; color: #a44a2c; font-weight: 800; }
    .exercise-thumb img { width: 100%; height: 100%; object-fit: cover; }
    .exercise-info { min-width: 0; display: grid; gap: .08rem; }
    .exercise-type { color: #a44a2c; font-size: .64rem; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
    .exercise-info h3 { overflow: hidden; margin: 0; color: #1f3028; font-size: .9rem; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }
    .exercise-meta { overflow: hidden; color: #617064; font-size: .76rem; text-overflow: ellipsis; white-space: nowrap; }
    .card-check { width: 2rem; height: 2rem; display: grid; place-items: center; border: 2px solid #c8bca7; border-radius: 50%; color: #fff; font-size: .85rem; font-weight: 800; }
    .exercise-row.selected .card-check { border-color: #1f3028; background: #1f3028; }

    .empty-state { padding: 1.2rem; text-align: center; color: #617064; font-size: .85rem; }
  `,
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

  protected readonly filtered = computed(() => {
    const data = this.exercises();
    const { query, typeFilter, muscleGroup, equipment } = this.filterModel();

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
    this.load();

    effect(() => {
      const filters = this.filterModel();
      void filters;
      this.load();
    });
  }

  protected toggleFilters(): void {
    this.showFilters.update((value) => !value);
  }

  protected add(exercise: Exercise): void {
    if (this.selectedExerciseIds().has(exercise.id)) return;
    this.exerciseAdded.emit(exercise);
  }

  protected refresh(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);

    const filters: CatalogFilter = {};

    if (this.filterModel().typeFilter) {
      filters.type = this.filterModel().typeFilter as 'strength' | 'cardio';
    }

    const mg = this.filterModel().muscleGroup.trim();
    if (mg) filters.muscleGroup = mg;

    const eq = this.filterModel().equipment.trim();
    if (eq) filters.equipment = eq;

    this.catalogService.listExercises(filters).subscribe({
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
