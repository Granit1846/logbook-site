import React, { useState } from 'react';
import { AlertTriangle, Clock3, Droplets, Gauge, NotebookText, RefreshCw, ShieldCheck } from 'lucide-react';
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
          {profile.aggregates.map((item, index) => {
            const sne = Number(item.sne || 0);
            const limit = Number(item.extendedTo1 || 0);
            const remaining = item.remaining1 !== undefined ? Number(item.remaining1) : limit - sne;
            const percent = limit > 0 ? Math.max(0, Math.min(100, remaining / limit * 100)) : 0;
            const color = remaining < 0 ? '#FF453A' : percent <= 10 ? '#FF9F0A' : '#229ED9';
            return (
              <article key={index} className="space-y-2.5 rounded-2xl border border-[#3A3A3C] bg-[#2A2A2D] p-3">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-[13px] font-semibold leading-tight">{item.name || 'Без названия'}</h4>
                  {remaining < 0 ? <span className="text-[10px] font-bold text-[#FF453A]">Ресурс вышел</span> : <ShieldCheck className="h-4 w-4 shrink-0" style={{ color }} />}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Metric label="СНЭ" value={formatMinutes(sne)} />
                  <Metric label="Ресурс" value={formatMinutes(limit)} />
                  <Metric label="Остаток" value={formatMinutes(remaining)} color={color} />
                </div>
                {limit > 0 && <div className="h-1.5 overflow-hidden rounded-full bg-[#1C1C1E]"><div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: color }} /></div>}
                {(item.issueDate || item.yearsResource || item.remaining2) && (
                  <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-[#3A3A3C] pt-2 text-[10px] text-[#777]">
                    {item.issueDate && <span>Выпуск: <b className="text-[#AAA]">{item.issueDate}</b></span>}
                    {item.yearsResource && <span>Срок: <b className="text-[#AAA]">{item.yearsResource}</b></span>}
                    {item.remaining2 && <span>Остаток: <b className="text-[#AAA]">{item.remaining2}</b></span>}
                  </div>
                )}
              </article>
            );
          })}
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
  <div className="min-w-0 rounded-lg bg-[#1C1C1E] px-1.5 py-2"><span className="block truncate text-[9px] text-[#777]">{label}</span><b className="mt-0.5 block font-mono text-[12px]" style={{ color }}>{value}</b></div>
);

const Empty = ({ text }: { text: string }) => <div className="rounded-2xl border border-dashed border-[#3A3A3C] p-6 text-center text-[12px] text-[#777]">{text}</div>;
