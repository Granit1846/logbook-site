/**
 * Telegram Bot for LogBook App — Supabase Edge Function webhook.
 * The logic is bots/bot.js; network and storage go through ../_shared/bot_runtime.ts.
 */
import { track, loadState, saveState, getBotToken, getPlatformSession, confirmPlatformCode, randomHex } from '../_shared/bot_runtime.ts';

const BOT_TOKEN = await getBotToken('telegram');
const ADMIN_ID = Number(Deno.env.get('ADMIN_ID')) || 891159880;

// Подписчики хранятся в таблице bot_state
function loadSubscribers() {
    return loadState('telegram_subscribers', []);
}

function saveSubscribers(list) {
    return track(saveState('telegram_subscribers', list));
}

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// Запрос к Telegram Bot API
function tgRequest(method, payload = null) {
    return track(fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: payload ? JSON.stringify(payload) : undefined,
        signal: AbortSignal.timeout(25000)
    }).then(res => res.json()).catch(err => ({ ok: false, description: err.message })));
}

// Получение последнего релиза с GitHub
function getLatestGitHubRelease() {
    return fetch('https://api.github.com/repos/Granit1846/LogBook-Android/releases/latest', {
        headers: { 'User-Agent': 'LogBook-Bot' }
    }).then(res => res.json()).catch(() => null);
}

const SUPABASE_URL = 'https://zjagjauwmpuzcwzidhkn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_6IaiQHYrjD2auxTmnfjqzQ_ev_Ec55B';

// Вызов RPC в Supabase для подтверждения сессии входа
function confirmTelegramAuthInSupabase(code, telegramId) {
    return confirmPlatformCode('telegram', telegramId, code, BOT_TOKEN, SUPABASE_KEY);
}

function formatHM(mins) {
    if (mins === undefined || mins === null) return '0м';
    const sign = mins < 0 ? '-' : '';
    const abs = Math.abs(mins);
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return sign + (h > 0 ? `${h}ч ${m < 10 ? '0' : ''}${m}м` : `${m}м`);
}

function sendDocumentToUser(chatId, fileName, content, caption, replyMarkup = null) {
    const form = new FormData();
    form.append('chat_id', String(chatId));
    form.append('document', new Blob([content], { type: 'application/json' }), fileName);
    form.append('caption', caption || '');
    form.append('parse_mode', 'HTML');
    if (replyMarkup) form.append('reply_markup', JSON.stringify(replyMarkup));
    return track(fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, { method: 'POST', body: form })
        .then(res => res.json()).catch(err => ({ ok: false, description: err.message })));
}

// Получение сессии и данных из облака Supabase
async function getUserCloudData(userId) {
    const loginRes = await getPlatformSession('telegram', userId, BOT_TOKEN, SUPABASE_KEY);
    if (!loginRes?.access_token) return null;

    const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${loginRes.access_token}` };
    const [syncRes, userRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/rpc/logbook_sync_pull_v1`, {
            method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: '{}'
        }).then(res => res.json()).catch(() => null),
        fetch(`${SUPABASE_URL}/auth/v1/user`, { headers }).then(res => res.json()).catch(() => ({}))
    ]);

    const resp = Array.isArray(syncRes) ? syncRes[0] : syncRes;
    if (!resp?.payload) return null;

    const exchange = typeof resp.payload === 'string' ? JSON.parse(resp.payload) : resp.payload;

    // Выбранный борт из Mini App
    const selectedBoard = userRes?.user_metadata?.selected_board || null;

    const profiles = exchange.tables?.profiles || [];
    let selectedProfile = null;
    if (selectedBoard) {
        selectedProfile = profiles.find(p => String(p.boardNumber) === String(selectedBoard));
    }
    if (!selectedProfile && profiles.length > 0) {
        selectedProfile = profiles[0];
    }

    return {
        exchange,
        tables: exchange.tables || {},
        revision: Number(resp.revision ?? 0),
        token: loginRes.access_token,
        selectedBoard: selectedProfile?.boardNumber || selectedBoard,
        selectedProfile: selectedProfile
    };
}

function formatLaunchLine(index, launch) {
    const vsu = launch.vsu || 0;
    const zemlya = launch.zemlya || 0;
    const vozduh = launch.vozduh || 0;
    const tp = launch.tp || 0;
    const liters = launch.zapravkaLiters || 0;
    const density = launch.zapravkaDensity ? String(launch.zapravkaDensity).replace('.', ',') : '';
    const ved = launch.vedCek ? String(launch.vedCek).trim() : '';

    let typeStr = 'запуск';
    let timesStr = '';

    if (vozduh > 0) {
        typeStr = 'вылет';
        timesStr = `⏱️- ${vsu} / ${zemlya} / ${vozduh}`;
    } else if (tp > 0) {
        typeStr = 'ТП';
        timesStr = `⏱️- ${vsu} / ${tp}`;
    } else if (zemlya > 0) {
        typeStr = 'проба';
        timesStr = `⏱️- ${vsu} / ${zemlya}`;
    } else if (vsu > 0) {
        typeStr = 'запуск';
        timesStr = `⏱️- ${vsu}`;
    } else if (liters > 0) {
        typeStr = 'дозаправка';
    } else {
        typeStr = 'запуск';
        timesStr = `⏱️- 0`;
    }

    let line = `${index} (${typeStr})`;
    if (timesStr) {
        line += `${timesStr}`;
    }

    // Если есть заправка — выводим сразу под строкой запуска с 2 пробелами от края и без слова "заправка"
    if (liters > 0) {
        let fuelPart = `${liters}`;
        if (density) fuelPart += ` * ${density}`;
        if (ved) fuelPart += ` / ${ved}`;
        line += `\n  🔋 ${fuelPart}`;
    }

    return line;
}

// 1. Отчёт по истории полётов (/history [дней])
async function getUserFlightHistoryReport(userId, firstName, daysLimit = 7) {
    try {
        const cloud = await getUserCloudData(userId);
        if (!cloud || !cloud.tables) {
            return `⚠️ <b>Синхронизация не найдена</b>\n\nНе удалось получить доступ к данным LogBook. Убедитесь, что выполнен вход через Telegram в приложении или открыто мини-приложение в боте.`;
        }

        const tables = cloud.tables;
        const selectedProfile = cloud.selectedProfile;
        const targetProfileId = selectedProfile?.id;
        const targetBoardNumber = selectedProfile?.boardNumber || cloud.selectedBoard;

        let days = Array.isArray(tables?.days) ? [...tables.days] : [];
        if (targetProfileId) {
            days = days.filter(d => d.profileId === targetProfileId);
        }

        if (days.length === 0) {
            return `✈️ <b>История полётов пуста</b>\n\nДля борта <b>${targetBoardNumber || '—'}</b> записей полётов пока нет. Выберите нужный борт в мини-приложении LogBook.`;
        }

        days.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        const limit = Math.max(1, Math.min(Number(daysLimit) || 7, 100));
        const recentDays = days.slice(0, limit);

        let lines = [];
        lines.push(`📋 <b>История полётов: борт ${targetBoardNumber || '—'} (крайние ${recentDays.length} дн.)</b>`);
        lines.push(`👤 Профиль: <b>${firstName || 'Sergey'}</b>\n`);

        for (let i = 0; i < recentDays.length; i++) {
            const day = recentDays[i];
            const profile = (tables.profiles || []).find(p => p.id === day.profileId) || selectedProfile || {};
            const launches = (tables.launches || []).filter(l => l.dayId === day.id);
            launches.sort((a, b) => (a.order || 0) - (b.order || 0));

            const dateParts = (day.date || '').split('-');
            const formattedDate = dateParts.length === 3 ? `${dateParts[2]}.${dateParts[1]}.${dateParts[0]}` : (day.date || '—');
            const crewStr = day.crew ? day.crew : '—';
            const boardStr = profile.boardNumber ? ` · борт ${profile.boardNumber}` : '';

            lines.push(`📅 <b>Дата - ${formattedDate}${boardStr}</b>`);
            lines.push(`👨‍✈️ <b>Экипаж:</b> ${crewStr}`);

            if (launches.length === 0) {
                lines.push(`<i>Запуски не записаны</i>`);
            } else {
                for (let j = 0; j < launches.length; j++) {
                    lines.push(formatLaunchLine(j + 1, launches[j]));
                }
            }

            lines.push(`──────────`);
        }

        return lines.join('\n');
    } catch (e) {
        console.error('Ошибка получения истории:', e);
        return `⚠️ Ошибка: ${e.message}`;
    }
}

function parseDateFlexible(dateStr) {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return dateStr;
    const s = String(dateStr).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        const [y, m, d] = s.split('-').map(Number);
        return new Date(y, m - 1, d);
    }
    if (/^\d{2}\.\d{2}\.\d{4}/.test(s)) {
        const [d, m, y] = s.split('.').map(Number);
        return new Date(y, m - 1, d);
    }
    const parsed = new Date(s);
    return isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateRu(dateStr) {
    const d = parseDateFlexible(dateStr);
    if (!d) return dateStr || '—';
    const day = String(d.getDate()).padStart(2, '0');
    const mon = String(d.getMonth() + 1).padStart(2, '0');
    const yr = d.getFullYear();
    return `${day}.${mon}.${yr}`;
}

// Форматирование остатка по календарю: гг.мм, а если дд < 100 — количество дней
function formatCalendarRemaining(targetDate) {
    if (!targetDate) return '—';
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const target = parseDateFlexible(targetDate);
    if (!target) return '—';
    target.setHours(0, 0, 0, 0);

    const diffMs = target.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return `⚠️ просрочено на <b>${Math.abs(diffDays)} дн.</b>`;
    }

    if (diffDays < 100) {
        return `<b>${diffDays} дн.</b> (до ${formatDateRu(target)})`;
    }

    // diffDays >= 100 -> показываем в виде гг.мм
    let years = target.getFullYear() - today.getFullYear();
    let months = target.getMonth() - today.getMonth();
    if (target.getDate() < today.getDate()) {
        months--;
    }
    if (months < 0) {
        years--;
        months += 12;
    }
    const yy = String(Math.max(0, years)).padStart(2, '0');
    const mm = String(Math.max(0, months)).padStart(2, '0');
    const descText = years > 0 ? `${years}г. ${months}мес.` : `${months} мес.`;
    return `<b>${yy}.${mm}</b> (${descText}, до ${formatDateRu(target)})`;
}

