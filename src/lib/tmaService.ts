// Service for Telegram Mini App data storage, drafts and sync

import { supabase } from '@/lib/supabase';

export interface FlightEntryDraft {
  id: string;
  boardNumber: string;
  date: string; // YYYY-MM-DD
  crew: string;
  launches: LaunchDraft[];
  snk?: SnkDraft;
  oilAddedLiters?: number;
  notes?: string;
  createdAt: number;
}

export interface SnkDraft {
  aLeft?: number;
  bLeft?: number;
  eLeft?: number;
  gLeft?: number;
  hLeft?: number;
  iLeft?: number;
  aRight?: number;
  bRight?: number;
  eRight?: number;
  gRight?: number;
  hRight?: number;
  iRight?: number;
}

export interface LaunchDraft {
  id: string;
  vsu: number; // minutes
  zemlya: number; // minutes
  vozduh: number; // minutes
  tp: number; // minutes (турбопривод)
  samoletLandings: number; // count
  fuelingLiters?: number;
  fuelDensity?: number;
  fuelStatement?: string;
}

export interface CloudAggregateResource {
  name?: string;
  sne?: number;
  extendedTo1?: number;
  yearsResource?: string;
  issueDate?: string;
  extendedTo2?: string;
  remaining1?: number;
  remaining2?: string;
  emptyFields?: string[];
}

export interface CloudOilResource {
  name?: string;
  byHours?: number;
  byYears?: string;
  coefficient?: number;
  term?: string;
  emptyFields?: string[];
}

export interface CloudMaintenanceWork {
  id?: string;
  kind?: string;
  date?: string;
  counterMinutes?: number;
  description?: string;
  createdAt?: number;
}

export interface CloudProfileData {
  id: string;
  name: string;
  boardNumber: string;
  fuselageSne: number;
  resourcesUpdatedAt: number;
  aggregates: CloudAggregateResource[];
  oils: CloudOilResource[];
  maintenanceWorks: CloudMaintenanceWork[];
}

export interface ResourceSummary {
  name: string;
  assignedTo: string;
  sne: string; // СНЭ
  remainingHours: number;
  totalLimitHours: number;
  warningThresholdHours: number;
  status: 'normal' | 'warning' | 'critical';
}

export interface BoardProfileItem {
  id: string;
  name: string;
  boardNumber: string;
  aircraftType: 'ka52' | 'mi8' | 'mi28' | 'plane';
}

const STORAGE_KEY_PROFILES = 'logbook_tma_profiles';
const STORAGE_KEY_ACTIVE_BOARD = 'logbook_tma_active_board';
const STORAGE_KEY_FLIGHTS = 'logbook_tma_flights';
const STORAGE_KEY_RESOURCES = 'logbook_tma_resources';
const STORAGE_KEY_AUTH = 'logbook_tma_auth';

export const defaultBoards: BoardProfileItem[] = [
  { id: 'b-01', name: 'Ка-52 №01 Жёлтый', boardNumber: '01', aircraftType: 'ka52' },
  { id: 'b-02', name: 'Ка-52 №02 Жёлтый', boardNumber: '02', aircraftType: 'ka52' },
  { id: 'b-17', name: 'Ми-8АМТШ №17 Синий', boardNumber: '17', aircraftType: 'mi8' },
];

export const defaultSampleResources: Record<string, ResourceSummary[]> = {
  '01': [
    { name: 'Двигатель ВК-2500 №1 (левый)', assignedTo: 'Двигатель', sne: '412 ч 15 м', remainingHours: 87.75, totalLimitHours: 500, warningThresholdHours: 50, status: 'normal' },
    { name: 'Двигатель ВК-2500 №2 (правый)', assignedTo: 'Двигатель', sne: '468 ч 40 м', remainingHours: 31.33, totalLimitHours: 500, warningThresholdHours: 50, status: 'warning' },
    { name: 'Главный редуктор ВР-80', assignedTo: 'Трансмиссия', sne: '820 ч 10 м', remainingHours: 179.8, totalLimitHours: 1000, warningThresholdHours: 100, status: 'normal' },
    { name: 'Вспомогательная силовая установка ТА-14', assignedTo: 'ВСУ', sne: '185 ч 30 м', remainingHours: 14.5, totalLimitHours: 200, warningThresholdHours: 20, status: 'critical' },
    { name: 'Колонка несущих винтов', assignedTo: 'Винты', sne: '290 ч 00 м', remainingHours: 210.0, totalLimitHours: 500, warningThresholdHours: 50, status: 'normal' },
  ],
  '02': [
    { name: 'Двигатель ВК-2500 №1 (левый)', assignedTo: 'Двигатель', sne: '210 ч 00 м', remainingHours: 290.0, totalLimitHours: 500, warningThresholdHours: 50, status: 'normal' },
    { name: 'Двигатель ВК-2500 №2 (правый)', assignedTo: 'Двигатель', sne: '205 ч 20 м', remainingHours: 294.6, totalLimitHours: 500, warningThresholdHours: 50, status: 'normal' },
    { name: 'Главный редуктор ВР-80', assignedTo: 'Трансмиссия', sne: '410 ч 50 м', remainingHours: 589.1, totalLimitHours: 1000, warningThresholdHours: 100, status: 'normal' },
    { name: 'Вспомогательная силовая установка ТА-14', assignedTo: 'ВСУ', sne: '95 ч 10 м', remainingHours: 104.8, totalLimitHours: 200, warningThresholdHours: 20, status: 'normal' },
  ],
};

