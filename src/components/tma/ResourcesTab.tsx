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
} from 'lucide-react';
import type { CloudProfileData } from '@/lib/tmaService';

interface ResourcesTabProps {
  profile?: CloudProfileData;
  loading: boolean;
  error: string;
  onRefresh: () => void;
}

const formatMinutes = (value?: number) => {
  if (value === undefined || !Number.isFinite(value)) return '—';
  const sign = value < 0 ? '−' : '';
  const absolute = Math.abs(Math.round(value));
  return `${sign}${Math.floor(absolute / 60)}:${String(absolute % 60).padStart(2, '0')}`;
};

const workKind: Record<string, string> = {
  PERIODIC: 'Периодические работы',
  HOURS_50: '50-часовые работы',
  HOURS_100: '100-часовые работы',
  HOURS_300: '300-часовые работы',
  REG_12: 'Регламент 12 месяцев',
  REG_24: 'Регламент 24 месяца',
  OTHER: 'Прочие работы',
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
  if (!trimmed) return null;

  if (trimmed.includes('.')) {
    const parts = trimmed.split('.');
    if (parts.length >= 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      let year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;
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

function calculateDates(issueDateRaw?: string, yearsResourceRaw?: string, extendedTo2Raw?: string): DateCalcResult | null {
  const issue = parseCustomDate(issueDateRaw);
  if (!issue) return null;

  const years = parseFloat(String(yearsResourceRaw || '').replace(',', '.'));
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

const TrafficLightBar = ({ percent, status }: { percent: number; status: 'normal' | 'warning' | 'critical' | 'expired' }) => {
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
        {/* Заполняющийся прогресс расхода СНЭ */}
        <div
          className="relative h-full rounded-full transition-all duration-300"
          style={{
            width: `${status === 'expired' ? 100 : clampedPercent}%`,
            backgroundColor: activeColor,
            boxShadow: `0 0 6px ${activeColor}66`,
          }}
        />
      </div>
      <div className="flex justify-between px-0.5 text-[9px] text-[#666]">
        <span>0%</span>
        <span className="text-[#888]">{clampedPercent.toFixed(0)}%</span>
        <span className="text-[#FF453A]">100%</span>
      </div>
    </div>
  );
};

const AggregateCard: React.FC<{ item: CloudProfileData['aggregates'][0] }> = ({ item }) => {
  const [showDates, setShowDates] = useState(false);

  // Расчёт ресурса (часы:минуты)
  const sne = Number(item.sne || 0);
  const limit = Number(item.extendedTo1 || 0);
  const remaining = limit - sne;

  const percentConsumed = limit > 0 ? (sne / limit) * 100 : 0;
  const percentRemaining = limit > 0 ? (remaining / limit) * 100 : 0;

  let hourStatus: 'normal' | 'warning' | 'critical' | 'expired' = 'normal';
  if (limit > 0 && remaining < 0) {
    hourStatus = 'expired';
  } else if (limit > 0 && (remaining <= 20 * 60 || percentRemaining <= 5)) {
    hourStatus = 'critical';
  } else if (limit > 0 && (remaining <= 50 * 60 || percentRemaining <= 10)) {
    hourStatus = 'warning';
  } else {
    hourStatus = 'normal';
  }

  // Расчёт дат
  const dateCalc = calculateDates(item.issueDate, item.yearsResource, item.extendedTo2);

  const currentStatus = showDates && dateCalc ? dateCalc.status : hourStatus;
  const statusColor =
    currentStatus === 'expired' || currentStatus === 'critical'
      ? '#FF453A'
      : currentStatus === 'warning'
      ? '#FFD60A'
      : '#30D158';

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
            {item.name || 'Без названия'}
          </span>
          <span className="flex items-center gap-0.5 rounded-md bg-[#1C1C1E] px-1.5 py-0.5 text-[10px] font-medium text-[#888] group-hover:text-[#229ED9] transition-colors">
            {showDates ? <Calendar className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}
            <span>{showDates ? 'Даты' : 'Часы'}</span>
          </span>
        </button>
        <div className="shrink-0 flex items-center justify-center p-1 rounded-full bg-[#1C1C1E]/50">
          <StatusIcon status={currentStatus} />
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
              value={formatMinutes(remaining)}
              color={statusColor}
            />
          </div>
          {/* Нижний ряд: Ресурс */}
          <Metric label="Ресурс" value={formatMinutes(limit)} />
        </div>
      ) : (
        <div className="space-y-2">
          {/* Верхний ряд: 2 поля — Дата выпуска и Остаток */}
          <div className="grid grid-cols-2 gap-2">
            <Metric label="Дата выпуска" value={dateCalc?.issueDateStr || item.issueDate || '—'} />
            <Metric
              label="Остаток"
              value={dateCalc?.remainingStr || '—'}
              color={statusColor}
            />
          </div>
          {/* Нижний ряд: Дата окончания (Дата выпуска + Назначенный) */}
          <Metric
            label="Дата окончания"
            value={dateCalc?.expiryDateStr || (item.yearsResource ? `Срок: ${item.yearsResource} л.` : '—')}
          />
        </div>
      )}

      {/* Полоса светофора */}
      {limit > 0 && (
        <TrafficLightBar
          percent={percentConsumed}
          status={hourStatus}
        />
      )}
    </article>
  );
};

