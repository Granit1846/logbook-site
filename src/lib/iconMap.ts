import {
  FileText,
  Calculator,
  Bell,
  Printer,
  Layers,
  History,
  Save,
  Moon,
  Power,
  Smartphone,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  FileText,
  Calculator,
  Bell,
  Printer,
  Layers,
  History,
  Save,
  Moon,
  Power,
  Smartphone,
  RefreshCw,
};

export function getIcon(name: string): LucideIcon {
  return iconMap[name] ?? FileText;
}

