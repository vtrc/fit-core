import { Injectable } from '@angular/core';
import { createClient, type InsForgeClient } from '@insforge/sdk';

import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class InsforgeClientService {
  readonly client: InsForgeClient = createClient({
    baseUrl: environment.insforgeUrl,
    anonKey: environment.insforgeAnonKey,
  });
}
