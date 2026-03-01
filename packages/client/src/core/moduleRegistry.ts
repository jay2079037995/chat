import type { ClientModule } from './types';
import { authModule } from '../modules/auth';
import { homeModule } from '../modules/home';

export const modules: ClientModule[] = [authModule, homeModule];