function formatYearsWord(val) {
    if (!val) return '';
    const num = parseFloat(String(val).replace(',', '.'));
    if (isNaN(num)) return `${val} г.`;
    if (num % 1 !== 0) return `${val} г.`;
    const n = Math.abs(Math.round(num)) % 100;
    const n1 = n % 10;
    if (n > 10 && n < 20) return `${val} лет`;
    if (n1 > 1 && n1 < 5) return `${val} года`;
    if (n1 === 1) return `${val} год`;
    return `${val} лет`;
}

function calcCalendarRemainingYM(expiryDate) {
    if (!expiryDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiry = parseDateFlexible(expiryDate);
    if (!expiry) return null;
    expiry.setHours(0, 0, 0, 0);

    const diffMs = expiry.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return `⚠️ просрочено на ${Math.abs(diffDays)} дн.`;
    }
    if (diffDays < 30) {
        return `${diffDays} дн.`;
    }

    let years = expiry.getFullYear() - today.getFullYear();
    let months = expiry.getMonth() - today.getMonth();
    if (expiry.getDate() < today.getDate()) {
        months--;
    }
    if (months < 0) {
        years--;
        months += 12;
    }

    if (years > 0 && months > 0) return `${years}г ${months}м`;
    if (years > 0 && months === 0) return `${years}г`;
    return `${months}м`;
}

// Расчёт точного отступа пробелами для выравнивания второй строки остатков под первой
function calcPrefixSpaces(name) {
    let width = 2.2; // для маркёра "• "
    for (const ch of name) {
        if (ch === ' ' || ch === '.') width += 0.9;
        else if (ch === 'Ж' || ch === 'ж' || ch === 'Ш' || ch === 'ш' || ch === 'Щ' || ch === 'щ' || ch === 'Ю' || ch === 'ю' || ch === 'Ф' || ch === 'ф') width += 2.0;
        else if (ch === ch.toUpperCase() && /[А-ЯA-Z]/.test(ch)) width += 1.8;
        else width += 1.65;
    }
    width += 1.8; // для ": "
    return ' '.repeat(Math.max(2, Math.round(width)));
}

// 2. Отчёт по остаткам ресурсов, ТО и масел (/status)
async function getUserStatusReport(userId, firstName) {
    try {
        const cloud = await getUserCloudData(userId);
        if (!cloud || !cloud.tables) {
            return `⚠️ <b>Синхронизация не найдена</b>\n\nНе удалось получить доступ к данным LogBook.`;
        }

        const profile = cloud.selectedProfile || cloud.tables.profiles?.[0] || {};
        const sne = profile.fuselageSne || 0;
        const boardStr = profile.boardNumber ? `борт <b>${profile.boardNumber}</b>` : 'борт —';
        const nameStr = profile.name && profile.name !== profile.boardNumber ? ` (${profile.name})` : '';

        let lines = [];
        lines.push(`📊 <b>Текущий статус ${boardStr}${nameStr}</b>`);
        lines.push(`👤 Профиль: <b>${firstName || 'Sergey'}</b>`);
        lines.push(`⏱ Наработка (СНЭ планера): <b>${formatHM(sne)}</b>\n`);

        // ТО
        const mw = Array.isArray(profile.maintenanceWorksJson) ? profile.maintenanceWorksJson : JSON.parse(profile.maintenanceWorksJson || '[]');
        lines.push(`🔧 <b>Регламентные работы (ТО):</b>`);

        // 1. 50 ч ТО (по наработке)
        const candidates50 = mw.filter(m => m.kind === 'HOURS_50' || m.kind === 'HOURS_100');
        const last50 = candidates50.sort((a,b) => (b.counterMinutes||0) - (a.counterMinutes||0))[0];
        if (last50) {
            const next50 = (last50.counterMinutes || 0) + 3000;
            const rem50 = next50 - sne;
            lines.push(`• <b><u>50 ч ТО:</u></b> ост. <b>${formatHM(rem50)}</b> (вып. ${formatDateRu(last50.date)} на ${formatHM(last50.counterMinutes)})`);
        } else {
            lines.push(`• <b><u>50 ч ТО:</u></b> нет данных`);
        }

        // 2. 100 ч ТО (по наработке)
        const candidates100 = mw.filter(m => m.kind === 'HOURS_100');
        const last100 = candidates100.sort((a,b) => (b.counterMinutes||0) - (a.counterMinutes||0))[0];
        if (last100) {
            const next100 = (last100.counterMinutes || 0) + 6000;
            const rem100 = next100 - sne;
            lines.push(`• <b><u>100 ч ТО:</u></b> ост. <b>${formatHM(rem100)}</b> (вып. ${formatDateRu(last100.date)} на ${formatHM(last100.counterMinutes)})`);
        } else {
            lines.push(`• <b><u>100 ч ТО:</u></b> нет данных`);
        }

        // 3. 300 ч ТО (по наработке)
        const candidates300 = mw.filter(m => m.kind === 'HOURS_300');
        const last300 = candidates300.sort((a,b) => (b.counterMinutes||0) - (a.counterMinutes||0))[0];
        if (last300) {
            const next300 = (last300.counterMinutes || 0) + 18000;
            const rem300 = next300 - sne;
            lines.push(`• <b><u>300 ч ТО:</u></b> ост. <b>${formatHM(rem300)}</b> (вып. ${formatDateRu(last300.date)} на ${formatHM(last300.counterMinutes)})`);
        } else {
            lines.push(`• <b><u>300 ч ТО:</u></b> нет данных`);
        }

        // 4. Периодическое ТО (по календарю, интервал 20 дней)
        const candidatesPeriodic = mw.filter(m => m.kind === 'PERIODIC');
        const lastPeriodic = candidatesPeriodic.sort((a,b) => (parseDateFlexible(b.date)?.getTime()||0) - (parseDateFlexible(a.date)?.getTime()||0))[0];
        if (lastPeriodic) {
            const baseD = parseDateFlexible(lastPeriodic.date);
            if (baseD) {
                const targetD = new Date(baseD);
                targetD.setDate(targetD.getDate() + 20);
                const remStr = formatCalendarRemaining(targetD);
                lines.push(`• <b><u>Периодическое ТО:</u></b> ост. ${remStr} (вып. ${formatDateRu(lastPeriodic.date)})`);
            } else {
                lines.push(`• <b><u>Периодическое ТО:</u></b> вып. ${lastPeriodic.date}`);
            }
        } else {
            lines.push(`• <b><u>Периодическое ТО:</u></b> нет данных`);
        }

        // 5. Регламент 12 мес (1 год)
        const candidatesReg12 = mw.filter(m => m.kind === 'REG_12');
        const lastReg12 = candidatesReg12.sort((a,b) => (parseDateFlexible(b.date)?.getTime()||0) - (parseDateFlexible(a.date)?.getTime()||0))[0];
        if (lastReg12) {
            const baseD = parseDateFlexible(lastReg12.date);
            if (baseD) {
                const targetD = new Date(baseD);
                targetD.setFullYear(targetD.getFullYear() + 1);
                const remStr = formatCalendarRemaining(targetD);
                lines.push(`• <b><u>Регламент 12 мес:</u></b> ост. ${remStr} (вып. ${formatDateRu(lastReg12.date)})`);
            }
        }

        // 6. Регламент 24 мес (2 года)
        const candidatesReg24 = mw.filter(m => m.kind === 'REG_24');
        const lastReg24 = candidatesReg24.sort((a,b) => (parseDateFlexible(b.date)?.getTime()||0) - (parseDateFlexible(a.date)?.getTime()||0))[0];
        if (lastReg24) {
            const baseD = parseDateFlexible(lastReg24.date);
            if (baseD) {
                const targetD = new Date(baseD);
                targetD.setFullYear(targetD.getFullYear() + 2);
                const remStr = formatCalendarRemaining(targetD);
                lines.push(`• <b><u>Регламент 24 мес:</u></b> ост. ${remStr} (вып. ${formatDateRu(lastReg24.date)})`);
            }
        }

        // Ресурсы
        const resList = Array.isArray(profile.resourcesJson) ? profile.resourcesJson : JSON.parse(profile.resourcesJson || '[]');
        if (resList.length > 0) {
            lines.push(`\n⚙️ <b>Ресурсы планера и агрегатов:</b>`);
            for (let i = 0; i < resList.length; i++) {
                const r = resList[i];
                const name = r.name || 'Планер';

                // Часы
                const remMinutes = (r.extendedTo1 || 0) > 0 ? (r.extendedTo1 - sne) : (r.remaining1 || 0);
                const remH = remMinutes !== 0 ? formatHM(remMinutes) : '—';
                const maxH = (r.extendedTo1 || 0) > 0 ? `${Math.round(r.extendedTo1 / 60)} ч` : '—';

                // Календарь
                let calExpiry = null;
                const maxYearsVal = r.extendedTo2 || r.yearsResource || '';
                if (r.extendedTo2 && parseDateFlexible(r.extendedTo2)) {
                    calExpiry = parseDateFlexible(r.extendedTo2);
                } else if (r.issueDate && parseDateFlexible(r.issueDate)) {
                    const issue = parseDateFlexible(r.issueDate);
                    const yr = parseFloat(String(maxYearsVal).replace(',', '.'));
                    if (!isNaN(yr)) {
                        calExpiry = new Date(issue);
                        calExpiry.setFullYear(calExpiry.getFullYear() + Math.floor(yr));
                        calExpiry.setMonth(calExpiry.getMonth() + Math.round((yr % 1) * 12));
                    }
                }
                const remCal = calcCalendarRemainingYM(calExpiry) || (r.remaining2 && r.remaining2.trim() !== '' ? r.remaining2.trim() : '—');
                const maxYearsStr = maxYearsVal ? formatYearsWord(maxYearsVal) : '—';
                const pad = calcPrefixSpaces(name);

                lines.push(`• <b><u>${name}:</u></b> ост. до продл. <b>${remH}</b> (до ${maxH})`);
                lines.push(`${pad}ост. до продл. <b>${remCal}</b> (до ${maxYearsStr})`);
            }
        }

        // Масла
        const oils = Array.isArray(profile.oilsJson) ? profile.oilsJson : JSON.parse(profile.oilsJson || '[]');
        if (oils.length > 0) {
            lines.push(`\n🛢 <b>Контроль масел:</b>`);
            for (let i = 0; i < oils.length; i++) {
                const o = oils[i];
                const name = o.name || 'Масло';

                // Часы
                const hasHours = (o.coefficient || 0) > 0 && !(o.emptyFields && o.emptyFields.includes('coefficient'));
                const elapsed = sne - (o.byHours || 0);
                const remMinutes = (o.coefficient || 0) - elapsed;
                const remH = formatHM(remMinutes);
                const maxH = Math.round((o.coefficient || 0) / 60);

                // Календарь
                let calExpiry = null;
                if (o.byYears && o.byYears.trim() !== '' && o.term && o.term.trim() !== '') {
                    const filled = parseDateFlexible(o.byYears);
                    if (filled) {
                        const yr = parseFloat(String(o.term).replace(',', '.'));
                        if (!isNaN(yr)) {
                            calExpiry = new Date(filled);
                            calExpiry.setFullYear(calExpiry.getFullYear() + Math.floor(yr));
                            calExpiry.setMonth(calExpiry.getMonth() + Math.round((yr % 1) * 12));
                        }
                    }
                }
                const remCal = calcCalendarRemainingYM(calExpiry);
                const maxYearsStr = o.term ? formatYearsWord(o.term) : '';
                const pad = calcPrefixSpaces(name);

                if (hasHours && remCal) {
                    lines.push(`• <b><u>${name}:</u></b> ост. <b>${remH}</b> (до ${maxH} ч)`);
                    lines.push(`${pad}ост. <b>${remCal}</b> (до ${maxYearsStr})`);
                } else if (hasHours) {
                    lines.push(`• <b><u>${name}:</u></b> ост. <b>${remH}</b> (до ${maxH} ч)`);
                } else if (remCal) {
                    lines.push(`• <b><u>${name}:</u></b> ост. <b>${remCal}</b> (до ${maxYearsStr})`);
                }
            }
        }

        return lines.join('\n');
    } catch (e) {
        console.error('Ошибка статуса:', e);
        return `⚠️ Ошибка: ${e.message}`;
    }
}