export const TelegramMiniAppService = {
  getBoards(): BoardProfileItem[] {
    const raw = localStorage.getItem(STORAGE_KEY_PROFILES);
    if (!raw) return defaultBoards;
    try {
      return JSON.parse(raw);
    } catch {
      return defaultBoards;
    }
  },

  getActiveBoard(): string {
    return localStorage.getItem(STORAGE_KEY_ACTIVE_BOARD) || '01';
  },

  setActiveBoard(boardNumber: string) {
    localStorage.setItem(STORAGE_KEY_ACTIVE_BOARD, boardNumber);
  },

  getFlights(boardNumber?: string): FlightEntryDraft[] {
    const raw = localStorage.getItem(STORAGE_KEY_FLIGHTS);
    if (!raw) return [];
    try {
      const all: FlightEntryDraft[] = JSON.parse(raw);
      if (boardNumber) {
        return all.filter((f) => f.boardNumber === boardNumber);
      }
      return all;
    } catch {
      return [];
    }
  },

  saveFlight(flight: FlightEntryDraft) {
    const all = this.getFlights();
    const existingIndex = all.findIndex((f) => f.id === flight.id);
    if (existingIndex >= 0) {
      all[existingIndex] = flight;
    } else {
      all.unshift(flight);
    }
    localStorage.setItem(STORAGE_KEY_FLIGHTS, JSON.stringify(all));
  },

  deleteFlight(flightId: string) {
    const all = this.getFlights().filter((f) => f.id !== flightId);
    localStorage.setItem(STORAGE_KEY_FLIGHTS, JSON.stringify(all));
  },

  getResources(boardNumber: string): ResourceSummary[] {
    const raw = localStorage.getItem(`${STORAGE_KEY_RESOURCES}_${boardNumber}`);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        // fallback
      }
    }
    return defaultSampleResources[boardNumber] || defaultSampleResources['01'];
  },

  saveResources(boardNumber: string, resources: ResourceSummary[]) {
    localStorage.setItem(`${STORAGE_KEY_RESOURCES}_${boardNumber}`, JSON.stringify(resources));
  },

  async getCloudProfiles(): Promise<CloudProfileData[]> {
    const { data, error } = await supabase.rpc('logbook_sync_pull_v1');
    if (error) throw new Error(error.message);

    const response = Array.isArray(data) ? data[0] : data;
    const payloadValue = response?.payload;
    if (!payloadValue) return [];
    const payload = typeof payloadValue === 'string' ? JSON.parse(payloadValue) : payloadValue;
    const rows = payload?.tables?.profiles;
    if (!Array.isArray(rows)) return [];

    const parseArray = <T>(value: unknown): T[] => {
      if (Array.isArray(value)) return value as T[];
      if (typeof value !== 'string' || !value.trim()) return [];
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed as T[] : [];
      } catch {
        return [];
      }
    };

    return rows.map((profile: Record<string, unknown>) => ({
      id: String(profile.id ?? ''),
      name: String(profile.name ?? 'Профиль'),
      boardNumber: String(profile.boardNumber ?? ''),
      fuselageSne: Number(profile.fuselageSne ?? 0),
      resourcesUpdatedAt: Number(profile.resourcesUpdatedAt ?? 0),
      aggregates: parseArray<CloudAggregateResource>(profile.resourcesJson),
      oils: parseArray<CloudOilResource>(profile.oilsJson),
      maintenanceWorks: parseArray<CloudMaintenanceWork>(profile.maintenanceWorksJson),
    }));
  },
};
