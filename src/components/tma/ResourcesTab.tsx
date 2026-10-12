import React, { useState } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  ThumbsUp,
  Ban,
  Clock3,
  Calendar,
  Droplets,
  Gauge,
  NotebookText,
  RefreshCw,
  History,
  CheckCircle2,
} from 'lucide-react';
import type { CloudProfileData, CloudOilResource, CloudMaintenanceWork } from '@/lib/tmaService';

interface ResourcesTabProps {
  profile?: CloudProfileData;
  loading: boolean;
  error: string;
  onRefresh: () => void;
}

const cleanStringOrDash = (val?: string): string => {
  if (!val) return '—';
  const trimmed = val.trim();
  if (trimmed === '' || trimmed === '0' || trimmed === '0.0' || trimmed === '—' || trimmed === '-') {
    return '—';
  }
  return trimmed;
};

const formatMinutes = (value?: number | null): string => {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return '—';
  }
  const sign = value < 0 ? '−' : '';
  const absolute = Math.abs(Math.round(value));
  return `${sign}${Math.floor(absolute / 60)}:${String(absolute % 60).padStart(2, '0')}`;
};

const workKind: Record<string, string> = {
  PERIODIC: 'Периодические работы (20 дн.)',
  HOURS_50: '50-часовой регламент',
  HOURS_100: '100-часовой регламент',
  HOURS_300: '300-часовой регламент',
  REG_12: 'Регламент 12 месяцев',
  REG_24: 'Регламент 24 месяца',
  OTHER: 'Прочие технические работы',
};

interface DateCalcResult {
  issueDateStr: string;
  expiryDateStr: string;
  remainingStr: string;
  daysRemaining: number;
  status: 'normal' | 'warning' | 'critical' | 'expired';
}

function parseCustomDate(str?: string): Date | null {
  if (!str || typeof str !== 'string') return null;
  const trimmed = str.trim();
  if (!trimmed || trimmed === '0' || trimmed === '—' || trimmed === '-') return null;

  if (trimmed.includes('.')) {
    const parts = trimmed.split('.');
    if (parts.length >= 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      let year = parseInt(parts[2], 10);
      if (year < 100) {
        year += year >= 50 ? 1900 : 2000;
      }
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return new Date(year, month, day);
      }
    }
  }

  if (trimmed.includes('-')) {
    const parts = trimmed.split('-');
    if (parts.length >= 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return new Date(year, month, day);
      }
    }
  }

  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d;
}

function formatCustomDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

// Определение статуса по часам/минутам (отрицательное — ВСЕГДА expired)
function getMinutesStatus(
  remaining: number,
  limit?: number
): 'normal' | 'warning' | 'critical' | 'expired' {
  if (remaining < 0) {
    return 'expired';
  }
  if (remaining === 0 && (limit || 0) > 0) {
    return 'expired';
  }

  if (limit && limit > 0) {
    const percentRemaining = (remaining / limit) * 100;
    if (remaining <= 20 * 60 || percentRemaining <= 5) {
      return 'critical';
    }
    if (remaining <= 50 * 60 || percentRemaining <= 10) {
      return 'warning';
    }
    return 'normal';
  }

  if (remaining <= 20 * 60) {
    return 'critical';
  }
  if (remaining <= 50 * 60) {
    return 'warning';
  }
  return 'normal';
}