// 3. Отчёт по дефектам и замечаниям (/defects)
async function getUserDefectsReport(userId, firstName) {
    try {
        const cloud = await getUserCloudData(userId);
        if (!cloud || !cloud.tables) {
            return `⚠️ <b>Синхронизация не найдена</b>\n\nНе удалось получить доступ к данным LogBook.`;
        }

        const profile = cloud.selectedProfile || cloud.tables.profiles?.[0] || {};
        const defects = Array.isArray(profile.defectTasksJson) ? profile.defectTasksJson : JSON.parse(profile.defectTasksJson || '[]');
        const open = defects.filter(d => !d.completedAt || d.completedAt === 0);

        let lines = [];
        lines.push(`🛠 <b>Журнал дефектов и замечаний (борт ${profile.boardNumber || '—'})</b>`);
        lines.push(`👤 Профиль: <b>${firstName || 'Sergey'}</b>\n`);

        if (open.length === 0) {
            lines.push(`✅ <b>Все замечания устранены!</b>\nОткрытых дефектов по борту нет.`);
        } else {
            lines.push(`⚠️ <b>Открытые замечания (${open.length}):</b>`);
            for (let i = 0; i < open.length; i++) {
                const d = open[i];
                const dateStr = d.createdAt ? new Date(d.createdAt).toLocaleDateString('ru-RU') : '—';
                lines.push(`${i + 1}. <b>${d.description}</b> (от ${dateStr})`);
            }
        }

        lines.push(`\n💡 <i>Чтобы добавить новое замечание, отправьте:</i>\n<code>/defect Текст вашего замечания</code>`);
        return lines.join('\n');
    } catch (e) {
        return `⚠️ Ошибка: ${e.message}`;
    }
}

// Добавление дефекта в облако (/defect <текст>)
async function addDefectToCloud(userId, defectText) {
    try {
        const cloud = await getUserCloudData(userId);
        if (!cloud || !cloud.exchange) return { ok: false, error: 'Синхронизация не найдена' };

        const targetProfile = cloud.selectedProfile || cloud.tables.profiles?.[0];
        if (!targetProfile) return { ok: false, error: 'Профиль не найден' };

        const defects = Array.isArray(targetProfile.defectTasksJson)
            ? targetProfile.defectTasksJson
            : JSON.parse(targetProfile.defectTasksJson || '[]');

        const newDefect = {
            id: crypto.randomUUID(),
            description: defectText.trim(),
            workId: '',
            createdAt: Date.now(),
            completedAt: 0
        };
        defects.push(newDefect);
        targetProfile.defectTasksJson = JSON.stringify(defects);
        targetProfile.resourcesUpdatedAt = Date.now();
        targetProfile.updatedAt = Date.now();

        // Отправляем в Supabase RPC commit
        const commitPayload = JSON.stringify({
            p_change_id: crypto.randomUUID(),
            p_expected_revision: cloud.revision,
            p_payload: cloud.exchange
        });

        const commitRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/logbook_sync_commit_v1`, {
            method: 'POST',
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${cloud.token}`, 'Content-Type': 'application/json' },
            body: commitPayload
        }).then(async res => {
            const text = await res.text();
            try { return JSON.parse(text); } catch { return text; }
        }).catch(err => ({ error: err.message }));

        if (commitRes?.error) return { ok: false, error: commitRes.error };
        return { ok: true, defect: newDefect, boardNumber: targetProfile.boardNumber };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

// 4. Отчёт по заправкам (/fuel [дней])
async function getUserFuelReport(userId, firstName, daysLimit = 7) {
    try {
        const cloud = await getUserCloudData(userId);
        if (!cloud || !cloud.tables) return `⚠️ <b>Синхронизация не найдена</b>`;

        const profile = cloud.selectedProfile || cloud.tables.profiles?.[0] || {};
        const days = (cloud.tables.days || []).filter(d => !profile.id || d.profileId === profile.id);
        const launches = cloud.tables.launches || [];

        // Собираем все заправки, группируя по уникальным датам
        const fuelEntriesByDate = new Map();
        for (const d of days) {
            const dayLaunches = launches.filter(l => l.dayId === d.id && (l.zapravkaLiters || 0) > 0);
            if (dayLaunches.length > 0) {
                if (!fuelEntriesByDate.has(d.date)) {
                    fuelEntriesByDate.set(d.date, []);
                }
                dayLaunches.forEach(l => fuelEntriesByDate.get(d.date).push({ date: d.date, ...l }));
            }
        }

        const sortedDates = Array.from(fuelEntriesByDate.keys()).sort((a, b) => (b || '').localeCompare(a || ''));

        if (sortedDates.length === 0) {
            return `⛽ <b>История заправок пуста</b>\n\nБорт <b>${profile.boardNumber || '—'}</b> не имеет записанных заправок.`;
        }

        const limit = Math.max(1, Math.min(Number(daysLimit) || 7, 100));
        const selectedDates = sortedDates.slice(0, limit);

        const recent = [];
        for (const date of selectedDates) {
            const entries = fuelEntriesByDate.get(date) || [];
            entries.sort((a, b) => (a.order || 0) - (b.order || 0));
            recent.push(...entries);
        }

        let totalLiters = 0;
        let totalKg = 0;
        let lines = [];
        const daysWord = selectedDates.length === 1 ? '1 день' : `${selectedDates.length} дн.`;
        lines.push(`⛽ <b>Отчёт по заправкам борта ${profile.boardNumber || '—'} (крайние ${daysWord})</b>`);
        lines.push(`👤 Профиль: <b>${firstName || 'Sergey'}</b>\n`);

        for (const f of recent) {
            const dateParts = (f.date || '').split('-');
            const dateStr = dateParts.length === 3 ? `${dateParts[2]}.${dateParts[1]}.${dateParts[0]}` : f.date;
            const l = f.zapravkaLiters || 0;
            const d = f.zapravkaDensity || 0;
            const kg = (l * d) > 0 ? (l * d).toFixed(1) : (l * 0.785).toFixed(1);
            const ved = f.vedCek ? ` (вед. ${f.vedCek})` : '';
            totalLiters += l;
            totalKg += (l * (d || 0.785));
            lines.push(`📅 <b>${dateStr}</b> — <b>${l} л</b> × ${d || 0.785} = <b>${kg} кг</b>${ved}`);
        }

        lines.push(`──────────`);
        lines.push(`📊 <b>ИТОГО (${recent.length} зап. за ${daysWord}):</b>`);
        lines.push(`• Всего литров: <b>${totalLiters.toLocaleString('ru-RU')} л</b>`);
        if (totalKg > 0) {
            lines.push(`• Всего килограммов: <b>${totalKg.toFixed(1).toLocaleString('ru-RU')} кг</b>`);
        }

        return lines.join('\n');
    } catch (e) {
        return `⚠️ Ошибка: ${e.message}`;
    }
}

// Безопасное вычисление выражения для СНК (числа, сложение, вычитание, скобки)
function evalSnkExpr(expr) {
    if (!expr) return null;
    const clean = String(expr).trim();
    if (!/^[0-9\+\-\*\/\.\,\(\)\s]+$/.test(clean)) return null;
    const safe = clean.replace(/,/g, '.');
    try {
        const val = Function('return (' + safe + ')')();
        if (typeof val !== 'number' || !isFinite(val)) return null;
        return { val, raw: clean };
    } catch {
        return null;
    }
}

// Перевод СНК (десятичные часы или выражение) в часы и минуты
function convertSnkToHM(input) {
    if (!input) return null;
    const evaluated = evalSnkExpr(input);
    if (!evaluated) return null;
    const num = evaluated.val;

    const sign = num < 0 ? '-' : '';
    const abs = Math.abs(num);
    const totalSeconds = Math.round(abs * 3600);
    const totalMinutes = Math.round(totalSeconds / 60);
    let hours = Math.floor(totalMinutes / 60);
    let minutes = totalMinutes % 60;

    const mmStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
    const decimalFormatted = Number.isInteger(num) ? String(num) : num.toFixed(2).replace(/\.?0+$/, '');

    return {
        original: String(input).trim(),
        decimalVal: num,
        decimalFormatted,
        hours,
        minutes,
        hm: `${sign}${hours}:${mmStr}`,
        text: `${sign}${hours}ч ${mmStr}м`
    };
}

