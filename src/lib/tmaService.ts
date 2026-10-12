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

  async submitFlightToCloud(flight: FlightEntryDraft): Promise<{ revision: number }> {
    const sessionRes = await supabase.auth.getSession();
    const user = sessionRes?.data?.session?.user;
    if (!user) {
      throw new Error('Не выполнен вход в аккаунт! Нажмите шестерёнку (Настройки) сверху и войдите в свой аккаунт LogBook.');
    }

    const { data, error } = await supabase.rpc('logbook_sync_pull_v1');
    if (error) {
      throw new Error(`Ошибка загрузки данных из облака: ${error.message}`);
    }

    const response = Array.isArray(data) ? data[0] : data;
    const currentRevision = Number(response?.revision ?? 0);
    const payloadValue = response?.payload;

    if (!payloadValue) {
      throw new Error('В облаке пока нет профилей борта. Сначала выполните синхронизацию в основном приложении LogBook (Android или Windows).');
    }

    const exchange = typeof payloadValue === 'string' ? JSON.parse(payloadValue) : payloadValue;
    if (!exchange?.tables || typeof exchange.tables !== 'object') {
      throw new Error('Некорректный формат синхронизации в облаке');
    }

    if (!Array.isArray(exchange.tables.profiles)) exchange.tables.profiles = [];
    if (!Array.isArray(exchange.tables.days)) exchange.tables.days = [];
    if (!Array.isArray(exchange.tables.launches)) exchange.tables.launches = [];
    if (!Array.isArray(exchange.tables.snk_values)) exchange.tables.snk_values = [];

    const targetProfile = exchange.tables.profiles.find((p: any) => String(p.boardNumber) === String(flight.boardNumber));
    if (!targetProfile) {
      throw new Error(`Профиль борта №${flight.boardNumber} не найден в синхронизации LogBook. Убедитесь, что борт есть в основном приложении.`);
    }

    // Образец существующих записей для получения точной схемы таблицы
    const existingDay = exchange.tables.days[0];
    const existingLaunch = exchange.tables.launches[0];

    // Форматируем дату в DD.MM.YYYY если пришла YYYY-MM-DD
    let formattedDate = flight.date;
    if (/^\d{4}-\d{2}-\d{2}$/.test(formattedDate)) {
      const [yyyy, mm, dd] = formattedDate.split('-');
      formattedDate = `${dd}.${mm}.${yyyy}`;
    }

    // Проверяем, существует ли уже запись для этого дня (по profileId и date)
    let dayRecord = exchange.tables.days.find(
      (d: any) => String(d.profileId) === String(targetProfile.id) && String(d.date) === String(formattedDate),
    );

    let dayId: string;
    if (dayRecord) {
      dayId = dayRecord.id;
      if (flight.crew) {
        dayRecord.crew = String(flight.crew).trim();
      }
    } else {
      dayId = crypto.randomUUID();
      dayRecord = {
        id: dayId,
        profileId: targetProfile.id,
        date: formattedDate,
        crew: flight.crew ? String(flight.crew).trim() : '',
        isClosed: 0,
        createdAt: Date.now(),
      };
      exchange.tables.days.push(dayRecord);
    }

    // Существующие запуски этого дня
    const currentDayLaunches = exchange.tables.launches.filter((l: any) => String(l.dayId) === String(dayId));
    let nextOrder = currentDayLaunches.length > 0
      ? Math.max(...currentDayLaunches.map((l: any) => Number(l.order || 0))) + 1
      : 0;

    let addedAirMinutes = 0;
    flight.launches.forEach((launch) => {
      const air = Number(launch.vozduh || 0);
      addedAirMinutes += air;
      const liters = Number(launch.fuelingLiters || 0);
      const density = Number(launch.fuelDensity || 0);
      const kg = liters > 0 && density > 0 ? Number((liters * density).toFixed(2)) : 0;

      const launchRecord: Record<string, any> = {
        id: crypto.randomUUID(),
        dayId: dayId,
        order: nextOrder++,
        vsu: Number(launch.vsu || 0),
        zemlya: Number(launch.zemlya || 0),
        vozduh: air,
        tp: Number(launch.tp || 0),
        samolet: Number(launch.samoletLandings || 0),
        zapravkaLiters: liters,
        zapravkaDensity: density,
        zapravkaKg: kg,
        vedCek: String(launch.fuelStatement || ''),
      };

      if (existingLaunch) {
        for (const k of Object.keys(existingLaunch)) {
          if (!(k in launchRecord)) {
            launchRecord[k] = typeof existingLaunch[k] === 'number' ? 0 : '';
          }
        }
        for (const k of Object.keys(launchRecord)) {
          if (!(k in existingLaunch)) {
            delete launchRecord[k];
          }
        }
      }

      exchange.tables.launches.push(launchRecord);
    });

    // Обновляем СНК (перезаписываем или добавляем)
    if (flight.snk && Object.keys(flight.snk).length > 0) {
      exchange.tables.snk_values = exchange.tables.snk_values.filter((s: any) => String(s.dayId) !== String(dayId));
      exchange.tables.snk_values.push({
        id: crypto.randomUUID(),
        dayId: dayId,
        aLeft: Number(flight.snk.aLeft || 0),
        bLeft: Number(flight.snk.bLeft || 0),
        eLeft: Number(flight.snk.eLeft || 0),
        gLeft: Number(flight.snk.gLeft || 0),
        hLeft: Number(flight.snk.hLeft || 0),
        iLeft: Number(flight.snk.iLeft || 0),
        aRight: Number(flight.snk.aRight || 0),
        bRight: Number(flight.snk.bRight || 0),
        eRight: Number(flight.snk.eRight || 0),
        gRight: Number(flight.snk.gRight || 0),
        hRight: Number(flight.snk.hRight || 0),
        iRight: Number(flight.snk.iRight || 0),
      });
    }

    // Определяем базовый СНЭ фюзеляжа
    let baseSne = Number(targetProfile.fuselageSne || 0);
    if (!baseSne && Array.isArray(exchange.tables.chast1_records)) {
      const pRecords = exchange.tables.chast1_records
        .filter((r: any) => String(r.profileId) === String(targetProfile.id) && !r.isTotal && Number(r.colSNE || 0) > 0)
        .sort((a: any, b: any) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
      if (pRecords.length > 0) {
        baseSne = Number(pRecords[pRecords.length - 1].colSNE || 0);
      } else if (Array.isArray(exchange.tables.chast1_start)) {
        const startRec = exchange.tables.chast1_start.find((r: any) => String(r.profileId) === String(targetProfile.id));
        if (startRec) {
          baseSne = Number(startRec.colSNE || 0);
        }
      }
    }

    const newFuselageSne = baseSne + addedAirMinutes;
    targetProfile.fuselageSne = newFuselageSne;

    // Пересчитываем СНЭ и остатки агрегатов в resourcesJson
    let resources: any[] = [];
    if (typeof targetProfile.resourcesJson === 'string') {
      try {
        resources = JSON.parse(targetProfile.resourcesJson);
      } catch {
        resources = [];
      }
    } else if (Array.isArray(targetProfile.resourcesJson)) {
      resources = targetProfile.resourcesJson;
    }

    if (Array.isArray(resources) && resources.length > 0) {
      const updatedResources = resources.map((item: any, idx: number) => {
        const isFuselage = item.name === 'Фюзеляж' || idx === 0;
        const inst1 = Number(item.installedAtSne1 || 0);
        const inst2 = Number(item.installedAtSne2 || 0);

        // Для фюзеляжа — СНЭ равен налёту планера.
        // Для остальных агрегатов:
        // Если агрегат установлен с наработками: currentSne = newFuselageSne - inst1 + inst2
        // Иначе: СНЭ агрегата увеличивается на налёт addedAirMinutes
        let currentSne: number;
        if (isFuselage) {
          currentSne = newFuselageSne;
        } else if (inst1 > 0 || inst2 > 0) {
          currentSne = Math.max(0, newFuselageSne - inst1 + inst2);
        } else {
          const prevSne = Number(item.sne || 0);
          currentSne = prevSne > 0 ? prevSne + addedAirMinutes : newFuselageSne;
        }

        // Назначенный ресурс в минутах (extendedTo1)
        const rawLimit = Number(item.extendedTo1 || 0);
        const hasHourLimit = rawLimit > 0;
        const remaining1 = hasHourLimit ? rawLimit - currentSne : 0;

        let emptyFields: string[] = Array.isArray(item.emptyFields) ? [...item.emptyFields] : [];
        if (currentSne > 0) {
          emptyFields = emptyFields.filter((f) => f !== 'sne');
        }
        if (hasHourLimit) {
          emptyFields = emptyFields.filter((f) => f !== 'remaining1');
        }

        return {
          ...item,
          sne: currentSne,
          remaining1: remaining1,
          emptyFields: emptyFields,
        };
      });

      targetProfile.resourcesJson = JSON.stringify(updatedResources);
    }

    targetProfile.resourcesUpdatedAt = Date.now();
    targetProfile.updatedAt = Date.now();

    const changeId = crypto.randomUUID();
    const { data: commitData, error: commitError } = await supabase.rpc('logbook_sync_commit_v1', {
      p_change_id: changeId,
      p_expected_revision: currentRevision,
      p_payload: exchange,
    });

    if (commitError) {
      throw new Error(`Ошибка отправки в облако: ${commitError.message}`);
    }

    const reply = Array.isArray(commitData) ? commitData[0] : commitData;
    if (!reply?.accepted) {
      throw new Error('Конфликт синхронизации. Обновите данные и повторите отправку.');
    }

    this.saveFlight(flight);

    return { revision: Number(reply.revision) };
  },

  async clearCloudDays(): Promise<{ revision: number }> {
    const sessionRes = await supabase.auth.getSession();
    const user = sessionRes?.data?.session?.user;
    if (!user) {
      throw new Error('Не выполнен вход в аккаунт!');
    }

    const { data, error } = await supabase.rpc('logbook_sync_pull_v1');
    if (error) throw new Error(error.message);

    const response = Array.isArray(data) ? data[0] : data;
    const currentRevision = Number(response?.revision ?? 0);
    const payloadValue = response?.payload;
    if (!payloadValue) throw new Error('В облаке нет данных');

    const exchange = typeof payloadValue === 'string' ? JSON.parse(payloadValue) : payloadValue;
    if (!exchange?.tables) throw new Error('Некорректный формат');

    // Очищаем таблицы полётов за дни
    exchange.tables.days = [];
    exchange.tables.launches = [];
    exchange.tables.snk_values = [];

    const changeId = crypto.randomUUID();
    const { data: commitData, error: commitError } = await supabase.rpc('logbook_sync_commit_v1', {
      p_change_id: changeId,
      p_expected_revision: currentRevision,
      p_payload: exchange,
    });

    if (commitError) throw new Error(commitError.message);
    const reply = Array.isArray(commitData) ? commitData[0] : commitData;
    if (!reply?.accepted) throw new Error('Конфликт синхронизации. Попробуйте еще раз.');

    return { revision: Number(reply.revision) };
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