function calculateDates(
  issueDateRaw?: string,
  yearsResourceRaw?: string,
  extendedTo2Raw?: string
): DateCalcResult | null {
  const issue = parseCustomDate(issueDateRaw);
  if (!issue) return null;

  const yearsClean = cleanStringOrDash(yearsResourceRaw);
  const years = yearsClean !== '—' ? parseFloat(yearsClean.replace(',', '.')) : NaN;
  let expiry: Date | null = null;

  const extendedDate = parseCustomDate(extendedTo2Raw);
  if (extendedDate) {
    expiry = extendedDate;
  } else if (!isNaN(years) && years > 0) {
    expiry = new Date(issue.getFullYear() + Math.floor(years), issue.getMonth(), issue.getDate());
    const fractionalMonths = Math.round((years - Math.floor(years)) * 12);
    if (fractionalMonths > 0) {
      expiry.setMonth(expiry.getMonth() + fractionalMonths);
    }
  }

  if (!expiry) {
    return {
      issueDateStr: formatCustomDate(issue),
      expiryDateStr: '—',
      remainingStr: '—',
      daysRemaining: 99999,
      status: 'normal',
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiryNorm = new Date(expiry);
  expiryNorm.setHours(0, 0, 0, 0);

  const diffTime = expiryNorm.getTime() - today.getTime();
  const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let remainingStr = '';
  let status: 'normal' | 'warning' | 'critical' | 'expired' = 'normal';

  if (days < 0) {
    remainingStr = `Просрочено (${Math.abs(days)} дн.)`;
    status = 'expired';
  } else if (days === 0) {
    remainingStr = 'Истекает сегодня';
    status = 'critical';
  } else if (days < 100) {
    remainingStr = `${days} дн.`;
    status = days <= 30 ? 'critical' : 'warning';
  } else {
    let y = expiryNorm.getFullYear() - today.getFullYear();
    let m = expiryNorm.getMonth() - today.getMonth();
    if (expiryNorm.getDate() < today.getDate()) {
      m -= 1;
    }
    if (m < 0) {
      y -= 1;
      m += 12;
    }
    remainingStr = `${Math.max(0, y)}г. ${Math.max(0, m)}м.`;
    status = 'normal';
  }

  return {
    issueDateStr: formatCustomDate(issue),
    expiryDateStr: formatCustomDate(expiry),
    remainingStr,
    daysRemaining: days,
    status,
  };
}

const StatusIcon = ({ status }: { status: 'normal' | 'warning' | 'critical' | 'expired' }) => {
  switch (status) {
    case 'normal':
      return <ThumbsUp className="h-5 w-5 text-[#30D158]" title="Зеленый сектор — норма" />;
    case 'warning':
      return <AlertTriangle className="h-5 w-5 text-[#FFD60A]" title="Желтый сектор — внимание" />;
    case 'critical':
      return <AlertCircle className="h-5 w-5 text-[#FF453A]" title="Красный сектор — критический" />;
    case 'expired':
      return <Ban className="h-5 w-5 text-[#FF453A]" title="Просрочено" />;
  }
};

const TrafficLightBar = ({
  percent,
  status,
}: {
  percent: number;
  status: 'normal' | 'warning' | 'critical' | 'expired';
}) => {
  const clampedPercent = Math.max(0, Math.min(100, percent));
  const activeColor =
    status === 'expired' || status === 'critical'
      ? '#FF453A'
      : status === 'warning'
      ? '#FFD60A'
      : '#30D158';

  return (
    <div className="space-y-1">
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-[#1C1C1E]">
        {/* Фоновые секторы светофора */}
        <div className="absolute inset-0 flex opacity-20">
          <div className="w-[75%] bg-[#30D158]" />
          <div className="w-[15%] bg-[#FFD60A]" />
          <div className="w-[10%] bg-[#FF453A]" />
        </div>
        {/* Заполняющийся прогресс расхода ресурса */}
        <div
          className="relative h-full rounded-full transition-all duration-300"
          style={{
            width: `${status === 'expired' || clampedPercent >= 100 ? 100 : clampedPercent}%`,
            backgroundColor: activeColor,
            boxShadow: `0 0 6px ${activeColor}66`,
          }}
        />
      </div>
      <div className="flex justify-between px-0.5 text-[9px] text-[#666]">
        <span>0%</span>
        <span className="text-[#888]">
          {status === 'expired' ? '100%' : `${clampedPercent.toFixed(0)}%`}
        </span>
        <span className="text-[#FF453A]">100%</span>
      </div>
    </div>
  );
};

// ==========================================
// Карточка агрегата
// ==========================================
const AggregateCard: React.FC<{ item: CloudProfileData['aggregates'][0] }> = ({ item }) => {
  const [showDates, setShowDates] = useState(false);

  // СНЭ агрегата
  const sne = Number(item.sne || 0);

  // Назначенный ресурс (extendedTo1). Если не задан или <= 0 — ресурса в часах нет!
  const rawLimit = Number(item.extendedTo1 || 0);
  const hasHourLimit = rawLimit > 0;
  const limit = hasHourLimit ? rawLimit : 0;

  // Остаток вычисляется ТОЛЬКО если задан ресурс в часах!
  const remaining = hasHourLimit ? limit - sne : undefined;

  // Статус по часам
  let hourStatus: 'normal' | 'warning' | 'critical' | 'expired' = 'normal';
  if (hasHourLimit && remaining !== undefined) {
    hourStatus = getMinutesStatus(remaining, limit);
  }

  // Расчет дат (только если задана дата выпуска и срок)
  const hasIssueDate = !!(item.issueDate && cleanStringOrDash(item.issueDate) !== '—');
  const hasYears = !!(item.yearsResource && cleanStringOrDash(item.yearsResource) !== '—');
  const hasExtended2 = !!(item.extendedTo2 && cleanStringOrDash(item.extendedTo2) !== '—');

  const dateCalc = (hasIssueDate && (hasYears || hasExtended2))
    ? calculateDates(item.issueDate, item.yearsResource, item.extendedTo2)
    : null;

  const dateStatus = dateCalc ? dateCalc.status : 'normal';

  // Текущий статус карточки
  const currentStatus = showDates ? dateStatus : hourStatus;

  // Если один из параметров реально просрочен
  const isAnyExpired = (hasHourLimit && hourStatus === 'expired') || (dateCalc && dateStatus === 'expired');
  const effectiveStatus = isAnyExpired && currentStatus === 'normal' ? 'warning' : currentStatus;

  const statusColor =
    currentStatus === 'expired' || currentStatus === 'critical'
      ? '#FF453A'
      : currentStatus === 'warning'
      ? '#FFD60A'
      : '#30D158';

  const percentConsumed = hasHourLimit ? (sne / limit) * 100 : 0;

  return (
    <article className="space-y-3 rounded-2xl border border-[#3A3A3C] bg-[#2A2A2D] p-3.5 shadow-sm transition-colors">
      {/* Шапка: Кликабельное имя агрегата + статусная иконка */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setShowDates((prev) => !prev)}
          className="group flex flex-1 items-center gap-1.5 text-left transition-colors"
          title="Нажмите, чтобы переключить между часами и датами"
        >
          <span className="text-[14px] font-bold text-[#F0F0F0] group-hover:text-[#229ED9] transition-colors">
            {cleanStringOrDash(item.name) !== '—' ? item.name : 'Агрегат без названия'}
          </span>
          <span className="flex items-center gap-0.5 rounded-md bg-[#1C1C1E] px-1.5 py-0.5 text-[10px] font-medium text-[#888] group-hover:text-[#229ED9] transition-colors">
            {showDates ? <Calendar className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}
            <span>{showDates ? 'Даты' : 'Часы'}</span>
          </span>
        </button>
        <div className="shrink-0 flex items-center justify-center p-1 rounded-full bg-[#1C1C1E]/50">
          <StatusIcon status={effectiveStatus} />
        </div>
      </div>

      {/* Поля карточки: 2 поля сверху (СНЭ и Остаток), снизу 1 поле (Ресурс / Дата окончания) */}
      {!showDates ? (
        <div className="space-y-2">
          {/* Верхний ряд: 2 поля — СНЭ и Остаток */}
          <div className="grid grid-cols-2 gap-2">
            <Metric label="СНЭ" value={formatMinutes(sne)} />
            <Metric
              label="Остаток"
              value={remaining !== undefined ? formatMinutes(remaining) : '—'}
              color={remaining !== undefined && remaining < 0 ? '#FF453A' : statusColor}
            />
          </div>
          {/* Нижний ряд: Ресурс */}
          <Metric label="Ресурс" value={hasHourLimit ? formatMinutes(limit) : '—'} />
        </div>
      ) : (
        <div className="space-y-2">
          {/* Верхний ряд: 2 поля — Дата выпуска и Остаток */}
          <div className="grid grid-cols-2 gap-2">
            <Metric label="Дата выпуска" value={dateCalc?.issueDateStr || cleanStringOrDash(item.issueDate)} />
            <Metric
              label="Остаток"
              value={dateCalc?.remainingStr || '—'}
              color={dateCalc && dateCalc.daysRemaining < 0 ? '#FF453A' : statusColor}
            />
          </div>
          {/* Нижний ряд: Дата окончания */}
          <Metric
            label="Дата окончания"
            value={
              dateCalc?.expiryDateStr && dateCalc.expiryDateStr !== '—'
                ? dateCalc.expiryDateStr
                : cleanStringOrDash(item.yearsResource) !== '—'
                ? `Срок: ${cleanStringOrDash(item.yearsResource)} л.`
                : '—'
            }
          />
        </div>
      )}

      {/* Полоса светофора */}
      {hasHourLimit && (
        <TrafficLightBar
          percent={percentConsumed}
          status={hourStatus}
        />
      )}
    </article>
  );
};

// ==========================================
// Карточка масла (1 в 1 по аналогии с агрегатами)
// ==========================================
const OilCard: React.FC<{ item: CloudOilResource; fuselageSne: number }> = ({ item, fuselageSne }) => {
  const [showDates, setShowDates] = useState(false);

  const rawPoured = Number(item.byHours || 0);
  const hasPoured = rawPoured > 0;
  const pouredAtSne = hasPoured ? rawPoured : 0;

  const rawLimit = Number(item.coefficient || 0);
  const hasHourLimit = rawLimit > 0;
  const limit = hasHourLimit ? rawLimit : 0;

  // Наработка масла
  const used = Math.max(0, fuselageSne - pouredAtSne);

  // Остаток по маслу
  const remaining = hasHourLimit ? limit - used : undefined;

  let hourStatus: 'normal' | 'warning' | 'critical' | 'expired' = 'normal';
  if (hasHourLimit && remaining !== undefined) {
    hourStatus = getMinutesStatus(remaining, limit);
  }

  // Расчёт дат
  const hasYears = !!(item.byYears && cleanStringOrDash(item.byYears) !== '—');
  const hasTerm = !!(item.term && cleanStringOrDash(item.term) !== '—');

  const dateCalc = (hasYears && hasTerm)
    ? calculateDates(item.byYears, item.term)
    : null;

  const dateStatus = dateCalc ? dateCalc.status : 'normal';

  const currentStatus = showDates ? dateStatus : hourStatus;
  const isAnyExpired = (hasHourLimit && hourStatus === 'expired') || (dateCalc && dateStatus === 'expired');
  const effectiveStatus = isAnyExpired && currentStatus === 'normal' ? 'warning' : currentStatus;

  const statusColor =
    currentStatus === 'expired' || currentStatus === 'critical'
      ? '#FF453A'
      : currentStatus === 'warning'
      ? '#FFD60A'
      : '#30D158';

  const percentConsumed = hasHourLimit && limit > 0 ? (used / limit) * 100 : 0;

  return (
    <article className="space-y-3 rounded-2xl border border-[#3A3A3C] bg-[#2A2A2D] p-3.5 shadow-sm transition-colors">
      {/* Шапка: Кликабельное имя масла + статусная иконка */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setShowDates((prev) => !prev)}
          className="group flex flex-1 items-center gap-1.5 text-left transition-colors"
          title="Нажмите, чтобы переключить между часами и датами"
        >
          <Droplets className="h-4 w-4 shrink-0 text-[#229ED9] group-hover:scale-110 transition-transform" />
          <span className="text-[14px] font-bold text-[#F0F0F0] group-hover:text-[#229ED9] transition-colors">
            {cleanStringOrDash(item.name) !== '—' ? item.name : 'Масло без названия'}
          </span>
          <span className="flex items-center gap-0.5 rounded-md bg-[#1C1C1E] px-1.5 py-0.5 text-[10px] font-medium text-[#888] group-hover:text-[#229ED9] transition-colors">
            {showDates ? <Calendar className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}
            <span>{showDates ? 'Даты' : 'Часы'}</span>
          </span>
        </button>
        <div className="shrink-0 flex items-center justify-center p-1 rounded-full bg-[#1C1C1E]/50">
          <StatusIcon status={effectiveStatus} />
        </div>
      </div>

      {/* Поля карточки: 2 поля сверху (СНЭ наработки и Остаток), снизу 1 поле (Ресурс / Дата окончания) */}
      {!showDates ? (
        <div className="space-y-2">
          {/* Верхний ряд: 2 поля — СНЭ (наработка масла) и Остаток */}
          <div className="grid grid-cols-2 gap-2">
            <Metric label="СНЭ (наработка)" value={formatMinutes(used)} />
            <Metric
              label="Остаток"
              value={remaining !== undefined ? formatMinutes(remaining) : '—'}
              color={remaining !== undefined && remaining < 0 ? '#FF453A' : statusColor}
            />
          </div>
          {/* Нижний ряд: Ресурс */}
          <div className="relative">
            <Metric label="Ресурс" value={hasHourLimit ? formatMinutes(limit) : '—'} />
            {hasPoured && (
              <span className="absolute bottom-1 right-2.5 text-[9px] text-[#666]">
                залито при СНЭ {formatMinutes(pouredAtSne)}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Верхний ряд: 2 поля — Дата заливки и Остаток */}
          <div className="grid grid-cols-2 gap-2">
            <Metric label="Дата заливки" value={dateCalc?.issueDateStr || cleanStringOrDash(item.byYears)} />
            <Metric
              label="Остаток"
              value={dateCalc?.remainingStr || '—'}
              color={dateCalc && dateCalc.daysRemaining < 0 ? '#FF453A' : statusColor}
            />
          </div>
          {/* Нижний ряд: Дата окончания (Дата заливки + Срок) */}
          <Metric
            label="Дата окончания"
            value={
              dateCalc?.expiryDateStr && dateCalc.expiryDateStr !== '—'
                ? dateCalc.expiryDateStr
                : cleanStringOrDash(item.term) !== '—'
                ? `Срок: ${cleanStringOrDash(item.term)} г.`
                : '—'
            }
          />
        </div>
      )}

      {/* Полоса светофора */}
      {hasHourLimit && (
        <TrafficLightBar
          percent={percentConsumed}
          status={hourStatus}
        />
      )}
    </article>
  );
};

// ==========================================
// 1. ЧАСОВЫЕ РЕГЛАМЕНТЫ (50, 100, 300 часов)
// Измеряются строго в часах (чч:мм). По клику — даты выполнения.
// ==========================================
interface HourlyDef {
  kind: string;
  name: string;
  intervalHours: number;
}

const HourlyMaintenanceCard: React.FC<{
  def: HourlyDef;
  lastWork?: CloudMaintenanceWork;
  fuselageSne: number;
}> = ({ def, lastWork, fuselageSne }) => {
  const [showDates, setShowDates] = useState(false);
  const limitMinutes = def.intervalHours * 60;

  const hasLast = !!lastWork;
  const lastCounter = Number(lastWork?.counterMinutes || 0);

  // Наработка с момента выполнения ТО
  const usedHours = hasLast ? Math.max(0, fuselageSne - lastCounter) : undefined;
  const remainingHours = usedHours !== undefined ? limitMinutes - usedHours : undefined;

  const percentHours = limitMinutes > 0 && usedHours !== undefined
    ? (usedHours / limitMinutes) * 100
    : remainingHours !== undefined && remainingHours < 0
    ? 100
    : 0;

  const status = remainingHours !== undefined
    ? getMinutesStatus(remainingHours, limitMinutes)
    : hasLast
    ? 'normal'
    : 'warning';

  const statusColor =
    status === 'expired' || status === 'critical'
      ? '#FF453A'
      : status === 'warning'
      ? '#FFD60A'
      : '#30D158';

  const lastDate = cleanStringOrDash(lastWork?.date);

  return (
    <article className="space-y-3 rounded-2xl border border-[#3A3A3C] bg-[#2A2A2D] p-3.5 shadow-sm transition-colors">
      {/* Шапка */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setShowDates((prev) => !prev)}
          className="group flex flex-1 items-center gap-1.5 text-left transition-colors"
          title="Нажмите, чтобы переключить между часами и датой выполнения"
        >
          <Clock3 className="h-4 w-4 shrink-0 text-[#229ED9] group-hover:scale-110 transition-transform" />
          <span className="text-[14px] font-bold text-[#F0F0F0] group-hover:text-[#229ED9] transition-colors">
            {def.name}
          </span>
          <span className="flex items-center gap-0.5 rounded-md bg-[#1C1C1E] px-1.5 py-0.5 text-[10px] font-medium text-[#888] group-hover:text-[#229ED9] transition-colors">
            {showDates ? <Calendar className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}
            <span>{showDates ? 'Дата' : 'Часы'}</span>
          </span>
        </button>
        <div className="shrink-0 flex items-center justify-center p-1 rounded-full bg-[#1C1C1E]/50">
          <StatusIcon status={status} />
        </div>
      </div>

      {/* Поля в режиме ЧАСОВ (по умолчанию) */}
      {!showDates ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Metric
              label="Наработка с ТО"
              value={formatMinutes(usedHours)}
            />
            <Metric
              label="Остаток"
              value={hasLast ? formatMinutes(remainingHours) : 'Не выполнялось'}
              color={remainingHours !== undefined && remainingHours < 0 ? '#FF453A' : statusColor}
            />
          </div>
          <div className="relative">
            <Metric
              label="Интервал ТО"
              value={formatMinutes(limitMinutes)}
            />
            {hasLast && (
              <span className="absolute bottom-1 right-2.5 text-[9px] text-[#666]">
                след. ТО при СНЭ {formatMinutes(lastCounter + limitMinutes)}
              </span>
            )}
          </div>
        </div>
      ) : (
        /* Поля в режиме ДАТ (информация о выполнении) */
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Metric label="Дата выполнения" value={lastDate} />
            <Metric
              label="Выполнено при СНЭ"
              value={hasLast ? formatMinutes(lastCounter) : 'Не выполнялось'}
            />
          </div>
          <Metric
            label="Следующее ТО"
            value={hasLast ? `При наработке СНЭ ${formatMinutes(lastCounter + limitMinutes)}` : 'Не выполнялось'}
          />
        </div>
      )}

      {/* Полоса светофора */}
      {hasLast && (
        <TrafficLightBar
          percent={percentHours}
          status={status}
        />
      )}
    </article>
  );
};

// ==========================================
// 2. КАЛЕНДАРНЫЕ РЕГЛАМЕНТЫ (Периодический 20 дн., 12 мес., 24 мес.)
// Измеряются строго в календарных днях и датах. Никаких часов!
// ==========================================
interface CalendarDef {
  kind: string;
  name: string;
  nominalDays?: number;
  nominalMonths?: number;
}

const CalendarMaintenanceCard: React.FC<{
  def: CalendarDef;
  lastWork?: CloudMaintenanceWork;
}> = ({ def, lastWork }) => {
  const hasLast = !!lastWork && cleanStringOrDash(lastWork.date) !== '—';
  const baseDate = hasLast ? parseCustomDate(lastWork.date) : null;

  let expiryDate: Date | null = null;
  let diffDays = 0;
  let remainingStr = 'Не выполнялось';
  let status: 'normal' | 'warning' | 'critical' | 'expired' = hasLast ? 'normal' : 'warning';
  let percentTime = 0;

  if (baseDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    expiryDate = new Date(baseDate);
    if (def.nominalDays) {
      expiryDate.setDate(expiryDate.getDate() + def.nominalDays);
    } else if (def.nominalMonths) {
      expiryDate.setMonth(expiryDate.getMonth() + def.nominalMonths);
    }
    expiryDate.setHours(0, 0, 0, 0);

    const diffTime = expiryDate.getTime() - today.getTime();
    diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const totalDays = Math.max(1, Math.ceil((expiryDate.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24)));
    const elapsedDays = Math.max(0, Math.ceil((today.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24)));
    percentTime = (elapsedDays / totalDays) * 100;

    if (diffDays < 0) {
      remainingStr = `Просрочено (${Math.abs(diffDays)} дн.)`;
      status = 'expired';
    } else if (diffDays === 0) {
      remainingStr = 'Истекает сегодня';
      status = 'critical';
    } else if (diffDays < 100) {
      remainingStr = `${diffDays} дн.`;
      status = diffDays <= (def.nominalDays ? 3 : 30) ? 'critical' : diffDays <= (def.nominalDays ? 7 : 60) ? 'warning' : 'normal';
    } else {
      let y = expiryDate.getFullYear() - today.getFullYear();
      let m = expiryDate.getMonth() - today.getMonth();
      if (expiryDate.getDate() < today.getDate()) m -= 1;
      if (m < 0) { y -= 1; m += 12; }
      remainingStr = `${Math.max(0, y)}г. ${Math.max(0, m)}м.`;
      status = 'normal';
    }
  }

  const statusColor =
    status === 'expired' || status === 'critical'
      ? '#FF453A'
      : status === 'warning'
      ? '#FFD60A'
      : '#30D158';

  const intervalLabel = def.nominalDays
    ? `${def.nominalDays} дней`
    : def.nominalMonths
    ? `${def.nominalMonths} месяцев`
    : '—';

  return (
    <article className="space-y-3 rounded-2xl border border-[#3A3A3C] bg-[#2A2A2D] p-3.5 shadow-sm transition-colors">
      {/* Шапка */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4 shrink-0 text-[#229ED9]" />
          <span className="text-[14px] font-bold text-[#F0F0F0]">
            {def.name}
          </span>
          <span className="rounded-md bg-[#1C1C1E] px-1.5 py-0.5 text-[10px] font-medium text-[#888]">
            Календарный
          </span>
        </div>
        <div className="shrink-0 flex items-center justify-center p-1 rounded-full bg-[#1C1C1E]/50">
          <StatusIcon status={status} />
        </div>
      </div>

      {/* Поля карточки: строго календарные дни и даты */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Metric
            label="Дата последнего ТО"
            value={hasLast && baseDate ? formatCustomDate(baseDate) : 'Не выполнялось'}
          />
          <Metric
            label="Остаток"
            value={remainingStr}
            color={statusColor}
          />
        </div>
        <div className="relative">
          <Metric
            label="Следующий срок ТО"
            value={hasLast && expiryDate ? formatCustomDate(expiryDate) : 'Не выполнялось'}
          />
          <span className="absolute bottom-1 right-2.5 text-[9px] text-[#666]">
            интервал: {intervalLabel}
          </span>
        </div>
      </div>

      {/* Полоса светофора */}
      {hasLast && (
        <TrafficLightBar
          percent={percentTime}
          status={status}
        />
      )}
    </article>
  );
};

const HOURLY_STANDARDS: HourlyDef[] = [
  { kind: 'HOURS_50', name: '50-часовой регламент', intervalHours: 50 },
  { kind: 'HOURS_100', name: '100-часовой регламент', intervalHours: 100 },
  { kind: 'HOURS_300', name: '300-часовой регламент', intervalHours: 300 },
];

const CALENDAR_STANDARDS: CalendarDef[] = [
  { kind: 'PERIODIC', name: 'Периодический регламент', nominalDays: 20 },
  { kind: 'REG_12', name: 'Регламент 12 месяцев', nominalMonths: 12 },
  { kind: 'REG_24', name: 'Регламент 24 месяца', nominalMonths: 24 },
];

export const ResourcesTab: React.FC<ResourcesTabProps> = ({ profile, loading, error, onRefresh }) => {
  const [section, setSection] = useState<'aggregates' | 'oils' | 'journal'>('aggregates');
  const [journalView, setJournalView] = useState<'due' | 'history'>('due');

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 px-3 py-12 text-[13px] text-[#999]">
        <RefreshCw className="h-4 w-4 animate-spin" />
        Загрузка данных профиля…
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-3 rounded-2xl border border-[#FF453A]/30 bg-[#FF453A]/10 p-4 text-center text-[12px] text-[#FF8A83]">
        <AlertTriangle className="mx-auto mb-2 h-5 w-5" />
        <p>{error}</p>
        <button
          onClick={onRefresh}
          className="mt-3 h-10 rounded-xl bg-[#229ED9] px-4 font-semibold text-white"
        >
          Повторить
        </button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="m-3 rounded-2xl border border-[#3A3A3C] bg-[#2A2A2D] p-5 text-center text-[12px] text-[#999]">
        Войдите в аккаунт в настройках Mini App и выполните синхронизацию в LogBook. После этого здесь появятся ресурсы профиля.
      </div>
    );
  }

  const sections = [
    { id: 'aggregates' as const, label: 'Агрегаты', icon: Gauge, count: profile.aggregates.length },
    { id: 'oils' as const, label: 'Масла', icon: Droplets, count: profile.oils.length },
    { id: 'journal' as const, label: 'Журнал', icon: NotebookText, count: profile.maintenanceWorks.length },
  ];

  return (
    <div className="space-y-3 px-3 pb-6 pt-3">
      {/* Шапка борта */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h3 className="text-[12px] font-bold uppercase tracking-wider text-[#999]">
            Ресурсы борта №{cleanStringOrDash(profile.boardNumber)}
          </h3>
          <p className="mt-0.5 text-[10px] text-[#666]">
            СНЭ планера: <b className="text-[#AAA] font-mono">{formatMinutes(profile.fuselageSne)}</b> · данные Supabase
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-[#229ED9] hover:bg-white/5"
          aria-label="Обновить ресурсы"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Вкладки: Агрегаты / Масла / Журнал */}
      <div className="grid grid-cols-3 gap-1 rounded-xl border border-[#3A3A3C] bg-[#2A2A2D] p-1">
        {sections.map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            onClick={() => setSection(id)}
            className="flex min-h-11 items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-semibold transition-all"
            style={{
              backgroundColor: section === id ? '#229ED9' : 'transparent',
              color: section === id ? '#fff' : '#888',
            }}
          >
            <Icon className="h-3.5 w-3.5" /> {label} <span className="text-[9px] opacity-70">{count}</span>
          </button>
        ))}
      </div>

      {/* СЕКЦИЯ: АГРЕГАТЫ */}
      {section === 'aggregates' && (
        <div className="space-y-2.5">
          {profile.aggregates.length === 0 && <Empty text="В профиле нет данных об агрегатах" />}
          {profile.aggregates.map((item, index) => (
            <AggregateCard key={index} item={item} />
          ))}
        </div>
      )}

      {/* СЕКЦИЯ: МАСЛА (1 в 1 по аналогии) */}
      {section === 'oils' && (
        <div className="space-y-2.5">
          {profile.oils.length === 0 && <Empty text="В профиле нет данных о маслах" />}
          {profile.oils.map((item, index) => (
            <OilCard
              key={index}
              item={item}
              fuselageSne={profile.fuselageSne}
            />
          ))}
        </div>
      )}

      {/* СЕКЦИЯ: ЖУРНАЛ */}
      {section === 'journal' && (
        <div className="space-y-3">
          {/* Переключатель вида: Регламенты / История */}
          <div className="flex gap-1.5 rounded-xl bg-[#1C1C1E] p-1">
            <button
              onClick={() => setJournalView('due')}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] font-semibold transition-all ${
                journalView === 'due' ? 'bg-[#2A2A2D] text-[#229ED9] shadow-sm' : 'text-[#888]'
              }`}
            >
              <Clock3 className="h-3.5 w-3.5" />
              <span>Контроль регламентов</span>
            </button>
            <button
              onClick={() => setJournalView('history')}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] font-semibold transition-all ${
                journalView === 'history' ? 'bg-[#2A2A2D] text-[#229ED9] shadow-sm' : 'text-[#888]'
              }`}
            >
              <History className="h-3.5 w-3.5" />
              <span>История ТО ({profile.maintenanceWorks.length})</span>
            </button>
          </div>

          {/* Вид 1: Контроль регламентов */}
          {journalView === 'due' && (
            <div className="space-y-4">
              {/* Блок 1: По наработке (Часовые регламенты) */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-wider text-[#888]">
                  <Clock3 className="h-3.5 w-3.5 text-[#229ED9]" />
                  <span>По наработке (часовые регламенты)</span>
                </div>
                <div className="space-y-2.5">
                  {HOURLY_STANDARDS.map((def) => {
                    const candidates = profile.maintenanceWorks.filter(
                      (w) => w.kind === def.kind || (def.kind === 'HOURS_50' && w.kind === 'HOURS_100')
                    );
                    const lastWork = candidates.sort((a, b) => {
                      const bSne = Number(b.counterMinutes || 0);
                      const aSne = Number(a.counterMinutes || 0);
                      if (bSne !== aSne) return bSne - aSne;
                      return Number(b.createdAt || 0) - Number(a.createdAt || 0);
                    })[0];

                    return (
                      <HourlyMaintenanceCard
                        key={def.kind}
                        def={def}
                        lastWork={lastWork}
                        fuselageSne={profile.fuselageSne}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Блок 2: Календарные регламенты */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-wider text-[#888]">
                  <Calendar className="h-3.5 w-3.5 text-[#229ED9]" />
                  <span>Календарные регламенты (дни и месяцы)</span>
                </div>
                <div className="space-y-2.5">
                  {CALENDAR_STANDARDS.map((def) => {
                    const candidates = profile.maintenanceWorks.filter((w) => w.kind === def.kind);
                    const lastWork = candidates.sort((a, b) => {
                      const bDate = parseCustomDate(b.date)?.getTime() || 0;
                      const aDate = parseCustomDate(a.date)?.getTime() || 0;
                      if (bDate !== aDate) return bDate - aDate;
                      return Number(b.createdAt || 0) - Number(a.createdAt || 0);
                    })[0];

                    return (
                      <CalendarMaintenanceCard
                        key={def.kind}
                        def={def}
                        lastWork={lastWork}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Вид 2: История записей журнала */}
          {journalView === 'history' && (
            <div className="space-y-2.5">
              {profile.maintenanceWorks.length === 0 && <Empty text="В журнале пока нет записей о выполненных работах" />}
              {[...profile.maintenanceWorks]
                .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
                .map((work, index) => (
                  <article
                    key={work.id || index}
                    className="space-y-2.5 rounded-2xl border border-[#3A3A3C] bg-[#2A2A2D] p-3.5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex items-center gap-1 text-[11px] font-bold uppercase text-[#229ED9]">
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#30D158]" />
                        {workKind[work.kind || ''] || work.kind || 'Техническая работа'}
                      </span>
                      <span className="text-[10px] text-[#777] font-mono">{cleanStringOrDash(work.date)}</span>
                    </div>

                    {work.description && cleanStringOrDash(work.description) !== '—' && (
                      <p className="text-[12px] leading-relaxed text-[#E5E5E5] bg-[#1C1C1E]/50 rounded-xl p-2.5 border border-[#3A3A3C]/40">
                        {work.description}
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <Metric label="СНЭ выполнения" value={formatMinutes(work.counterMinutes)} />
                      <Metric
                        label="Наработка с тех пор"
                        value={formatMinutes(Math.max(0, profile.fuselageSne - Number(work.counterMinutes || 0)))}
                        color="#229ED9"
                      />
                    </div>
                  </article>
                ))}
            </div>
          )}
        </div>
      )}

      {profile.resourcesUpdatedAt > 0 && (
        <p className="text-center text-[10px] text-[#555]">
          Обновлено: {new Date(profile.resourcesUpdatedAt).toLocaleString('ru-RU')}
        </p>
      )}
    </div>
  );
};

const Metric = ({ label, value, color = '#F0F0F0' }: { label: string; value: string; color?: string }) => (
  <div className="min-w-0 rounded-xl bg-[#1C1C1E] p-2.5 text-center">
    <span className="block truncate text-[10px] font-medium text-[#777]">{label}</span>
    <b className="mt-1 block font-mono text-[14px] font-bold leading-tight" style={{ color }}>{value}</b>
  </div>
);

const Empty = ({ text }: { text: string }) => (
  <div className="rounded-2xl border border-dashed border-[#3A3A3C] p-6 text-center text-[12px] text-[#777]">
    {text}
  </div>
);