// Расчёт времени налёта (чч:мм) для калькулятора времени
function calcTimeExpr(input) {
    if (!input || !input.trim()) return null;
    const str = input.trim();
    // Нормализуем точки и запятые в двоеточия
    const norm = str.replace(/,/g, ':').replace(/\./g, ':');
    const regex = /([+-]?)\s*(\d+)(?::([0-5]?\d))?/g;
    let match;
    let totalMinutes = 0;
    let count = 0;
    while ((match = regex.exec(norm)) !== null) {
        const sign = match[1] === '-' ? -1 : 1;
        const h = parseInt(match[2], 10);
        const m = match[3] !== undefined ? parseInt(match[3], 10) : 0;
        totalMinutes += sign * (h * 60 + m);
        count++;
    }
    if (count === 0) return null;
    const signStr = totalMinutes < 0 ? '-' : '';
    const abs = Math.abs(totalMinutes);
    const th = Math.floor(abs / 60);
    const tm = abs % 60;
    const mm = tm < 10 ? '0' + tm : '' + tm;
    return {
        hm: `${signStr}${th}:${mm}`,
        text: `${signStr}${th}ч ${mm}м`,
        totalMinutes
    };
}

// 5. Авиационный калькулятор (/calc)
function calcHelper(input) {
    if (!input || !input.trim()) {
        return `🧮 <b>Авиационный калькулятор LogBook</b>\n\n` +
            `Примеры использования:\n` +
            `• Время налёта: <code>/calc 1.45 + 0.35</code> (➔ 2ч 20м)\n` +
            `• Счётчик СНК: <code>/snk 1,45+1,61</code> (➔ 3:04)\n` +
            `• Одиночный СНК: <code>/snk 1.50</code> (➔ 1:30), <code>/snk 1,78</code> (➔ 1:47)\n` +
            `• Перевод минут: <code>/calc 105</code> (➔ 1ч 45м)\n` +
            `• Плотность топлива: <code>/calc 1650 * 0.789</code>\n\n` +
            `💡 <i>Секунды в СНК автоматически округляются до целых минут.</i>`;
    }
    const str = input.trim();

    // 0. Если в начале явно указано снк / snk
    if (/^(?:снк|snk)\s+/i.test(str)) {
        const snkRaw = str.replace(/^(?:снк|snk)\s*/i, '');
        const conv = convertSnkToHM(snkRaw);
        if (conv) {
            return `⏱ <b>Расчёт СНК (счётчик наработки):</b>\n` +
                   `<code>${escapeHtml(conv.original)}</code> = <b>${conv.hm}</b> (${conv.text})\n` +
                   `<i>(Сумма СНК: ${conv.decimalFormatted})</i>`;
        }
    }

    // 0.1 Одиночное десятичное число — показания СНК (например 1.50 или 1,78)
    const snkMatch = str.match(/^([+-]?\d+[\.,]\d+)$/);
    if (snkMatch) {
        const conv = convertSnkToHM(snkMatch[1]);
        if (conv) {
            return `⏱ <b>Перевод СНК (счётчик наработки) в чч:мм:</b>\n` +
                   `<code>${str}</code> = <b>${conv.hm}</b> (${conv.text})`;
        }
    }

    // 0.2 Выражение со сложением СНК, где доли часа > 59 (например 1,45+1,61)
    if (/[\.,](?:[6-9]\d|\d{3,})/.test(str)) {
        const conv = convertSnkToHM(str);
        if (conv) {
            return `⏱ <b>Расчёт СНК (счётчик наработки):</b>\n` +
                   `<code>${escapeHtml(conv.original)}</code> = <b>${conv.hm}</b> (${conv.text})\n` +
                   `<i>(Сумма СНК: ${conv.decimalFormatted})</i>`;
        }
    }

    // 1. Плотность топлива: 1650 0.789 или 1650*0.789 или 1650 * 0,789
    const fuelMatch = str.match(/^(\d+(?:[\.,]\d+)?)\s*[*xX\s]\s*(0[\.,]\d{2,4})$/);
    if (fuelMatch) {
        const l = parseFloat(fuelMatch[1].replace(',', '.'));
        const d = parseFloat(fuelMatch[2].replace(',', '.'));
        const kg = l * d;
        return `⛽ <b>Расчёт массы топлива:</b>\n${l} л × ${d} = <b>${kg.toFixed(2)} кг</b>`;
    }

    // 2. Время и налёт (воспринимаем «.» и «,» как «:»)
    // Преобразуем формат ЧЧ.ММ или ЧЧ,ММ в ЧЧ:ММ (где минуты 00..59)
    const normalized = str.replace(/(\d+)[\.,]([0-5]\d)/g, '$1:$2');

    // Если нет умножения/деления и есть время или сложение/вычитание
    if (!/[\*\/]/.test(normalized) && (normalized.includes(':') || normalized.includes('+') || (normalized.includes('-') && !normalized.startsWith('-')))) {
        const tokenRegex = /([+-]?)\s*(\d+(?::[0-5]\d)?)/g;
        let match;
        let totalMinutes = 0;
        let termsCount = 0;
        let hasColon = false;

        while ((match = tokenRegex.exec(normalized)) !== null) {
            if (!match[2]) continue;
            const sign = match[1] === '-' ? -1 : 1;
            const val = match[2];
            if (val.includes(':')) {
                hasColon = true;
                const [h, m] = val.split(':').map(Number);
                totalMinutes += sign * (h * 60 + m);
                termsCount++;
            } else {
                const num = parseInt(val, 10);
                if (!isNaN(num)) {
                    totalMinutes += sign * num;
                    termsCount++;
                }
            }
        }

        if (termsCount > 0 && (hasColon || termsCount > 1)) {
            const signStr = totalMinutes < 0 ? '-' : '';
            const absMins = Math.abs(totalMinutes);
            const th = Math.floor(absMins / 60);
            const tm = absMins % 60;
            const hmStr = `${signStr}${th}ч ${tm < 10 ? '0' : ''}${tm}м`;
            return `⏱ <b>Расчёт налёта:</b>\n<code>${str}</code> = <b>${hmStr}</b> (${totalMinutes} мин)`;
        }
    }

    // Если одиночное число в минутах, например /calc 105
    if (/^\d+$/.test(str)) {
        const num = parseInt(str, 10);
        const th = Math.floor(num / 60);
        const tm = num % 60;
        return `⏱ <b>Перевод минут в налёт:</b>\n${num} мин = <b>${th}ч ${tm < 10 ? '0' : ''}${tm}м</b>`;
    }

    // 3. Стандартное вычисление
    try {
        const safeExpr = str.replace(/[^0-9\+\-\*\/\.\,\(\)]/g, '').replace(',', '.');
        const res = Function('return (' + safeExpr + ')')();
        return `🧮 <b>Результат:</b>\n${str} = <b>${res}</b>`;
    } catch (e) {
        return `⚠️ Не удалось вычислить. Примеры: <code>/calc 1.45 + 0.35</code> или <code>/calc 1650 0.789</code>`;
    }
}

// 6. Резервная копия базы данных (/backup)
async function handleBackupCommand(chatId, userId) {
    try {
        const cloud = await getUserCloudData(userId);
        if (!cloud || !cloud.exchange) {
            tgRequest('sendMessage', {
                chat_id: chatId,
                text: '⚠️ Не удалось выгрузить данные из облака. Проверьте подключение.',
                reply_markup: getBackKeyboard()
            });
            return;
        }

        const boardNumber = cloud.selectedBoard || cloud.tables.profiles?.[0]?.boardNumber || 'All';
        const dateStr = new Date().toISOString().split('T')[0];
        const fileName = `LogBook_Backup_${boardNumber}_${dateStr}.json`;
        await sendDocumentToUser(
            chatId,
            fileName,
            JSON.stringify(cloud.exchange, null, 2),
            `💾 <b>Резервная копия базы данных LogBook</b>\n\n• Борт: <b>${boardNumber}</b>\n• Ревизия: <b>${cloud.revision}</b>\n• Дата: <b>${dateStr}</b>\n\nФайл сохранён в вашем Telegram.`,
            getBackKeyboard()
        );
    } catch (e) {
        tgRequest('sendMessage', {
            chat_id: chatId,
            text: `⚠️ Ошибка создания бэкапа: ${e.message}`,
            reply_markup: getBackKeyboard()
        });
    }
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Вспомогательные функции клавиатур
function getMainMenuKeyboard(selectedBoard) {
    const boardText = selectedBoard ? `✈️ Борт: ${selectedBoard}` : '✈️ Выбрать борт';
    return {
        inline_keyboard: [
            [{ text: boardText, callback_data: 'cmd_select_board' }],
            [{ text: '📑 История полётов', callback_data: 'cmd_history' }],
            [
                { text: '📊 Статус ТО', callback_data: 'cmd_status' },
                { text: '🛠 Замечания', callback_data: 'cmd_defects' }
            ],
            [
                { text: '⛽ Заправки', callback_data: 'cmd_fuel' },
                { text: '🧮 Калькулятор', callback_data: 'cmd_calc' }
            ],
            [
                { text: '💾 Бэкап базы', callback_data: 'cmd_backup' },
                { text: '📖 Все команды', callback_data: 'cmd_help' }
            ],
            [{ text: '📱 Открыть LogBook App', web_app: { url: 'https://granit1846.github.io/#tg' } }]
        ]
    };
}

function getBoardSelectionKeyboard(profiles, selectedBoard) {
    const buttons = [];
    for (const p of profiles) {
        const num = p.boardNumber || p.name;
        const isCurrent = String(num) === String(selectedBoard);
        buttons.push([{
            text: `${isCurrent ? '✅ ' : '🔘 '}Борт ${num}${p.name && p.name !== num ? ' (' + p.name + ')' : ''}`,
            callback_data: `set_board_${num}`
        }]);
    }
    buttons.push([{ text: '⬅️ Главное меню', callback_data: 'main_menu' }]);
    return {
        inline_keyboard: buttons
    };
}

// Обновление выбранного активного борта в Supabase Auth для синхронизации со всеми платформами
async function updateSelectedBoardInSupabase(token, boardNumber) {
    return fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: 'PUT',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { selected_board: String(boardNumber) } })
    }).then(() => true).catch(() => false);
}

