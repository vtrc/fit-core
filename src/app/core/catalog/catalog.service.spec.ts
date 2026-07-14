import { TestBed } from '@angular/core/testing';
import { describe, beforeEach, expect, it, vi } from 'vitest';
import { firstValueFrom } from 'rxjs';

import { InsforgeClientService } from '../insforge/insforge-client';
import { CatalogService, type CatalogFilter } from './catalog.service';

describe('CatalogService', () => {
  const select = vi.fn();
  const eq = vi.fn();
  const contains = vi.fn();
  const order = vi.fn();
  const from = vi.fn();

  beforeEach(() => {
    select.mockReset();
    eq.mockReset();
    contains.mockReset();
    order.mockReset();
    from.mockReset();

    const builder = { select, eq, contains, order };
    from.mockReturnValue(builder);
    select.mockReturnValue(builder);
    eq.mockReturnValue(builder);
    contains.mockReturnValue(builder);
    order.mockResolvedValue({ data: [], error: null });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        CatalogService,
        {
          provide: InsforgeClientService,
          useValue: {
            client: {
              database: {
                from,
              },
            },
          },
        },
      ],
    });
  });

  it('maps snake_case exercise rows into the Exercise domain model', async () => {
    order.mockResolvedValueOnce({
      data: [
        {
          id: 'exercise-1',
          name: 'Leg Press',
          type: 'strength',
          equipment: 'máquina',
          image_url: '/catalog-images/leg-press.webp',
          muscle_groups: ['cuádriceps', 'glutes'],
          supported_metrics: ['weight', 'repetitions'],
          created_at: '2026-07-14T08:00:00.000Z',
          updated_at: '2026-07-14T09:00:00.000Z',
        },
      ],
      error: null,
    });

    const service = TestBed.inject(CatalogService);
    const exercises = await firstValueFrom(service.listExercises({}));

    expect(from).toHaveBeenCalledWith('exercises');
    expect(exercises).toEqual([
      {
        id: 'exercise-1',
        name: 'Leg Press',
        type: 'strength',
        equipment: 'máquina',
        imageUrl: '/catalog-images/leg-press.webp',
        muscleGroups: ['cuádriceps', 'glutes'],
        supportedMetrics: ['weight', 'repetitions'],
        createdAt: '2026-07-14T08:00:00.000Z',
        updatedAt: '2026-07-14T09:00:00.000Z',
      },
    ]);
  });

  it('combines type, muscle group, and equipment filters in the database query', async () => {
    const filter: CatalogFilter = {
      type: 'strength',
      muscleGroup: 'cuádriceps',
      equipment: 'máquina',
    };

    const service = TestBed.inject(CatalogService);
    await firstValueFrom(service.listExercises(filter));

    expect(eq).toHaveBeenCalledWith('type', 'strength');
    expect(contains).toHaveBeenCalledWith('muscle_groups', ['cuádriceps']);
    expect(eq).toHaveBeenCalledWith('equipment', 'máquina');
    expect(order).toHaveBeenCalledWith('name', { ascending: true });
  });

  it('prefers the explicit máquina filter when present', async () => {
    const filter: CatalogFilter = {
      equipment: 'free-weight',
      máquina: 'leg-press',
    };

    const service = TestBed.inject(CatalogService);
    await firstValueFrom(service.listExercises(filter));

    expect(eq).toHaveBeenCalledWith('equipment', 'leg-press');
  });
});
