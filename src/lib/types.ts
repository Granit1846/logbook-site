export interface FeatureRow {
  id: string;
  icon_name: string;
  title: string;
  description: string;
  sort_order: number;
}

export interface RoadmapRow {
  id: string;
  version: string;
  date_text: string;
  title: string;
  description: string;
  status: 'done' | 'in-progress' | 'planned';
  sort_order: number;
}

export interface FaqRow {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
}

export interface ScreenshotRow {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  category?: 'desktop' | 'android';
  color?: string;
  sort_order: number;
}

export interface ReleaseRow {
  id: string;
  version: string;
  date_text: string;
  size_text: string;
  is_latest: boolean;
  sort_order: number;
}

export interface FlightRow {
  id: string;
  flight_date: string;
  aircraft: string;
  crew: string | null;
  startups: number;
  flight_time: number;
  ground_time: number;
  landings: number;
  fuel_remaining: number | null;
  fuel_added: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ComponentType = 'engine' | 'gearbox' | 'apu' | 'oil' | 'airframe';

export interface ResourceRow {
  id: string;
  aircraft: string;
  component_name: string;
  component_type: ComponentType;
  total_resource_hours: number | null;
  used_hours: number;
  remaining_hours: number | null;
  total_resource_calendar_months: number | null;
  installed_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type FileType = 'sync' | 'backup';

export interface FileRecord {
  id: string;
  file_name: string;
  storage_path: string;
  file_type: FileType;
  file_size: number;
  mime_type: string;
  description: string | null;
  device_id: string | null;
  created_at: string;
  updated_at: string;
}