function getBackKeyboard() {
    return {
        inline_keyboard: [
            [{ text: '⬅️ Назад', callback_data: 'main_menu' }]
        ]
    };
}

function getHistoryKeyboard() {
    return {
        inline_keyboard: [
            [
                { text: '1 день', callback_data: 'hist_1' },
                { text: '3 дня', callback_data: 'hist_3' },
                { text: '7 дней', callback_data: 'hist_7' },
                { text: '14 дней', callback_data: 'hist_14' }
            ],
            [
                { text: '⬅️ Назад', callback_data: 'main_menu' }
            ]
        ]
    };
}

function getFuelKeyboard() {
    return {
        inline_keyboard: [
            [
                { text: '1 день', callback_data: 'fuel_1' },
                { text: '3 дня', callback_data: 'fuel_3' },
                { text: '7 дней', callback_data: 'fuel_7' },
                { text: '14 дней', callback_data: 'fuel_14' }
            ],
            [
                { text: '⬅️ Назад', callback_data: 'main_menu' }
            ]
        ]
    };
}

// Набранное выражение калькулятора хранится в bot_state: каждое нажатие может обрабатываться новым экземпляром функции
const numPadSessions = {
    get: (chatId) => loadState(`tg_numpad_${chatId}`, null),
    set: (chatId, sess) => track(saveState(`tg_numpad_${chatId}`, sess))
};

function getCalcKeyboard() {
    return {
        inline_keyboard: [
            [
                { text: '⏱ Время', callback_data: 'np_open_time' },
                { text: '⏱ СНК', callback_data: 'np_open_snk' }
            ],
            [
                { text: '⬅️ Назад', callback_data: 'main_menu' }
            ]
        ]
    };
}

function getNumPadKeyboard(mode) {
    const isSnk = mode === 'snk';
    const nextModeName = isSnk ? '⏱ Перейти на Время' : '⏱ Перейти на СНК';
    const sepKey1 = isSnk ? '.' : ':';
    const sepKey2 = isSnk ? ',' : ':';
    return {
        inline_keyboard: [
            [
                { text: 'C', callback_data: 'np_c' },
                { text: '⌫', callback_data: 'np_bs' },
                { text: '+', callback_data: 'np_plus' },
                { text: '-', callback_data: 'np_minus' }
            ],
            [
                { text: '7', callback_data: 'np_7' },
                { text: '8', callback_data: 'np_8' },
                { text: '9', callback_data: 'np_9' },
                { text: '*', callback_data: 'np_mul' }
            ],
            [
                { text: '4', callback_data: 'np_4' },
                { text: '5', callback_data: 'np_5' },
                { text: '6', callback_data: 'np_6' },
                { text: '/', callback_data: 'np_div' }
            ],
            [
                { text: '1', callback_data: 'np_1' },
                { text: '2', callback_data: 'np_2' },
                { text: '3', callback_data: 'np_3' },
                { text: sepKey1, callback_data: 'np_dot' }
            ],
            [
                { text: '0', callback_data: 'np_0' },
                { text: sepKey2, callback_data: 'np_comma' },
                { text: '=', callback_data: 'np_eq' }
            ],
            [
                { text: '🔄 ' + nextModeName, callback_data: 'np_toggle' }
            ],
            [
                { text: '⬅️ К выбору режима', callback_data: 'cmd_calc' }
            ]
        ]
    };
}

function renderNumPadText(mode, expr, lastResult = null) {
    const isSnk = mode === 'snk';
    const cleanExpr = (expr || '').trim();

    let resultSection = '';
    if (cleanExpr) {
        if (isSnk) {
            const conv = convertSnkToHM(cleanExpr);
            if (conv) {
                resultSection = `\n📊 <b>Результат:</b> <code>${conv.hm}</code> (${conv.text})\n<i>(Десятичные часы: ${conv.decimalFormatted})</i>\n`;
            } else {
                resultSection = `\n<i>...ввод выражения...</i>\n`;
            }
        } else {
            // Режим Время: расчёт времени в ЧЧ:ММ (строго без перехода в СНК)
            const conv = calcTimeExpr(cleanExpr);
            if (conv) {
                resultSection = `\n📊 <b>Результат:</b> <code>${conv.hm}</code> (${conv.text})\n<i>(Всего: ${conv.totalMinutes} мин)</i>\n`;
            } else {
                resultSection = `\n<i>...ввод времени (чч:мм)...</i>\n`;
            }
        }
    } else if (lastResult) {
        if (isSnk && lastResult.decimalFormatted) {
            resultSection = `\n📊 <b>Результат:</b> <code>${lastResult.hm}</code> (${lastResult.text})\n<i>(Десятичные часы: ${lastResult.decimalFormatted})</i>\n`;
        } else if (lastResult.totalMinutes !== undefined) {
            resultSection = `\n📊 <b>Результат:</b> <code>${lastResult.hm}</code> (${lastResult.text})\n<i>(Всего: ${lastResult.totalMinutes} мин)</i>\n`;
        } else {
            resultSection = `\n📊 <b>Результат:</b> <code>${lastResult.hm || lastResult}</code>\n`;
        }
    }

    const modeTitle = isSnk ? '⏱ Счётчик СНК' : '⏱ Время налёта';
    const modeHint = isSnk
        ? '<i>(Сложение долей часа до перевода в чч:мм, напр. 1,45+1,61 = 3:04)</i>'
        : '<i>(Сложение налёта в формате чч:мм, напр. 1:45 + 0:35 = 2ч 20м)</i>';

    const inputDisplay = cleanExpr ? `<code>${escapeHtml(cleanExpr)}</code>` : '<i>(нажимайте кнопки с цифрами)</i>';

    return `🧮 <b>Калькулятор: ${modeTitle}</b>\n${modeHint}\n\n` +
           `📝 <b>Ввод:</b> ${inputDisplay}\n` +
           resultSection;
}

function getCommandsHelpText() {
    return `📖 <b>Список доступных команд:</b>\n\n` +
           `• <code>/board [номер]</code> — выбрать активный борт\n` +
           `• <code>/history [дней]</code> — история полётов (по умолч. 7 дн.)\n` +
           `• <code>/fuel [дней]</code> — сводка заправок (по умолч. 7 дн.)\n` +
           `• <code>/status</code> — остатки ТО, агрегатов и масел\n` +
           `• <code>/defects</code> — открытые замечания по борту\n` +
           `• <code>/defect &lt;текст&gt;</code> — добавить замечание в журнал\n` +
           `• <code>/calc &lt;выражение&gt;</code> — авиакалькулятор (налёт, топливо)\n` +
           `• <code>/snk &lt;значение&gt;</code> — перевод показаний СНК в чч:мм\n` +
           `• <code>/id</code> — узнать свой Telegram ID (для связи с MAX)\n` +
           `• <code>/backup</code> — скачать резервную копию базы (JSON)\n` +
           `• <code>/start</code> — главное меню`;
}

function getMainMenuText(firstName, boardNumber) {
    const boardLine = boardNumber ? `📌 Активный борт: <b>${boardNumber}</b>\n\n` : `\n`;
    return `✈️ <b>Главное меню LogBook</b>\n\n` +
           `👋 Привет, <b>${firstName || 'пилот'}</b>!\n` +
           boardLine +
           `Выберите раздел с помощью кнопок:`;
}

async function sendOrEdit(chatId, messageId, text, replyMarkup) {
    if (messageId) {
        const res = await tgRequest('editMessageText', {
            chat_id: chatId,
            message_id: messageId,
            text: text,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            reply_markup: replyMarkup
        });
        if (res && res.ok) return res;
        if (res && res.description && res.description.includes('message is not modified')) {
            return res;
        }
    }
    return await tgRequest('sendMessage', {
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: replyMarkup
    });
}