export const ResourcesTab: React.FC<ResourcesTabProps> = ({ profile, loading, error, onRefresh }) => {
  const [section, setSection] = useState<'aggregates' | 'oils' | 'journal'>('aggregates');

  if (loading) {
    return <div className="flex items-center justify-center gap-2 px-3 py-12 text-[13px] text-[#999]"><RefreshCw className="h-4 w-4 animate-spin" />Загрузка данных профиля…</div>;
  }

  if (error) {
    return (
      <div className="m-3 rounded-2xl border border-[#FF453A]/30 bg-[#FF453A]/10 p-4 text-center text-[12px] text-[#FF8A83]">
        <AlertTriangle className="mx-auto mb-2 h-5 w-5" />
        <p>{error}</p>
        <button onClick={onRefresh} className="mt-3 h-10 rounded-xl bg-[#229ED9] px-4 font-semibold text-white">Повторить</button>
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
      <div className="flex items-center justify-between px-1">
        <div>
          <h3 className="text-[12px] font-bold uppercase tracking-wider text-[#999]">Ресурсы борта №{profile.boardNumber}</h3>
          <p className="mt-0.5 text-[10px] text-[#666]">Только просмотр · данные Supabase</p>
        </div>
        <button onClick={onRefresh} className="flex h-10 w-10 items-center justify-center rounded-lg text-[#229ED9] hover:bg-white/5" aria-label="Обновить ресурсы"><RefreshCw className="h-4 w-4" /></button>
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-xl border border-[#3A3A3C] bg-[#2A2A2D] p-1">
        {sections.map(({ id, label, icon: Icon, count }) => (
          <button key={id} onClick={() => setSection(id)} className="flex min-h-11 items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-semibold" style={{ backgroundColor: section === id ? '#229ED9' : 'transparent', color: section === id ? '#fff' : '#888' }}>
            <Icon className="h-3.5 w-3.5" /> {label} <span className="text-[9px] opacity-70">{count}</span>
          </button>
        ))}
      </div>

      {section === 'aggregates' && (
        <div className="space-y-2.5">
          {profile.aggregates.length === 0 && <Empty text="В профиле нет данных об агрегатах" />}
          {profile.aggregates.map((item, index) => (
            <AggregateCard key={index} item={item} />
          ))}
        </div>
      )}

      {section === 'oils' && (
        <div className="space-y-2.5">
          {profile.oils.length === 0 && <Empty text="В профиле нет данных о маслах" />}
          {profile.oils.map((item, index) => {
            const used = Math.max(0, profile.fuselageSne - Number(item.byHours || 0));
            const limit = Number(item.coefficient || 0);
            const remaining = limit - used;
            const percent = limit > 0 ? Math.max(0, Math.min(100, remaining / limit * 100)) : 0;
            const color = remaining < 0 ? '#FF453A' : percent <= 10 ? '#FF9F0A' : '#229ED9';
            return (
              <article key={index} className="space-y-2.5 rounded-2xl border border-[#3A3A3C] bg-[#2A2A2D] p-3">
                <div className="flex items-start justify-between gap-2"><h4 className="text-[13px] font-semibold">{item.name || 'Без названия'}</h4><Droplets className="h-4 w-4 shrink-0" style={{ color }} /></div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Metric label="Залито при СНЭ" value={formatMinutes(item.byHours)} />
                  <Metric label="Ресурс" value={formatMinutes(limit)} />
                  <Metric label="Остаток" value={formatMinutes(remaining)} color={color} />
                </div>
                {limit > 0 && <div className="h-1.5 overflow-hidden rounded-full bg-[#1C1C1E]"><div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: color }} /></div>}
                <div className="flex gap-3 border-t border-[#3A3A3C] pt-2 text-[10px] text-[#777]"><span>Дата заливки: <b className="text-[#AAA]">{item.byYears || '—'}</b></span><span>Срок: <b className="text-[#AAA]">{item.term || '—'} г.</b></span></div>
              </article>
            );
          })}
        </div>
      )}

      {section === 'journal' && (
        <div className="space-y-2.5">
          {profile.maintenanceWorks.length === 0 && <Empty text="В журнале пока нет записей" />}
          {[...profile.maintenanceWorks].sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)).map((work, index) => (
            <article key={work.id || index} className="rounded-2xl border border-[#3A3A3C] bg-[#2A2A2D] p-3">
              <div className="flex items-start justify-between gap-2"><span className="text-[10px] font-bold uppercase text-[#229ED9]">{workKind[work.kind || ''] || work.kind || 'Работа'}</span><span className="text-[10px] text-[#777]">{work.date || '—'}</span></div>
              <p className="mt-2 text-[13px] leading-snug text-[#E5E5E5]">{work.description || 'Без описания'}</p>
              <div className="mt-2 flex items-center gap-1 text-[10px] text-[#777]"><Clock3 className="h-3 w-3" /> СНЭ: <b className="text-[#AAA]">{formatMinutes(work.counterMinutes)}</b></div>
            </article>
          ))}
        </div>
      )}

      {profile.resourcesUpdatedAt > 0 && <p className="text-center text-[10px] text-[#555]">Обновлено: {new Date(profile.resourcesUpdatedAt).toLocaleString('ru-RU')}</p>}
    </div>
  );
};

const Metric = ({ label, value, color = '#F0F0F0' }: { label: string; value: string; color?: string }) => (
  <div className="min-w-0 rounded-xl bg-[#1C1C1E] p-2.5 text-center">
    <span className="block truncate text-[10px] font-medium text-[#777]">{label}</span>
    <b className="mt-1 block font-mono text-[14px] font-bold leading-tight" style={{ color }}>{value}</b>
  </div>
);

const Empty = ({ text }: { text: string }) => <div className="rounded-2xl border border-dashed border-[#3A3A3C] p-6 text-center text-[12px] text-[#777]">{text}</div>;