async function handleUpdate(update) {
    // 0. Инлайн-калькулятор на лету (inline_query)
    if (update.inline_query) {
        const iq = update.inline_query;
        const rawQ = (iq.query || '').trim();

        // 0.1 Режим СНК (вызывается кнопкой «⏱ СНК»)
        if (/^(?:снк|snk)\b/i.test(rawQ)) {
            const snkExpr = rawQ.replace(/^(?:снк|snk)\s*/i, '').trim();
            if (!snkExpr) {
                tgRequest('answerInlineQuery', {
                    inline_query_id: iq.id,
                    results: [
                        {
                            type: 'article',
                            id: 'snk_prompt',
                            title: '⏱ Счётчик наработки (СНК)',
                            description: 'Введите выражение или число: 1,45+1,61 или 1.50',
                            input_message_content: {
                                message_text: '💡 <b>Счётчик СНК:</b> введите выражение, например <code>/snk 1,45+1,61</code>',
                                parse_mode: 'HTML'
                            }
                        }
                    ],
                    cache_time: 1
                });
                return;
            }

            const conv = convertSnkToHM(snkExpr);
            if (conv) {
                const title = `⏱ СНК: ${conv.hm} (${conv.text})`;
                const desc = `${conv.original} = ${conv.hm} [СНК: ${conv.decimalFormatted}]`;
                const msgText = `⏱ <b>Расчёт СНК (счётчик наработки):</b>\n<code>${escapeHtml(conv.original)}</code> = <b>${conv.hm}</b> (${conv.text})\n<i>(Десятичные часы: ${conv.decimalFormatted})</i>`;
                tgRequest('answerInlineQuery', {
                    inline_query_id: iq.id,
                    results: [
                        {
                            type: 'article',
                            id: 'snk_' + Date.now(),
                            title: title,
                            description: desc,
                            input_message_content: {
                                message_text: msgText,
                                parse_mode: 'HTML'
                            }
                        }
                    ],
                    cache_time: 1
                });
                return;
            }
        }

        // 0.2 Режим Время (вызывается кнопкой «⏱ Время»)
        const expr = rawQ.replace(/^\/(?:calc|calk|кальк|калк|время|time)\s*/i, '').trim();

        if (!expr) {
            tgRequest('answerInlineQuery', {
                inline_query_id: iq.id,
                results: [
                    {
                        type: 'article',
                        id: 'calc_prompt',
                        title: '⏱ Авиакалькулятор (Время)',
                        description: 'Введите выражение: например 1.45 + 0.35 или 1650 * 0.789',
                        input_message_content: {
                            message_text: '💡 <b>Калькулятор времени:</b> введите выражение, например <code>/calc 1.45 + 0.35</code>',
                            parse_mode: 'HTML'
                        }
                    }
                ],
                cache_time: 1
            });
            return;
        }

        const calcRes = calcHelper(expr);
        const firstLine = calcRes.replace(/<[^>]+>/g, '').split('\n')[0];
        const desc = calcRes.replace(/<[^>]+>/g, '').split('\n').slice(1).join(' ') || firstLine;

        tgRequest('answerInlineQuery', {
            inline_query_id: iq.id,
            results: [
                {
                    type: 'article',
                    id: 'calc_' + Date.now(),
                    title: firstLine,
                    description: desc,
                    input_message_content: {
                        message_text: calcRes,
                        parse_mode: 'HTML'
                    }
                }
            ],
            cache_time: 1
        });
        return;
    }

    // 1. Обработка нажатий inline-кнопок (callback_query)
    if (update.callback_query) {
        const cq = update.callback_query;
        const queryId = cq.id;
        const chatId = cq.message?.chat?.id;
        const messageId = cq.message?.message_id;
        const userId = cq.from ? cq.from.id : chatId;
        const firstName = cq.from?.first_name || '';
        const data = cq.data || '';

        if (!data.startsWith('np_') || data === 'np_open_time' || data === 'np_open_snk') {
            tgRequest('answerCallbackQuery', { callback_query_id: queryId }).catch(() => {});
        }

        if (data === 'main_menu') {
            const cloud = await getUserCloudData(userId);
            const board = cloud?.selectedBoard || cloud?.tables?.profiles?.[0]?.boardNumber || '';
            await sendOrEdit(chatId, messageId, getMainMenuText(firstName, board), getMainMenuKeyboard(board));
            return;
        }

        if (data === 'cmd_select_board') {
            const cloud = await getUserCloudData(userId);
            const profiles = cloud?.tables?.profiles || [];
            if (profiles.length === 0) {
                await sendOrEdit(chatId, messageId, '⚠️ В базе данных пока нет профилей бортов. Создайте профиль в приложении LogBook.', getBackKeyboard());
                return;
            }
            await sendOrEdit(
                chatId,
                messageId,
                `✈️ <b>Выбор активного борта</b>\n\nТекущий борт: <b>${cloud.selectedBoard || 'не выбран'}</b>\n\nВыберите нужный борт из списка:`,
                getBoardSelectionKeyboard(profiles, cloud.selectedBoard)
            );
            return;
        }

        if (data.startsWith('set_board_')) {
            const targetBoard = data.replace('set_board_', '').trim();
            const cloud = await getUserCloudData(userId);
            const profiles = cloud?.tables?.profiles || [];
            const found = profiles.find(p => String(p.boardNumber) === targetBoard || String(p.name) === targetBoard);

            if (!found) {
                await sendOrEdit(chatId, messageId, `⚠️ Борт «${targetBoard}» не найден в вашей базе данных.`, getBackKeyboard());
                return;
            }

            const newBoardNumber = String(found.boardNumber || found.name);
            if (cloud.token) {
                await updateSelectedBoardInSupabase(cloud.token, newBoardNumber);
            }

            await sendOrEdit(
                chatId,
                messageId,
                `✅ <b>Активный борт успешно переключён на: ${newBoardNumber}</b>\n\nВсе отчёты (история полётов, остатки ТО, заправки и замечания) отображаются по борту <b>${newBoardNumber}</b>.`,
                getMainMenuKeyboard(newBoardNumber)
            );
            return;
        }

        if (data === 'cmd_history' || data.startsWith('hist_')) {
            const days = data.startsWith('hist_') ? (parseInt(data.replace('hist_', ''), 10) || 7) : 7;
            const report = await getUserFlightHistoryReport(userId, firstName, days);
            await sendOrEdit(chatId, messageId, report, getHistoryKeyboard());
            return;
        }

        if (data === 'cmd_fuel' || data.startsWith('fuel_')) {
            const days = data.startsWith('fuel_') ? (parseInt(data.replace('fuel_', ''), 10) || 7) : 7;
            const report = await getUserFuelReport(userId, firstName, days);
            await sendOrEdit(chatId, messageId, report, getFuelKeyboard());
            return;
        }

        if (data === 'cmd_status') {
            const report = await getUserStatusReport(userId, firstName);
            await sendOrEdit(chatId, messageId, report, getBackKeyboard());
            return;
        }

        if (data === 'cmd_defects') {
            const report = await getUserDefectsReport(userId, firstName);
            await sendOrEdit(chatId, messageId, report, getBackKeyboard());
            return;
        }

        if (data === 'cmd_calc') {
            const calcHelp = `🧮 <b>Авиакалькулятор LogBook</b>\n\n` +
                `Выберите режим для ввода на цифровой панели:\n\n` +
                `• <b>⏱ Время</b> — сложение/вычитание налёта (чч:мм):\n` +
                `  <i>Пример: 1.45 + 0.35 (➔ 2ч 20м)</i>\n\n` +
                `• <b>⏱ СНК</b> — счётчик наработки (сложение до перевода в чч:мм):\n` +
                `  <i>Пример: 1,45+1,61 = 3.06 (➔ 3:04)</i>\n\n` +
                `<i>После выбора откроется интерактивная цифровая клавиатура прямо в сообщении.</i>`;
            await sendOrEdit(chatId, messageId, calcHelp, getCalcKeyboard());
            return;
        }

        if (data === 'np_open_time' || data === 'np_open_snk') {
            const mode = data === 'np_open_snk' ? 'snk' : 'time';
            numPadSessions.set(chatId, { mode, expr: '', lastResult: null });
            await sendOrEdit(chatId, messageId, renderNumPadText(mode, '', null), getNumPadKeyboard(mode));
            return;
        }

        if (data.startsWith('np_')) {
            const sess = (await numPadSessions.get(chatId)) || { mode: 'time', expr: '', lastResult: null };
            const action = data.replace('np_', '');

            if (action === 'toggle') {
                sess.mode = sess.mode === 'snk' ? 'time' : 'snk';
                sess.expr = '';
                sess.lastResult = null;
                tgRequest('answerCallbackQuery', { callback_query_id: queryId }).catch(() => {});
            } else if (action === 'c') {
                sess.expr = '';
                sess.lastResult = null;
                tgRequest('answerCallbackQuery', { callback_query_id: queryId }).catch(() => {});
            } else if (action === 'bs') {
                if (sess.expr.endsWith(' ')) {
                    sess.expr = sess.expr.replace(/\s*[\+\-\*\/]\s*$/, '');
                } else if (sess.expr) {
                    sess.expr = sess.expr.slice(0, -1);
                } else {
                    sess.lastResult = null;
                }
                tgRequest('answerCallbackQuery', { callback_query_id: queryId }).catch(() => {});
            } else if (/^[0-9]$/.test(action)) {
                if (!sess.expr && sess.lastResult) {
                    sess.lastResult = null;
                }
                sess.expr += action;
                tgRequest('answerCallbackQuery', { callback_query_id: queryId }).catch(() => {});
            } else if (action === 'dot') {
                if (!sess.expr && sess.lastResult) {
                    sess.lastResult = null;
                }
                if (sess.mode === 'time') {
                    if (!sess.expr.endsWith(':')) sess.expr += ':';
                } else {
                    if (!sess.expr.endsWith('.')) sess.expr += '.';
                }
                tgRequest('answerCallbackQuery', { callback_query_id: queryId }).catch(() => {});
            } else if (action === 'comma') {
                if (!sess.expr && sess.lastResult) {
                    sess.lastResult = null;
                }
                if (sess.mode === 'time') {
                    if (!sess.expr.endsWith(':')) sess.expr += ':';
                } else {
                    if (!sess.expr.endsWith(',')) sess.expr += ',';
                }
                tgRequest('answerCallbackQuery', { callback_query_id: queryId }).catch(() => {});
            } else if (action === 'plus') {
                if (!sess.expr && sess.lastResult) {
                    sess.expr = (sess.lastResult.hm || '') + ' + ';
                    sess.lastResult = null;
                } else if (sess.expr && !sess.expr.endsWith(' ')) {
                    sess.expr += ' + ';
                }
                tgRequest('answerCallbackQuery', { callback_query_id: queryId }).catch(() => {});
            } else if (action === 'minus') {
                if (!sess.expr && sess.lastResult) {
                    sess.expr = (sess.lastResult.hm || '') + ' - ';
                    sess.lastResult = null;
                } else if (sess.expr && !sess.expr.endsWith(' ')) {
                    sess.expr += ' - ';
                } else if (!sess.expr) {
                    sess.expr = '-';
                }
                tgRequest('answerCallbackQuery', { callback_query_id: queryId }).catch(() => {});
            } else if (action === 'mul') {
                if (!sess.expr && sess.lastResult) {
                    sess.expr = (sess.lastResult.hm || '') + ' * ';
                    sess.lastResult = null;
                } else if (sess.expr && !sess.expr.endsWith(' ')) {
                    sess.expr += ' * ';
                }
                tgRequest('answerCallbackQuery', { callback_query_id: queryId }).catch(() => {});
            } else if (action === 'div') {
                if (!sess.expr && sess.lastResult) {
                    sess.expr = (sess.lastResult.hm || '') + ' / ';
                    sess.lastResult = null;
                } else if (sess.expr && !sess.expr.endsWith(' ')) {
                    sess.expr += ' / ';
                }
                tgRequest('answerCallbackQuery', { callback_query_id: queryId }).catch(() => {});
            } else if (action === 'eq') {
                let toast = '';
                if (sess.mode === 'snk') {
                    const conv = convertSnkToHM(sess.expr);
                    if (conv) {
                        toast = `${conv.original} = ${conv.hm} (${conv.text})`;
                        sess.lastResult = conv;
                        sess.expr = ''; // Очищаем ввод, на экране остаётся только результат
                    } else if (sess.lastResult) {
                        toast = `${sess.lastResult.hm} (${sess.lastResult.text})`;
                    } else {
                        toast = 'Введите выражение';
                    }
                } else {
                    const conv = calcTimeExpr(sess.expr);
                    if (conv) {
                        toast = `${conv.original} = ${conv.hm} (${conv.text})`;
                        sess.lastResult = conv;
                        sess.expr = ''; // Очищаем ввод, на экране остаётся только результат
                    } else if (sess.lastResult) {
                        toast = `${sess.lastResult.hm} (${sess.lastResult.text})`;
                    } else {
                        const res = calcHelper(sess.expr);
                        const cleanRes = res.replace(/<[^>]+>/g, '').split('\n').filter(Boolean).slice(-1)[0];
                        toast = cleanRes || 'Готово';
                        sess.expr = '';
                    }
                }
                tgRequest('answerCallbackQuery', { callback_query_id: queryId, text: toast }).catch(() => {});
                numPadSessions.set(chatId, sess);
                await sendOrEdit(chatId, messageId, renderNumPadText(sess.mode, sess.expr, sess.lastResult), getNumPadKeyboard(sess.mode));
                return;
            }

            numPadSessions.set(chatId, sess);
            await sendOrEdit(chatId, messageId, renderNumPadText(sess.mode, sess.expr, sess.lastResult), getNumPadKeyboard(sess.mode));
            return;
        }

        if (data === 'cmd_help') {
            await sendOrEdit(chatId, messageId, getCommandsHelpText(), getBackKeyboard());
            return;
        }

        if (data === 'cmd_backup') {
            await handleBackupCommand(chatId, userId);
            return;
        }

        return;
    }

    const message = update.message;
    if (!message || !message.text) return;

    const chatId = message.chat.id;
    const userId = message.from ? message.from.id : chatId;
    // The MAX bot's link button opens /start maxlink_<MAX_ID>; it is the same request as /link <MAX_ID>.
    const text = message.text.trim().replace(/^\/start\s+maxlink_(\d+)$/, '/link $1');

    console.log(`[Сообщение] От: ${chatId} (@${message.from?.username || 'no_user'}): ${text}`);

    // 1. Команда /start (включая Deep Linking авторизацию)
    if (text.startsWith('/start')) {
        let authCode = null;
        const parts = text.split(/\s+/);
        if (parts.length > 1 && (parts[1].startsWith('auth_') || parts[1].startsWith('link_'))) {
            authCode = parts[1].trim();
        } else if (text.startsWith('auth_') || text.startsWith('link_')) {
            authCode = text.trim();
        }

        let subs = await loadSubscribers();
        const exists = subs.find(s => s.chatId === chatId);
        if (!exists) {
            subs.push({
                chatId: chatId,
                userId: userId,
                username: message.from?.username || '',
                firstName: message.from?.first_name || '',
                date: new Date().toISOString()
            });
            saveSubscribers(subs);
            console.log(`➕ Новый подписчик: ${chatId} (@${message.from?.username || 'no_user'})`);
        }

        const cloud = await getUserCloudData(userId);
        const board = cloud?.selectedBoard || cloud?.tables?.profiles?.[0]?.boardNumber || '';

        if (authCode) {
            console.log(`🔑 Подтверждение авторизации: код ${authCode} для ${userId} (${message.from?.first_name})...`);
            const confirmed = await confirmTelegramAuthInSupabase(authCode, userId);
            if (!confirmed) {
                tgRequest('sendMessage', { chat_id: chatId, text: 'Код входа не найден или срок его действия истёк. Запросите новый код в приложении.' });
                return;
            }

            tgRequest('sendMessage', {
                chat_id: chatId,
                text: `✅ <b>Вход в LogBook подтверждён!</b>\n\nДобро пожаловать, <b>${message.from?.first_name || 'пилот'}</b>!\nВы можете вернуться в приложение LogBook на телефоне или ПК — вход уже выполнен автоматически.`,
                parse_mode: 'HTML',
                reply_markup: getMainMenuKeyboard(board)
            });
            return;
        }

        tgRequest('sendMessage', {
            chat_id: chatId,
            text: getMainMenuText(message.from?.first_name || '', board),
            parse_mode: 'HTML',
            reply_markup: getMainMenuKeyboard(board)
        });
        return;
    }

    // 1.1 Команда /board [номер]
    const boardMatch = text.match(/^\/(?:board|борт)(?:@[a-zA-Z0-9_]+)?(?:\s+(.+))?$/i);
    if (boardMatch) {
        const targetBoard = boardMatch[1] ? boardMatch[1].trim() : null;
        const cloud = await getUserCloudData(userId);
        const profiles = cloud?.tables?.profiles || [];

        if (profiles.length === 0) {
            tgRequest('sendMessage', {
                chat_id: chatId,
                text: '⚠️ В базе данных пока нет профилей бортов. Создайте профиль в приложении LogBook.',
                parse_mode: 'HTML',
                reply_markup: getBackKeyboard()
            });
            return;
        }

        if (!targetBoard) {
            tgRequest('sendMessage', {
                chat_id: chatId,
                text: `✈️ <b>Выбор активного борта</b>\n\nТекущий борт: <b>${cloud.selectedBoard || 'не выбран'}</b>\n\nВыберите нужный борт из списка:`,
                parse_mode: 'HTML',
                reply_markup: getBoardSelectionKeyboard(profiles, cloud.selectedBoard)
            });
            return;
        }

        const found = profiles.find(p => String(p.boardNumber) === targetBoard || String(p.name) === targetBoard);
        if (!found) {
            tgRequest('sendMessage', {
                chat_id: chatId,
                text: `⚠️ Борт «${targetBoard}» не найден в вашей базе данных.`,
                parse_mode: 'HTML',
                reply_markup: getBackKeyboard()
            });
            return;
        }

        const newBoardNumber = String(found.boardNumber || found.name);
        if (cloud.token) {
            await updateSelectedBoardInSupabase(cloud.token, newBoardNumber);
        }

        tgRequest('sendMessage', {
            chat_id: chatId,
            text: `✅ <b>Активный борт успешно переключён на: ${newBoardNumber}</b>\n\nВсе отчёты (история полётов, остатки ТО, заправки и замечания) отображаются по борту <b>${newBoardNumber}</b>.`,
            parse_mode: 'HTML',
            reply_markup: getMainMenuKeyboard(newBoardNumber)
        });
        return;
    }

    // 2. Команда /history [число] (по умолчанию 7 дней)
    const histMatch = text.match(/^\/(?:history|histori|история)(?:@[a-zA-Z0-9_]+)?(?:\s+(\d+))?$/i);
    if (histMatch) {
        const daysLimit = histMatch[1] ? parseInt(histMatch[1], 10) : 7;
        const report = await getUserFlightHistoryReport(userId, message.from?.first_name || '', daysLimit);
        tgRequest('sendMessage', {
            chat_id: chatId,
            text: report,
            parse_mode: 'HTML',
            reply_markup: getHistoryKeyboard()
        });
        return;
    }

    // 3. Команда /status (остатки ресурсов, ТО, масла)
    const lowerText = text.toLowerCase();
    if (lowerText === '/status' || lowerText === '/статус' || lowerText === '/remains' || lowerText === '/остатки' || lowerText.startsWith('/status@')) {
        const report = await getUserStatusReport(userId, message.from?.first_name || '');
        tgRequest('sendMessage', {
            chat_id: chatId,
            text: report,
            parse_mode: 'HTML',
            reply_markup: getBackKeyboard()
        });
        return;
    }

    // 4. Команда /defects (просмотр замечаний)
    if (lowerText === '/defects' || lowerText === '/дефекты' || lowerText === '/замечания' || lowerText.startsWith('/defects@')) {
        const report = await getUserDefectsReport(userId, message.from?.first_name || '');
        tgRequest('sendMessage', {
            chat_id: chatId,
            text: report,
            parse_mode: 'HTML',
            reply_markup: getBackKeyboard()
        });
        return;
    }

    // 5. Команда /defect (добавление замечания)
    if (lowerText.startsWith('/defect') || lowerText.startsWith('/дефект')) {
        const cmd = lowerText.startsWith('/defect') ? '/defect' : '/дефект';
        const defectText = text.slice(text.indexOf(cmd) + cmd.length).trim();
        if (!defectText) {
            tgRequest('sendMessage', {
                chat_id: chatId,
                text: '💡 Чтобы добавить замечание, укажите его текст, например:\n<code>/defect Заменить лампу фары левого крыла</code>',
                parse_mode: 'HTML',
                reply_markup: getBackKeyboard()
            });
            return;
        }

        const res = await addDefectToCloud(userId, defectText);
        if (res.ok) {
            tgRequest('sendMessage', {
                chat_id: chatId,
                text: `✅ <b>Замечание успешно добавлено!</b>\n\n• Борт: <b>${res.boardNumber || '—'}</b>\n• Текст: <i>${defectText}</i>\n\nЗамечание синхронизировано и отобразится в приложении LogBook.`,
                parse_mode: 'HTML',
                reply_markup: getBackKeyboard()
            });
        } else {
            tgRequest('sendMessage', {
                chat_id: chatId,
                text: `⚠️ Не удалось сохранить замечание: ${res.error || 'неизвестная ошибка'}`,
                reply_markup: getBackKeyboard()
            });
        }
        return;
    }

    // 6. Команда /fuel [дней] (сводка и история заправок, по умолчанию 7 дней)
    const fuelMatch = text.match(/^\/(?:fuel|топливо|заправка|заправки)(?:@[a-zA-Z0-9_]+)?(?:\s+(\d+))?$/i);
    if (fuelMatch) {
        const limit = fuelMatch[1] ? parseInt(fuelMatch[1], 10) : 7;
        const report = await getUserFuelReport(userId, message.from?.first_name || '', limit);
        tgRequest('sendMessage', {
            chat_id: chatId,
            text: report,
            parse_mode: 'HTML',
            reply_markup: getFuelKeyboard()
        });
        return;
    }

    // 7. Команда /calc / /calk (авиационный калькулятор)
    if (lowerText.startsWith('/calc') || lowerText.startsWith('/calk') || lowerText.startsWith('/кальк') || lowerText.startsWith('/калк') || lowerText.startsWith('/время') || lowerText.startsWith('время ')) {
        const cmd = lowerText.startsWith('/calc') ? '/calc' : (lowerText.startsWith('/calk') ? '/calk' : (lowerText.startsWith('/кальк') ? '/кальк' : (lowerText.startsWith('/калк') ? '/калк' : (lowerText.startsWith('/время') ? '/время' : 'время'))));
        const rawExpr = text.slice(text.toLowerCase().indexOf(cmd) + cmd.length);
        const expr = rawExpr.replace(/^@[a-zA-Z0-9_]+/, '').trim();
        const res = calcHelper(expr);
        tgRequest('sendMessage', {
            chat_id: chatId,
            text: res,
            parse_mode: 'HTML',
            reply_markup: getCalcKeyboard()
        });
        return;
    }

    // 7.1 Команда /snk / /снк (перевод СНК в чч:мм и сложение значений СНК)
    if (lowerText.startsWith('/snk') || lowerText.startsWith('/снк') || lowerText.startsWith('snk ') || lowerText.startsWith('снк ')) {
        const rawVal = text.replace(/^(?:@[a-zA-Z0-9_]+\s*)?(?:\/snk|\/снк|snk|снк)\s*/i, '').trim();
        if (!rawVal) {
            tgRequest('sendMessage', {
                chat_id: chatId,
                text: '💡 Укажите значение или выражение СНК, например:\n<code>/snk 1.50</code> ➔ 1:30\n<code>/snk 1,45+1,61</code> ➔ 3:04',
                parse_mode: 'HTML',
                reply_markup: getCalcKeyboard()
            });
            return;
        }
        const conv = convertSnkToHM(rawVal);
        if (conv) {
            tgRequest('sendMessage', {
                chat_id: chatId,
                text: `⏱ <b>Расчёт СНК (счётчик наработки):</b>\n<code>${escapeHtml(conv.original)}</code> = <b>${conv.hm}</b> (${conv.text})\n<i>(Десятичные часы: ${conv.decimalFormatted})</i>`,
                parse_mode: 'HTML',
                reply_markup: getCalcKeyboard()
            });
        } else {
            tgRequest('sendMessage', {
                chat_id: chatId,
                text: `⚠️ Не удалось распознать выражение: <code>${escapeHtml(rawVal)}</code>`,
                parse_mode: 'HTML',
                reply_markup: getCalcKeyboard()
            });
        }
        return;
    }

    // 7.2 Команда /id (узнать свой Telegram ID для связи с MAX)
    if (lowerText === '/id' || lowerText === '/myid' || lowerText === '/профиль' || lowerText.startsWith('/id@')) {
        tgRequest('sendMessage', {
            chat_id: chatId,
            text: `👤 <b>Ваш Telegram ID:</b> <code>${userId}</code>\n\nДля безопасной привязки MAX узнайте свой MAX ID командой /id и отправьте сюда /link MAX_ID.`,
            parse_mode: 'HTML',
            reply_markup: getBackKeyboard()
        });
        return;
    }

    // 7.3 Команда /link (привязать профиль MAX к текущему Telegram ID)
    if (lowerText.startsWith('/link') || lowerText.startsWith('/связать')) {
        const parts = text.trim().split(/\s+/);
        const maxId = parts[1] ? Number(parts[1]) : null;
        if (!Number.isSafeInteger(maxId) || maxId <= 0) {
            tgRequest('sendMessage', {
                chat_id: chatId,
                text: `❓ <b>Как привязать MAX:</b>\n\n1. В боте MAX отправьте /id.\n2. Здесь отправьте /link ВАШ_MAX_ID.\n3. Полученный код отправьте в MAX командой /link КОД.`,
                parse_mode: 'HTML',
                reply_markup: getBackKeyboard()
            });
            return;
        }

        const requests = await loadState('max_link_requests', []);
        const valid = requests.filter(request => request.expiresAt > Date.now() && request.maxId !== maxId);
        const code = randomHex(16);
        valid.push({ code, maxId, telegramId: userId, expiresAt: Date.now() + 10 * 60 * 1000 });
        await saveState('max_link_requests', valid);
        tgRequest('sendMessage', {
            chat_id: chatId,
            text: `🔐 Код привязки MAX: <code>${code}</code>\n\nОтправьте в MAX: <code>/link ${code}</code>\nКод действует 10 минут.`,
            parse_mode: 'HTML',
            reply_markup: getBackKeyboard()
        });
        return;
    }

    // 8. Команда /backup (выгрузка резервной копии JSON)
    if (lowerText === '/backup' || lowerText === '/бэкап' || lowerText.startsWith('/backup@') || lowerText.startsWith('/бэкап@')) {
        await handleBackupCommand(chatId, userId);
        return;
    }

    // 9. Команда /stats (только для админа)
    if (lowerText === '/stats' || lowerText.startsWith('/stats@') || lowerText.startsWith('/stats ') || lowerText === '/статистика') {
        if (ADMIN_ID && Number(userId) !== Number(ADMIN_ID)) {
            tgRequest('sendMessage', {
                chat_id: chatId,
                text: '⛔ У вас нет прав для выполнения этой команды.'
            });
            return;
        }
        const subs = await loadSubscribers();
        tgRequest('sendMessage', {
            chat_id: chatId,
            text: `📊 <b>Статистика пользователей</b>:\nВсего зарегистрировано в боте: <b>${subs.length}</b> чел.`,
            parse_mode: 'HTML'
        });
        return;
    }

    // 10. Команда /update (только для админа)
    if (lowerText.startsWith('/update') || lowerText.startsWith('/обновить') || lowerText.startsWith('/обновление')) {
        if (ADMIN_ID && Number(userId) !== Number(ADMIN_ID)) {
            tgRequest('sendMessage', {
                chat_id: chatId,
                text: '⛔ У вас нет прав для выполнения этой команды.'
            });
            return;
        }

        const subs = await loadSubscribers();
        if (subs.length === 0) {
            tgRequest('sendMessage', {
                chat_id: chatId,
                text: '⚠️ Список пользователей пуст. Никто ещё не нажал /start в боте.'
            });
            return;
        }

        let customText = text.replace(/^\/(?:update|обновить|обновление)(?:@[a-zA-Z0-9_]+)?/i, '').trim();
        let broadcastText = '';
        let downloadUrl = 'https://github.com/Granit1846/LogBook-Android/releases/latest';

        if (customText) {
            broadcastText = `🚀 <b>Обновление LogBook!</b>\n\n${escapeHtml(customText)}`;
        } else {
            tgRequest('sendMessage', { chat_id: chatId, text: '⏳ Загружаю данные о последнем релизе с GitHub...' });
            const rel = await getLatestGitHubRelease();
            if (rel) {
                const tag = escapeHtml(rel.tag_name || 'новой версии');
                const rawNotes = rel.body ? `\n\n${escapeHtml(rel.body)}` : '';
                broadcastText = `🚀 <b>Вышло обновление LogBook ${tag}!</b>${rawNotes}`;
                if (rel.html_url) downloadUrl = rel.html_url;
            } else {
                broadcastText = `🚀 <b>Вышло обновление LogBook!</b>\n\nОбновите приложение внутри программы («О приложении» → «Проверить обновления»).`;
            }
        }

        tgRequest('sendMessage', {
            chat_id: chatId,
            text: `📢 Начинаю рассылку для <b>${subs.length}</b> пользователей...`,
            parse_mode: 'HTML'
        });

        let success = 0;
        let blocked = 0;

        for (const sub of subs) {
            try {
                const res = await tgRequest('sendMessage', {
                    chat_id: sub.chatId,
                    text: broadcastText,
                    parse_mode: 'HTML',
                    disable_web_page_preview: true,
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '📲 Скачать обновление', url: downloadUrl }
                            ]
                        ]
                    }
                });

                if (res.ok) {
                    success++;
                } else {
                    blocked++;
                }
                await sleep(50);
            } catch (err) {
                blocked++;
            }
        }

        tgRequest('sendMessage', {
            chat_id: chatId,
            text: `✅ <b>Рассылка завершена!</b>\n\n• Доставлено: <b>${success}</b>\n• Не доставлено / заблокировано: <b>${blocked}</b>`,
            parse_mode: 'HTML'
        });
        return;
    }

    // Если команда со слэшем не распознана
    if (text.startsWith('/')) {
        tgRequest('sendMessage', {
            chat_id: chatId,
            text: `❓ Неизвестная команда: <code>${escapeHtml(text)}</code>\n\nИспользуйте /start для перехода в главное меню.`,
            parse_mode: 'HTML',
            reply_markup: getBackKeyboard()
        });
    }
}

// Регистрация вебхука, кнопки Mini App и подсказок команд (вызывается один раз при переключении)
export async function setupBot(webhookUrl, secret) {
    const webhook = await tgRequest('setWebhook', {
        url: webhookUrl,
        secret_token: secret,
        allowed_updates: ['message', 'callback_query', 'inline_query'],
        // One update at a time: fast calculator presses must not read and write the same state concurrently.
        max_connections: 1,
        drop_pending_updates: false
    });
    const menu = await tgRequest('setChatMenuButton', {
        menu_button: { type: 'web_app', text: 'Открыть', web_app: { url: 'https://granit1846.github.io/#tg' } }
    });
    const commands = await tgRequest('setMyCommands', {
        commands: [
            { command: 'start', description: 'Главное меню с кнопками' },
            { command: 'board', description: 'Выбрать активный борт: /board [номер]' },
            { command: 'history', description: 'История полётов: /history [дней]' },
            { command: 'status', description: 'Остатки ТО, масла, налёт планера' },
            { command: 'defects', description: 'Журнал замечаний по борту' },
            { command: 'defect', description: 'Добавить замечание: /defect <текст>' },
            { command: 'fuel', description: 'Сводка заправок: /fuel [записей]' },
            { command: 'calc', description: 'Авиакалькулятор: /calc <выражение>' },
            { command: 'backup', description: 'Резервная копия базы данных (JSON)' },
            { command: 'stats', description: 'Статистика (админ)' },
            { command: 'update', description: 'Рассылка обновлений (админ)' }
        ]
    });
    return { webhook, menu, commands };
}

// Возврат к опросу с ПК: снять вебхук
export function teardownBot() {
    return tgRequest('deleteWebhook', { drop_pending_updates: false });
}

export { handleUpdate };
