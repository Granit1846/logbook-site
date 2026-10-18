/**
 * MAX Messenger Bot for LogBook App
 *
 * Поддержка платформы MAX (platform-api2.max.ru):
 * /start - Приветствие и справка
 * /history - История полётов за крайние 7 дней
 * /status - Остатки ресурсов, регламентов ТО и масел
 * /defects - Открытые замечания по борту
 * /defect <текст> - Добавление замечания в журнал
 * /fuel - Отчёт по заправкам
 * /calc <выражение> - Авиационный калькулятор
 * /backup - Выгрузка резервной копии базы данных (JSON)
 * /stats - Статистика подписчиков (только для админа)
 * /update - Рассылка релиза или сообщения (только для админа)
 */

// Supabase Edge Function webhook; network and storage go through ../_shared/bot_runtime.ts.
import { track, loadState, saveState, updateState, getBotToken, getPlatformSession, confirmPlatformCode, SUPABASE_URL as RUNTIME_SUPABASE_URL } from '../_shared/bot_runtime.ts';
import { maxHttpClient } from '../_shared/ru_root_ca.ts';

const MAX_BOT_TOKEN = await getBotToken('max');
const ADMIN_ID = Number(Deno.env.get('ADMIN_ID')) || 891159880;

// Подписчики MAX хранятся в таблице bot_state
function loadSubscribers() {
    return loadState('max_subscribers', []);
}

function saveSubscribers(list) {
    return track(saveState('max_subscribers', list));
}

// Запрос к MAX Platform API (сертификат API выдан российским корневым центром, см. ru_root_ca.ts)
function maxRequest(method, endpoint, payload = null) {
    return track(fetch(`https://platform-api2.max.ru${endpoint}`, {
        method,
        headers: payload
            ? { Authorization: MAX_BOT_TOKEN, 'Content-Type': 'application/json; charset=utf-8' }
            : { Authorization: MAX_BOT_TOKEN },
        body: payload ? JSON.stringify(payload) : undefined,
        client: maxHttpClient,
        signal: AbortSignal.timeout(25000)
    }).then(res => res.json()).catch(err => ({ ok: false, error: err.message })));
}

// Отправка текстового сообщения в чат или пользователю в MAX
function sendMaxMessage(chatId, text, attachments = null) {
    const endpoint = `/messages?chat_id=${chatId}`;
    const payload = {
        text: text,
        format: 'html'
    };
    if (attachments && Array.isArray(attachments)) {
        payload.attachments = attachments;
    }
    return maxRequest('POST', endpoint, payload);
}

// Like Telegram's sendOrEdit: a button press updates its own message; on failure a new message is sent.
async function sendOrEditMax(chatId, messageId, text, attachments = null) {
    if (messageId) {
        // An empty attachment list removes the old keyboard, as a Telegram edit without reply_markup does.
        const payload = { text: text, format: 'html', attachments: Array.isArray(attachments) ? attachments : [] };
        const res = await maxRequest('PUT', `/messages?message_id=${encodeURIComponent(messageId)}`, payload);
        if (res && res.success) return res;
    }
    return sendMaxMessage(chatId, text, attachments);
}


// Загрузка и отправка файла в MAX
async function sendMaxDocument(chatId, fileName, content, caption) {
    try {
        // 1. Получаем URL для загрузки
        const uploadInfo = await maxRequest('POST', '/uploads?type=file');
        if (!uploadInfo || !uploadInfo.url) {
            console.error('Не удалось получить upload URL для файла:', uploadInfo);
            return sendMaxMessage(chatId, `⚠️ Не удалось загрузить файл: ошибка сервиса загрузки.`);
        }

        // 2. Загружаем файл multipart-запросом
        const form = new FormData();
        form.append('data', new Blob([content], { type: 'application/json' }), fileName);
        const uploadRes = await fetch(uploadInfo.url, { method: 'POST', body: form, client: maxHttpClient })
            .then(res => res.json()).catch(err => ({ error: err.message }));
        const token = uploadRes.token;
        if (!token) {
            console.error('Ошибка загрузки файла в хранилище MAX:', uploadRes);
            return sendMaxMessage(chatId, `⚠️ Не удалось прикрепить файл к сообщению.`);
        }

        // 3. Отправляем сообщение с вложением file
        const attachment = {
            type: 'file',
            payload: {
                token: token
            }
        };

        // MAX processes an uploaded file asynchronously; sending it earlier fails with attachment.not.ready.
        for (let attempt = 0; attempt < 10; attempt++) {
            const res = await sendMaxMessage(chatId, caption || '', [attachment]);
            // A sent message comes back as an object; an error carries `message` as its text.
            if (res && typeof res.message === 'object') return res;
            if (res?.code !== 'attachment.not.ready') {
                console.error('MAX не принял сообщение с файлом:', res);
                break;
            }
            await sleep(1000);
        }
        return sendMaxMessage(chatId, `⚠️ Не удалось прикрепить файл к сообщению.`);
    } catch (err) {
        console.error('Ошибка в sendMaxDocument:', err.message);
        return sendMaxMessage(chatId, `⚠️ Ошибка отправки документа: ${err.message}`);
    }
}

// Получение последнего релиза с GitHub
function getLatestGitHubRelease() {
    return fetch('https://api.github.com/repos/Granit1846/LogBook-Android/releases/latest', {
        headers: { 'User-Agent': 'LogBook-Bot' }
    }).then(res => res.json()).catch(() => null);
}

const SUPABASE_URL = RUNTIME_SUPABASE_URL;
const SUPABASE_KEY = 'sb_publishable_6IaiQHYrjD2auxTmnfjqzQ_ev_Ec55B';

function formatHM(mins) {
    if (mins === undefined || mins === null) return '0м';
    const sign = mins < 0 ? '-' : '';
    const abs = Math.abs(mins);
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return sign + (h > 0 ? `${h}ч ${m < 10 ? '0' : ''}${m}м` : `${m}м`);
}

// Вызов RPC в Supabase для подтверждения/создания сессии авторизации пилота
function confirmTelegramAuthInSupabase(code, maxUserId) {
    return confirmPlatformCode('max', maxUserId, code, MAX_BOT_TOKEN, SUPABASE_KEY);
}

// Определение целевого ID пилота LogBook для пользователя MAX:
// - Только подтверждённая с двух сторон привязка может открыть базу Telegram
// - Verified owner MAX user ID keeps the existing Telegram database
// - Для всех остальных пользователей MAX — их персональный MAX ID (изолированное личное пространство)
async function getTargetPilotId(maxUserId) {
    const numId = Number(maxUserId);
    if (!Number.isSafeInteger(numId) || numId <= 0) return null;
    if (numId === 252125236) {
        return ADMIN_ID; // 891159880 (основная база Сергея)
    }
    const subs = await loadSubscribers();
    const sub = subs.find(s => Number(s.userId) === numId || Number(s.chatId) === numId);
    if (sub && sub.linkVerified === true && sub.linkedTgId) {
        return Number(sub.linkedTgId);
    }
    return numId;
}

// Получение сессии и данных из облака Supabase для конкретного пользователя MAX
async function getUserCloudData(userId, firstName = '', username = '') {
    const loginRes = await getPlatformSession('max', userId, MAX_BOT_TOKEN, SUPABASE_KEY);
    if (!loginRes?.access_token) return null;

    const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${loginRes.access_token}` };
    const [syncRes, userRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/rpc/logbook_sync_pull_v1`, {
            method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: '{}'
        }).then(res => res.json()).catch(() => null),
        fetch(`${SUPABASE_URL}/auth/v1/user`, { headers }).then(res => res.json()).catch(() => ({}))
    ]);

    // Выбранный борт из Supabase
    const selectedBoard = userRes?.user_metadata?.selected_board || null;
    const resp = Array.isArray(syncRes) ? syncRes[0] : syncRes;
    const exchange = resp?.payload ? (typeof resp.payload === 'string' ? JSON.parse(resp.payload) : resp.payload) : { tables: { profiles: [], days: [], launches: [] } };

    const profiles = exchange.tables?.profiles || [];
    let selectedProfile = null;
    if (selectedBoard) {
        selectedProfile = profiles.find(p => String(p.boardNumber) === String(selectedBoard) || String(p.name) === String(selectedBoard));
    }
    if (!selectedProfile && profiles.length > 0) {
        selectedProfile = profiles[0];
    }

    return {
        exchange,
        tables: exchange.tables || {},
        revision: Number(resp?.revision ?? 0),
        token: loginRes.access_token,
        selectedBoard: selectedProfile?.boardNumber || selectedBoard,
        selectedProfile: selectedProfile
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
            return `⚠️ <b>Синхронизация не найдена</b>\n\nНе удалось получить доступ к данным LogBook. Убедитесь, что приложение LogBook синхронизировано с облаком.`;
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
            return `✈️ <b>История полётов пуста</b>\n\nДля борта <b>${targetBoardNumber || '—'}</b> записей полётов пока нет. Выберите нужный борт в меню бота или приложении LogBook.`;
        }

        days.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        const limit = Math.max(1, Math.min(Number(daysLimit) || 7, 100));
        const recentDays = days.slice(0, limit);

        let lines = [];
        lines.push(`📑 <b>История полётов: борт ${targetBoardNumber || '—'} (крайние ${recentDays.length} дн.)</b>`);
        lines.push(`👤 Профиль: <b>${firstName || 'Пилот'}</b>\n`);

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

function calcPrefixSpaces(name) {
    let width = 2.2;
    for (const ch of name) {
        if (ch === ' ' || ch === '.') width += 0.9;
        else if (ch === 'Ж' || ch === 'ж' || ch === 'Ш' || ch === 'ш' || ch === 'Щ' || ch === 'щ' || ch === 'Ю' || ch === 'ю' || ch === 'Ф' || ch === 'ф') width += 2.0;
        else if (ch === ch.toUpperCase() && /[А-ЯA-Z]/.test(ch)) width += 1.8;
        else width += 1.65;
    }
    width += 1.8;
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
        lines.push(`👤 Профиль: <b>${firstName || 'Пилот'}</b>`);
        lines.push(`⏱ Наработка (СНЭ планера): <b>${formatHM(sne)}</b>\n`);

        // ТО
        const mw = Array.isArray(profile.maintenanceWorksJson) ? profile.maintenanceWorksJson : JSON.parse(profile.maintenanceWorksJson || '[]');
        lines.push(`🔧 <b>Регламентные работы (ТО):</b>`);

        // 50 ч ТО
        const candidates50 = mw.filter(m => m.kind === 'HOURS_50' || m.kind === 'HOURS_100');
        const last50 = candidates50.sort((a,b) => (b.counterMinutes||0) - (a.counterMinutes||0))[0];
        if (last50) {
            const next50 = (last50.counterMinutes || 0) + 3000;
            const rem50 = next50 - sne;
            lines.push(`• <b><u>50 ч ТО:</u></b> ост. <b>${formatHM(rem50)}</b> (вып. ${formatDateRu(last50.date)} на ${formatHM(last50.counterMinutes)})`);
        } else {
            lines.push(`• <b><u>50 ч ТО:</u></b> нет данных`);
        }

        // 100 ч ТО
        const candidates100 = mw.filter(m => m.kind === 'HOURS_100');
        const last100 = candidates100.sort((a,b) => (b.counterMinutes||0) - (a.counterMinutes||0))[0];
        if (last100) {
            const next100 = (last100.counterMinutes || 0) + 6000;
            const rem100 = next100 - sne;
            lines.push(`• <b><u>100 ч ТО:</u></b> ост. <b>${formatHM(rem100)}</b> (вып. ${formatDateRu(last100.date)} на ${formatHM(last100.counterMinutes)})`);
        } else {
            lines.push(`• <b><u>100 ч ТО:</u></b> нет данных`);
        }

        // 300 ч ТО
        const candidates300 = mw.filter(m => m.kind === 'HOURS_300');
        const last300 = candidates300.sort((a,b) => (b.counterMinutes||0) - (a.counterMinutes||0))[0];
        if (last300) {
            const next300 = (last300.counterMinutes || 0) + 18000;
            const rem300 = next300 - sne;
            lines.push(`• <b><u>300 ч ТО:</u></b> ост. <b>${formatHM(rem300)}</b> (вып. ${formatDateRu(last300.date)} на ${formatHM(last300.counterMinutes)})`);
        } else {
            lines.push(`• <b><u>300 ч ТО:</u></b> нет данных`);
        }

        // Периодическое ТО (20 дней)
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

        // Регламент 12 мес
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

        // Регламент 24 мес
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

                const remMinutes = (r.extendedTo1 || 0) > 0 ? (r.extendedTo1 - sne) : (r.remaining1 || 0);
                const remH = remMinutes !== 0 ? formatHM(remMinutes) : '—';
                const maxH = (r.extendedTo1 || 0) > 0 ? `${Math.round(r.extendedTo1 / 60)} ч` : '—';

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

                const hasHours = (o.coefficient || 0) > 0 && !(o.emptyFields && o.emptyFields.includes('coefficient'));
                const elapsed = sne - (o.byHours || 0);
                const remMinutes = (o.coefficient || 0) - elapsed;
                const remH = formatHM(remMinutes);
                const maxH = Math.round((o.coefficient || 0) / 60);

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
        lines.push(`👤 Профиль: <b>${firstName || 'Пилот'}</b>\n`);

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
        const targetProfileId = profile.id;

        let days = cloud.tables.days || [];
        if (targetProfileId) {
            days = days.filter(d => d.profileId === targetProfileId);
        }
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
        lines.push(`👤 Профиль: <b>${firstName || 'Пилот'}</b>\n`);

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

        lines.push(`----------------------------------------`);
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
        original: str,
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

    // Плотность топлива
    const fuelMatch = str.match(/^(\d+(?:[\.,]\d+)?)\s*[*xX\s]\s*(0[\.,]\d{2,4})$/);
    if (fuelMatch) {
        const l = parseFloat(fuelMatch[1].replace(',', '.'));
        const d = parseFloat(fuelMatch[2].replace(',', '.'));
        const kg = l * d;
        return `⛽ <b>Расчёт массы топлива:</b>\n${l} л × ${d} = <b>${kg.toFixed(2)} кг</b>`;
    }

    // Время и налёт
    const normalized = str.replace(/(\d+)[\.,]([0-5]\d)/g, '$1:$2');

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

    if (/^\d+$/.test(str)) {
        const num = parseInt(str, 10);
        const th = Math.floor(num / 60);
        const tm = num % 60;
        return `⏱ <b>Перевод минут в налёт:</b>\n${num} мин = <b>${th}ч ${tm < 10 ? '0' : ''}${tm}м</b>`;
    }

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
            sendMaxMessage(chatId, '⚠️ Не удалось выгрузить данные из облака. Проверьте подключение.');
            return;
        }

        const boardNumber = cloud.tables.profiles?.[0]?.boardNumber || 'All';
        const dateStr = new Date().toISOString().split('T')[0];
        const fileName = `LogBook_MAX_Backup_${boardNumber}_${dateStr}.json`;
        await sendMaxDocument(
            chatId,
            fileName,
            JSON.stringify(cloud.exchange, null, 2),
            `💾 <b>Резервная копия базы данных LogBook</b>\n\n• Борт: <b>${boardNumber}</b>\n• Ревизия: <b>${cloud.revision}</b>\n• Дата: <b>${dateStr}</b>\n\nФайл сохранён в вашем мессенджере MAX.`
        );
    } catch (e) {
        sendMaxMessage(chatId, `⚠️ Ошибка создания бэкапа: ${e.message}`);
    }
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// Формирование ссылки на Mini App с безопасным автологином для конкретного пользователя
function getMiniAppUrl() {
    return 'https://max.ru/se14711712_bot?startapp';
}

async function updateVerifiedMaxLink(action, maxId, tgId) {
    const timestamp = Date.now();
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(MAX_BOT_TOKEN), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signed = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${action}\n${maxId}\n${tgId}\n${timestamp}`)));
    const signature = [...signed].map(byte => byte.toString(16).padStart(2, '0')).join('');
    return fetch(`${SUPABASE_URL}/functions/v1/platform-auth`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, maxId, tgId, timestamp, signature })
    }).then(async res => { await res.body?.cancel(); return res.status === 200; }).catch(() => false);
}

// Вспомогательные функции клавиатур MAX
function getMaxMainMenuKeyboard(userId, selectedBoard) {
    const boardText = selectedBoard ? `✈️ Борт: ${selectedBoard}` : '✈️ Выбрать борт';
    return [
        {
            type: 'inline_keyboard',
            payload: {
                buttons: [
                    [{ type: 'open_app', text: '📱 Открыть LogBook', web_app: 'se14711712_bot' }],
                    [{ type: 'callback', text: boardText, payload: 'cmd_select_board' }],
                    [{ type: 'callback', text: '📑 История полётов', payload: 'cmd_history' }],
                    [
                        { type: 'callback', text: '📊 Статус ТО', payload: 'cmd_status' },
                        { type: 'callback', text: '🛠 Замечания', payload: 'cmd_defects' }
                    ],
                    [
                        { type: 'callback', text: '⛽ Заправки', payload: 'cmd_fuel' },
                        { type: 'callback', text: '🧮 Калькулятор', payload: 'cmd_calc' }
                    ],
                    [
                        { type: 'callback', text: '💾 Бэкап базы', payload: 'cmd_backup' },
                        { type: 'callback', text: '📖 Все команды', payload: 'cmd_help' }
                    ]
                ]
            }
        }
    ];
}

function getMaxBoardSelectionKeyboard(profiles, selectedBoard) {
    const buttons = [];
    for (const p of profiles) {
        const num = p.boardNumber || p.name;
        const isCurrent = String(num) === String(selectedBoard);
        buttons.push([{
            type: 'callback',
            text: `${isCurrent ? '✅ ' : '🔘 '}Борт ${num}${p.name && p.name !== num ? ' (' + p.name + ')' : ''}`,
            payload: `set_board_${num}`
        }]);
    }
    buttons.push([{ type: 'callback', text: '⬅️ Главное меню', payload: 'main_menu' }]);
    return [
        {
            type: 'inline_keyboard',
            payload: { buttons }
        }
    ];
}

function getMaxBackKeyboard() {
    return [
        {
            type: 'inline_keyboard',
            payload: {
                buttons: [
                    [{ type: 'callback', text: '⬅️ Назад', payload: 'main_menu' }]
                ]
            }
        }
    ];
}

function getMaxHistoryKeyboard() {
    return [
        {
            type: 'inline_keyboard',
            payload: {
                buttons: [
                    [
                        { type: 'callback', text: '1 день', payload: 'hist_1' },
                        { type: 'callback', text: '3 дня', payload: 'hist_3' },
                        { type: 'callback', text: '7 дней', payload: 'hist_7' },
                        { type: 'callback', text: '14 дней', payload: 'hist_14' }
                    ],
                    [
                        { type: 'callback', text: '⬅️ Назад', payload: 'main_menu' }
                    ]
                ]
            }
        }
    ];
}

function getMaxFuelKeyboard() {
    return [
        {
            type: 'inline_keyboard',
            payload: {
                buttons: [
                    [
                        { type: 'callback', text: '1 день', payload: 'fuel_1' },
                        { type: 'callback', text: '3 дня', payload: 'fuel_3' },
                        { type: 'callback', text: '7 дней', payload: 'fuel_7' },
                        { type: 'callback', text: '14 дней', payload: 'fuel_14' }
                    ],
                    [
                        { type: 'callback', text: '⬅️ Назад', payload: 'main_menu' }
                    ]
                ]
            }
        }
    ];
}

function getMaxCalcHelpText() {
    return `🧮 <b>Авиакалькулятор LogBook</b>\n\n` +
        `Отправьте команду с нужным выражением прямо в чат:\n\n` +
        `• <b>Время налёта:</b> <code>/calc 1.45 + 0.35</code> (➔ 2ч 20м)\n` +
        `• <b>Счётчик СНК:</b> <code>/snk 1,45+1,61</code> (➔ 3:04)\n` +
        `• <b>Одиночный СНК:</b> <code>/snk 1.50</code> (➔ 1:30), <code>/snk 1,78</code> (➔ 1:47)\n` +
        `• <b>Перевод минут:</b> <code>/calc 105</code> (➔ 1ч 45м)\n` +
        `• <b>Масса топлива:</b> <code>/calc 1650 * 0.789</code>\n\n` +
        `💡 <i>Секунды в СНК автоматически округляются до целых минут.</i>`;
}

// Цифровая панель калькулятора (как в Telegram-боте): нажатия правят одно сообщение.
// Набранное выражение хранится на сервере (bot_state) и обновляется с проверкой версии:
// при быстром вводе пользователь жмёт кнопки ещё до обновления сообщения, а MAX может доставить нажатия одновременно.
const NUMPAD_MAX_EXPR = 60;
const numPadKey = (chatId) => `max_numpad_${chatId}`;

function maxKeyboard(rows) {
    return [{
        type: 'inline_keyboard',
        payload: { buttons: rows.map(row => row.map(([text, payload]) => ({ type: 'callback', text, payload }))) }
    }];
}

function getMaxCalcKeyboard() {
    return maxKeyboard([
        [['⏱ Время', 'np_open_time'], ['⏱ СНК', 'np_open_snk']],
        [['⬅️ Назад', 'main_menu']]
    ]);
}

function getMaxNumPadKeyboard(sess) {
    const isSnk = sess.mode === 'snk';
    const key = (label, action) => [label, `np_${action}`];
    return maxKeyboard([
        [key('C', 'c'), key('⌫', 'bs'), key('+', 'plus'), key('-', 'minus')],
        [key('7', '7'), key('8', '8'), key('9', '9'), key('*', 'mul')],
        [key('4', '4'), key('5', '5'), key('6', '6'), key('/', 'div')],
        [key('1', '1'), key('2', '2'), key('3', '3'), key(isSnk ? '.' : ':', 'dot')],
        [key('0', '0'), key(isSnk ? ',' : ':', 'comma'), key('=', 'eq')],
        [key('🔄 ' + (isSnk ? '⏱ Перейти на Время' : '⏱ Перейти на СНК'), 'toggle')],
        [['⬅️ К выбору режима', 'cmd_calc']]
    ]);
}

function renderNumPadText(mode, expr, lastResult = null) {
    const isSnk = mode === 'snk';
    const cleanExpr = (expr || '').trim();

    let resultSection = '';
    if (cleanExpr) {
        const conv = isSnk ? convertSnkToHM(cleanExpr) : calcTimeExpr(cleanExpr);
        if (conv) {
            resultSection = isSnk
                ? `\n📊 <b>Результат:</b> <code>${conv.hm}</code> (${conv.text})\n<i>(Десятичные часы: ${conv.decimalFormatted})</i>\n`
                : `\n📊 <b>Результат:</b> <code>${conv.hm}</code> (${conv.text})\n<i>(Всего: ${conv.totalMinutes} мин)</i>\n`;
        } else {
            resultSection = isSnk ? `\n<i>...ввод выражения...</i>\n` : `\n<i>...ввод времени (чч:мм)...</i>\n`;
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

// Один шаг ввода на цифровой панели; логика та же, что в Telegram-боте
function applyNumPadAction(sess, action) {
    const operators = { plus: '+', minus: '-', mul: '*', div: '/' };
    if (action === 'toggle') {
        sess.mode = sess.mode === 'snk' ? 'time' : 'snk';
        sess.expr = '';
        sess.lastResult = null;
    } else if (action === 'c') {
        sess.expr = '';
        sess.lastResult = null;
    } else if (action === 'bs') {
        if (sess.expr.endsWith(' ')) {
            sess.expr = sess.expr.replace(/\s*[\+\-\*\/]\s*$/, '');
        } else if (sess.expr) {
            sess.expr = sess.expr.slice(0, -1);
        } else {
            sess.lastResult = null;
        }
    } else if (/^[0-9]$/.test(action)) {
        if (!sess.expr && sess.lastResult) sess.lastResult = null;
        sess.expr += action;
    } else if (action === 'dot' || action === 'comma') {
        if (!sess.expr && sess.lastResult) sess.lastResult = null;
        const sep = sess.mode === 'time' ? ':' : (action === 'dot' ? '.' : ',');
        if (!sess.expr.endsWith(sep)) sess.expr += sep;
    } else if (operators[action]) {
        const op = operators[action];
        if (!sess.expr && sess.lastResult) {
            sess.expr = (sess.lastResult.hm || '') + ` ${op} `;
            sess.lastResult = null;
        } else if (sess.expr && !sess.expr.endsWith(' ')) {
            sess.expr += ` ${op} `;
        } else if (!sess.expr && op === '-') {
            sess.expr = '-';
        }
    } else if (action === 'eq') {
        const conv = sess.mode === 'snk' ? convertSnkToHM(sess.expr) : calcTimeExpr(sess.expr);
        if (conv) {
            sess.lastResult = conv;
            sess.expr = ''; // На экране остаётся только результат
        } else if (sess.mode !== 'snk' && !sess.lastResult && sess.expr) {
            const res = calcHelper(sess.expr);
            const cleanRes = res.replace(/<[^>]+>/g, '').split('\n').filter(Boolean).slice(-1)[0];
            sess.lastResult = { hm: cleanRes || '—' };
            sess.expr = '';
        }
    }
    // The expression travels in every button's payload, so keep it short.
    sess.expr = sess.expr.slice(0, NUMPAD_MAX_EXPR);
    return sess;
}

function getMaxCommandsHelpText() {
    return `📖 <b>Список доступных команд:</b>\n\n` +
           `• <code>/app</code> — ссылка на Mini App с автологином\n` +
           `• <code>/board [номер]</code> — выбрать активный борт\n` +
           `• <code>/history [дней]</code> — история полётов (по умолч. 7 дн.)\n` +
           `• <code>/fuel [дней]</code> — сводка заправок (по умолч. 7 дн.)\n` +
           `• <code>/status</code> — остатки ТО, агрегатов и масел\n` +
           `• <code>/defects</code> — открытые замечания по борту\n` +
           `• <code>/defect &lt;текст&gt;</code> — добавить замечание в журнал\n` +
           `• <code>/calc &lt;выражение&gt;</code> — авиакалькулятор (налёт, топливо)\n` +
           `• <code>/snk &lt;значение&gt;</code> — перевод показаний СНК в чч:мм\n` +
           `• <code>/id</code> — ваш ID и статус привязки к Telegram\n` +
           `• <code>/link &lt;код&gt;</code> — подтвердить код из Telegram\n` +
           `• <code>/unlink</code> — отключить привязку (отдельная база MAX)\n` +
           `• <code>/backup</code> — скачать резервную копию базы (JSON)\n` +
           `• <code>/start</code> — главное меню`;
}

function getMaxMainMenuText(firstName, boardNumber) {
    const boardLine = boardNumber ? `📌 Активный борт: <b>${boardNumber}</b>\n\n` : `\n`;
    return `✈️ <b>Главное меню LogBook</b>\n\n` +
           `👋 Привет, <b>${firstName || 'пилот'}</b>!\n` +
           boardLine +
           `Выберите раздел с помощью кнопок:`;
}

async function handleMaxEvent(update) {
    const updateType = update.update_type;

    let chatId = update.chat_id;
    let userId = update.user?.user_id || chatId;
    let text = '';
    let senderName = update.user?.first_name || '';
    let senderUsername = update.user?.username || '';

    let callbackMessageId = null;
    if (updateType === 'bot_started') {
        chatId = update.chat_id;
        userId = update.user?.user_id || chatId;
        senderName = update.user?.first_name || '';
        senderUsername = update.user?.username || '';
        const payload = update.payload || update.start_param || '';
        text = payload ? `/start ${payload}` : '/start';
    } else if (updateType === 'message_created') {
        const msg = update.message;
        if (!msg) return;
        chatId = msg.recipient?.chat_id || msg.recipient?.user_id;
        userId = msg.sender?.user_id || chatId;
        senderName = msg.sender?.first_name || '';
        senderUsername = msg.sender?.username || '';
        text = msg.body?.text || '';
    } else if (updateType === 'message_callback') {
        const cb = update.callback;
        chatId = update.message?.recipient?.chat_id || update.message?.recipient?.user_id || cb?.user?.user_id;
        userId = cb?.user?.user_id || chatId;
        senderName = cb?.user?.first_name || '';
        senderUsername = cb?.user?.username || '';
        text = cb?.payload || '';

        // Извлечение ID сообщения из callback события MAX для редактирования на месте
        callbackMessageId = update.message?.body?.mid ||
                            update.message?.message_id ||
                            update.message?.id ||
                            cb?.message?.body?.mid ||
                            cb?.message?.message_id ||
                            cb?.message?.id;

        if (cb?.callback_id) {
            try {
                maxRequest('POST', `/answers?callback_id=${cb.callback_id}`);
            } catch {}
        }
    } else {
        return;
    }

    if (!text) return;
    text = text.trim();

    // Only the first reply to a button press replaces that message; later replies and other chats get new ones.
    let editTarget = callbackMessageId;
    const reply = (targetChatId, replyText, attachments = null) => {
        const messageId = targetChatId === chatId ? editTarget : null;
        editTarget = null;
        return sendOrEditMax(targetChatId, messageId, replyText, attachments);
    };
    const lowerText = text.toLowerCase();

    console.log(`[MAX Сообщение] [${updateType}] От: ${chatId} (${senderName} @${senderUsername}): ${text}`);

    // Регистрируем подписчика. Нажатия кнопок приходят из чатов, куда бот уже писал, — для них запрос к базе не нужен.
    let subs = updateType === 'message_callback' ? null : await loadSubscribers();
    const exists = !subs || subs.find(s => s.chatId === chatId);
    if (!exists) {
        subs.push({
            chatId: chatId,
            userId: userId,
            username: senderUsername,
            firstName: senderName,
            date: new Date().toISOString()
        });
        saveSubscribers(subs);
        console.log(`➕ Новый подписчик MAX: ${chatId} (@${senderUsername})`);
    }

    // Обработка кнопки главного меню
    if (text === 'main_menu') {
        const cloud = await getUserCloudData(userId, senderName, senderUsername);
        const board = cloud?.selectedBoard || cloud?.tables?.profiles?.[0]?.boardNumber || '';
        reply(chatId, getMaxMainMenuText(senderName, board), getMaxMainMenuKeyboard(userId, board));
        return;
    }

    // Выбор активного борта
    if (text === 'cmd_select_board' || lowerText === '/board' || lowerText === '/борт') {
        const cloud = await getUserCloudData(userId, senderName, senderUsername);
        const profiles = cloud?.tables?.profiles || [];
        if (profiles.length === 0) {
            reply(chatId, '⚠️ В базе данных пока нет профилей бортов. Создайте профиль в приложении LogBook.', getMaxBackKeyboard());
            return;
        }
        reply(
            chatId,
            `✈️ <b>Выбор активного борта</b>\n\nТекущий борт: <b>${cloud.selectedBoard || 'не выбран'}</b>\n\nВыберите нужный борт из списка:`,
            getMaxBoardSelectionKeyboard(profiles, cloud.selectedBoard)
        );
        return;
    }

    if (text.startsWith('set_board_') || lowerText.startsWith('/board ') || lowerText.startsWith('/борт ')) {
        const targetBoard = text.startsWith('set_board_')
            ? text.replace('set_board_', '').trim()
            : (lowerText.startsWith('/board ') ? text.substring(7).trim() : text.substring(6).trim());

        const cloud = await getUserCloudData(userId, senderName, senderUsername);
        const profiles = cloud?.tables?.profiles || [];
        const found = profiles.find(p => String(p.boardNumber) === targetBoard || String(p.name) === targetBoard);

        if (!found) {
            reply(chatId, `⚠️ Борт «${targetBoard}» не найден в вашей базе данных.`, getMaxBackKeyboard());
            return;
        }

        const newBoardNumber = String(found.boardNumber || found.name);
        if (cloud.token) {
            await updateSelectedBoardInSupabase(cloud.token, newBoardNumber);
        }

        reply(
            chatId,
            `✅ <b>Активный борт успешно переключён на: ${newBoardNumber}</b>\n\nТеперь все отчёты (история полётов, остатки ТО, заправки и замечания) отображаются по борту <b>${newBoardNumber}</b>.`,
            getMaxMainMenuKeyboard(userId, newBoardNumber)
        );
        return;
    }

    // Обработка кнопок callback
    if (text === 'cmd_history' || text.startsWith('hist_')) {
        const days = text.startsWith('hist_') ? (parseInt(text.replace('hist_', ''), 10) || 7) : 7;
        const report = await getUserFlightHistoryReport(userId, senderName, days);
        reply(chatId, report, getMaxHistoryKeyboard());
        return;
    }

    if (text === 'cmd_fuel' || text.startsWith('fuel_')) {
        const days = text.startsWith('fuel_') ? (parseInt(text.replace('fuel_', ''), 10) || 7) : 7;
        const report = await getUserFuelReport(userId, senderName, days);
        reply(chatId, report, getMaxFuelKeyboard());
        return;
    }

    if (text === 'cmd_status') {
        const report = await getUserStatusReport(userId, senderName);
        reply(chatId, report, getMaxBackKeyboard());
        return;
    }

    if (text === 'cmd_defects') {
        const report = await getUserDefectsReport(userId, senderName);
        reply(chatId, report, getMaxBackKeyboard());
        return;
    }

    if (text === 'cmd_calc') {
        reply(chatId, getMaxCalcHelpText() + `\n\n👇 <b>Или выберите режим цифровой панели:</b>`, getMaxCalcKeyboard());
        return;
    }

    if (text === 'np_open_time' || text === 'np_open_snk') {
        const mode = text === 'np_open_snk' ? 'snk' : 'time';
        const sess = await updateState(numPadKey(chatId), {}, () => ({ mode, expr: '', lastResult: null }));
        reply(chatId, renderNumPadText(sess.mode, '', null), getMaxNumPadKeyboard(sess));
        return;
    }

    if (text.startsWith('np_')) {
        const action = text.slice(3).split('|')[0]; // '|…' — данные кнопок прежнего формата
        const sess = await updateState(numPadKey(chatId), { mode: 'time', expr: '', lastResult: null }, current => applyNumPadAction(current, action));
        reply(chatId, renderNumPadText(sess.mode, sess.expr, sess.lastResult), getMaxNumPadKeyboard(sess));
        return;
    }

    if (text === 'cmd_help') {
        reply(chatId, getMaxCommandsHelpText(), getMaxBackKeyboard());
        return;
    }

    if (text === 'cmd_backup') {
        await handleBackupCommand(chatId, userId);
        reply(chatId, '💾 Резервная копия базы сформирована.', getMaxBackKeyboard());
        return;
    }

    // 1. Команда /start (включая Deep Linking авторизацию auth_<code> или link_<code>)
    if (text.startsWith('/start') || text.startsWith('auth_') || text.startsWith('/auth') || text.startsWith('link_')) {
        let authCode = null;
        const parts = text.split(/\s+/);
        if (parts.length > 1 && (parts[1].startsWith('auth_') || parts[1].startsWith('link_'))) {
            authCode = parts[1].trim();
        } else if (text.startsWith('auth_') || text.startsWith('link_')) {
            authCode = text.trim();
        } else if (parts.length > 1 && (parts[0] === '/auth' || parts[0] === '/link')) {
            authCode = parts[1].trim();
        }

        if (authCode) {
            if (authCode.startsWith('link_')) {
                reply(chatId, 'Для привязки используйте /link в Telegram-боте и подтвердите код здесь.');
                return;
            }

            const targetPilotId = await getTargetPilotId(userId);
            console.log(`🔑 [MAX] Подтверждение авторизации: код ${authCode} для пилота ${targetPilotId} (${senderName})...`);
            const confirmed = await confirmTelegramAuthInSupabase(authCode, userId);
            if (!confirmed) {
                reply(chatId, 'Код входа не найден или срок его действия истёк. Запросите новый код в приложении.');
                return;
            }

            const cloud = await getUserCloudData(userId, senderName, senderUsername);
            const board = cloud?.selectedBoard || cloud?.tables?.profiles?.[0]?.boardNumber || '';

            reply(
                chatId,
                `✅ <b>Вход в LogBook подтверждён!</b>\n\n` +
                `Добро пожаловать, <b>${senderName || 'пилот'}</b>!\n` +
                `Приложение LogBook на телефоне или компьютере успешно вошло в ваш аккаунт (ID: <code>${targetPilotId}</code>).\n\n` +
                `Можете вернуться в приложение — вход выполнен автоматически.`,
                getMaxMainMenuKeyboard(userId, board)
            );
            return;
        }

        const cloud = await getUserCloudData(userId, senderName, senderUsername);
        const board = cloud?.selectedBoard || cloud?.tables?.profiles?.[0]?.boardNumber || '';
        reply(chatId, getMaxMainMenuText(senderName, board), getMaxMainMenuKeyboard(userId, board));
        return;
    }

    // 1.1 Команда /app (веб-приложение)
    if (lowerText === '/app' || lowerText === '/приложение' || lowerText.startsWith('/app@')) {
        const appUrl = getMiniAppUrl();
        const textMsg = `📱 <b>LogBook Mini App</b>\n\nОткройте приложение кнопкой ниже или по ссылке: ${appUrl}`;
        reply(chatId, textMsg, [
            {
                type: 'inline_keyboard',
                payload: {
                    buttons: [
                        [{ type: 'open_app', text: '📱 Открыть LogBook', web_app: 'se14711712_bot' }],
                        [{ type: 'callback', text: '⬅️ Назад', payload: 'main_menu' }]
                    ]
                }
            }
        ]);
        return;
    }

    // 1.2 Команда /id (информация о профиле и привязке)
    if (lowerText === '/id' || lowerText === '/myid' || lowerText === '/профиль' || lowerText.startsWith('/id@')) {
        const targetId = await getTargetPilotId(userId);
        const isLinked = targetId !== Number(userId);
        const linkStatus = isLinked ? `(привязано к ID: <code>${targetId}</code>)` : `(персональное пространство MAX)`;
        const msg = `👤 <b>Ваш идентификатор в MAX:</b>\n\n` +
            `<code>${userId}</code>\n` +
            `<i>(нажмите на номер выше, чтобы скопировать)</i>\n\n` +
            `• База данных LogBook: <code>${targetId}</code> ${linkStatus}\n\n` +
            `💡 <b>Инструкция по объединению с Telegram:</b>\n` +
            `1. В Telegram-боте @my_logbook_app_bot отправьте <code>/link ${userId}</code>.\n` +
            `2. Полученный код отправьте сюда командой <code>/link КОД</code>.`;
        reply(chatId, msg, getMaxBackKeyboard());
        return;
    }

    // Telegram bot issues a short-lived code to the owner of the Telegram account.
    const linkMatch = text.match(/^\/link(?:\s+([a-f0-9]{32}))?$/i);
    if (linkMatch) {
        const code = linkMatch[1];
        if (!code) {
            reply(
                chatId,
                'Для привязки отправьте команду /link ВАШ_MAX_ID в Telegram-боте. Полученный код пришлите сюда: /link КОД.',
                getMaxBackKeyboard()
            );
            return;
        }
        const requests = await loadState('max_link_requests', []);
        const request = requests.find(item => item.code === code && Number(item.maxId) === Number(userId) && item.expiresAt > Date.now());
        if (!request) {
            reply(chatId, 'Код не найден или истёк. Получите новый код в Telegram-боте.', getMaxBackKeyboard());
            return;
        }
        const tgId = Number(request.telegramId);
        if (!await updateVerifiedMaxLink('link', Number(userId), tgId)) {
            reply(chatId, 'Не удалось сохранить привязку. Повторите попытку позже.', getMaxBackKeyboard());
            return;
        }
        let subsList = await loadSubscribers();
        let sub = subsList.find(s => Number(s.userId) === Number(userId) || Number(s.chatId) === Number(chatId));
        if (!sub) {
            sub = { chatId, userId, username: senderUsername, firstName: senderName, date: new Date().toISOString() };
            subsList.push(sub);
        }
        sub.linkedTgId = tgId;
        sub.linkVerified = true;
        saveSubscribers(subsList);
        await saveState('max_link_requests', requests.filter(item => item.code !== code && item.expiresAt > Date.now()));

        reply(
            chatId,
            `✅ <b>MAX связан с вашим аккаунтом Telegram.</b>\n\nДля отвязки отправьте /unlink.`,
            getMaxMainMenuKeyboard(userId)
        );
        return;
    }


    // 1.4 Команда /unlink (отвязать от Telegram)
    if (lowerText === '/unlink' || lowerText === '/отвязать' || lowerText.startsWith('/unlink@')) {
        if (!await updateVerifiedMaxLink('unlink', Number(userId), 0)) {
            reply(chatId, 'Не удалось отключить привязку. Повторите попытку позже.', getMaxBackKeyboard());
            return;
        }
        let subsList = await loadSubscribers();
        let sub = subsList.find(s => Number(s.userId) === Number(userId) || Number(s.chatId) === Number(chatId));
        if (sub && sub.linkedTgId) {
            delete sub.linkedTgId;
            delete sub.linkVerified;
            saveSubscribers(subsList);
        }
        reply(
            chatId,
            `🔄 <b>Привязка отключена.</b>\n\nТеперь в MAX используется ваше личное изолированное пространство (ID: <code>${userId}</code>).`,
            getMaxMainMenuKeyboard(userId)
        );
        return;
    }
    // 2. Команда /history [число]
    const histMatch = text.match(/^\/(?:history|histori|история)(?:@[a-zA-Z0-9_]+)?(?:\s+(\d+))?$/i);
    if (histMatch) {
        const daysLimit = histMatch[1] ? parseInt(histMatch[1], 10) : 7;
        const report = await getUserFlightHistoryReport(userId, senderName, daysLimit);
        reply(chatId, report, getMaxHistoryKeyboard());
        return;
    }

    // 3. Команда /status
    if (lowerText === '/status' || lowerText === '/статус' || lowerText === '/remains' || lowerText === '/остатки' || lowerText.startsWith('/status@')) {
        const report = await getUserStatusReport(userId, senderName);
        reply(chatId, report, getMaxBackKeyboard());
        return;
    }

    // 4. Команда /defects
    if (lowerText === '/defects' || lowerText === '/дефекты' || lowerText === '/замечания' || lowerText.startsWith('/defects@')) {
        const report = await getUserDefectsReport(userId, senderName);
        reply(chatId, report, getMaxBackKeyboard());
        return;
    }

    // 5. Команда /defect
    if (lowerText.startsWith('/defect') || lowerText.startsWith('/дефект')) {
        const cmd = lowerText.startsWith('/defect') ? '/defect' : '/дефект';
        const defectText = text.slice(text.indexOf(cmd) + cmd.length).trim();
        if (!defectText) {
            reply(
                chatId,
                '💡 Чтобы добавить замечание, укажите его текст, например:\n<code>/defect Заменить лампу фары левого крыла</code>',
                getMaxBackKeyboard()
            );
            return;
        }

        const res = await addDefectToCloud(userId, defectText);
        if (res.ok) {
            reply(
                chatId,
                `✅ <b>Замечание успешно добавлено!</b>\n\n• Борт: <b>${res.boardNumber || '—'}</b>\n• Текст: <i>${defectText}</i>\n\nЗамечание синхронизировано и отобразится в приложении LogBook.`,
                getMaxBackKeyboard()
            );
        } else {
            reply(chatId, `⚠️ Не удалось сохранить замечание: ${res.error || 'неизвестная ошибка'}`, getMaxBackKeyboard());
        }
        return;
    }

    // 6. Команда /fuel [дней]
    const fuelMatch = text.match(/^\/(?:fuel|топливо|заправка|заправки)(?:@[a-zA-Z0-9_]+)?(?:\s+(\d+))?$/i);
    if (fuelMatch) {
        const limit = fuelMatch[1] ? parseInt(fuelMatch[1], 10) : 7;
        const report = await getUserFuelReport(userId, senderName, limit);
        reply(chatId, report, getMaxFuelKeyboard());
        return;
    }

    // 7. Команда /calc / /calk
    if (lowerText.startsWith('/calc') || lowerText.startsWith('/calk') || lowerText.startsWith('/кальк') || lowerText.startsWith('/калк') || lowerText.startsWith('/время') || lowerText.startsWith('время ')) {
        const cmd = lowerText.startsWith('/calc') ? '/calc' : (lowerText.startsWith('/calk') ? '/calk' : (lowerText.startsWith('/кальк') ? '/кальк' : (lowerText.startsWith('/калк') ? '/калк' : (lowerText.startsWith('/время') ? '/время' : 'время'))));
        const rawExpr = text.slice(text.toLowerCase().indexOf(cmd) + cmd.length);
        const expr = rawExpr.replace(/^@[a-zA-Z0-9_]+/, '').trim();
        const res = calcHelper(expr);
        reply(chatId, res, getMaxBackKeyboard());
        return;
    }

    // 7.1 Команда /snk / /снк (перевод СНК в чч:мм и сложение значений СНК)
    if (lowerText.startsWith('/snk') || lowerText.startsWith('/снк') || lowerText.startsWith('snk ') || lowerText.startsWith('снк ')) {
        const rawVal = text.replace(/^(?:@[a-zA-Z0-9_]+\s*)?(?:\/snk|\/снк|snk|снк)\s*/i, '').trim();
        if (!rawVal) {
            reply(
                chatId,
                '💡 Укажите значение или выражение СНК, например:\n<code>/snk 1.50</code> ➔ 1:30\n<code>/snk 1,45+1,61</code> ➔ 3:04',
                getMaxBackKeyboard()
            );
            return;
        }
        const conv = convertSnkToHM(rawVal);
        if (conv) {
            reply(
                chatId,
                `⏱ <b>Расчёт СНК (счётчик наработки):</b>\n<code>${escapeHtml(conv.original)}</code> = <b>${conv.hm}</b> (${conv.text})\n<i>(Десятичные часы: ${conv.decimalFormatted})</i>`,
                getMaxBackKeyboard()
            );
        } else {
            reply(
                chatId,
                `⚠️ Не удалось распознать выражение: <code>${escapeHtml(rawVal)}</code>`,
                getMaxBackKeyboard()
            );
        }
        return;
    }

    // 8. Команда /backup
    if (lowerText === '/backup' || lowerText === '/бэкап' || lowerText.startsWith('/backup@') || lowerText.startsWith('/бэкап@')) {
        await handleBackupCommand(chatId, userId);
        reply(chatId, '💾 Резервная копия базы сформирована.', getMaxBackKeyboard());
        return;
    }

    // 9. Команда /stats
    if (lowerText === '/stats' || lowerText.startsWith('/stats@') || lowerText === '/статистика') {
        const subsList = await loadSubscribers();
        reply(
            chatId,
            `📊 <b>Статистика пользователей MAX</b>:\nВсего зарегистрировано в боте: <b>${subsList.length}</b> чел.`,
            getMaxBackKeyboard()
        );
        return;
    }

    // 10. Команда /update
    if (lowerText.startsWith('/update') || lowerText.startsWith('/обновить') || lowerText.startsWith('/обновление')) {
        const subsList = await loadSubscribers();
        if (subsList.length === 0) {
            reply(chatId, '⚠️ Список пользователей MAX пуст. Никто ещё не отправил сообщение боту.', getMaxBackKeyboard());
            return;
        }

        let customText = text.replace(/^\/(?:update|обновить|обновление)(?:@[a-zA-Z0-9_]+)?/i, '').trim();
        let broadcastText = '';
        let downloadUrl = 'https://github.com/Granit1846/LogBook-Android/releases/latest';

        if (customText) {
            broadcastText = `🚀 <b>Обновление LogBook!</b>\n\n${escapeHtml(customText)}`;
        } else {
            reply(chatId, '⏳ Загружаю данные о последнем релизе с GitHub...');
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

        reply(chatId, `📢 Начинаю рассылку для <b>${subsList.length}</b> пользователей MAX...`);

        let success = 0;
        let blocked = 0;

        for (const sub of subsList) {
            try {
                const res = await sendMaxMessage(
                    sub.chatId,
                    broadcastText,
                    [
                        {
                            type: 'inline_keyboard',
                            payload: {
                                buttons: [
                                    [
                                        {
                                            type: 'link',
                                            text: '📲 Скачать обновление',
                                            url: downloadUrl
                                        }
                                    ]
                                ]
                            }
                        }
                    ]
                );

                if (res && res.message) {
                    success++;
                } else {
                    blocked++;
                }
                await sleep(50);
            } catch (err) {
                blocked++;
            }
        }

        reply(
            chatId,
            `✅ <b>Рассылка завершена!</b>\n\n• Доставлено: <b>${success}</b>\n• Не доставлено / ошибки: <b>${blocked}</b>`,
            getMaxBackKeyboard()
        );
        return;
    }

    // Если неизвестная команда со слэшем
    if (text.startsWith('/')) {
        reply(
            chatId,
            `❓ Неизвестная команда: <code>${escapeHtml(text)}</code>\n\nИспользуйте /start для перехода в главное меню.`,
            getMaxBackKeyboard()
        );
    }
}

// Подписка MAX на вебхук и регистрация команд (вызывается один раз при переключении)
export async function setupBot(webhookUrl) {
    const subscription = await maxRequest('POST', '/subscriptions', {
        url: webhookUrl,
        update_types: ['message_created', 'message_callback', 'bot_started']
    });
    const commands = await maxRequest('PATCH', '/me/commands', {
        commands: [
            { name: 'start', description: 'Главное меню с кнопками' },
            { name: 'board', description: 'Выбрать активный борт: /board [номер]' },
            { name: 'app', description: 'Открыть веб-приложение Mini App' },
            { name: 'id', description: 'Мой ID и статус привязки' },
            { name: 'link', description: 'Подтвердить код привязки из Telegram' },
            { name: 'unlink', description: 'Отвязать (отдельная база MAX)' },
            { name: 'history', description: 'История полётов: /history [дней]' },
            { name: 'status', description: 'Остатки ТО, масла, налёт планера' },
            { name: 'defects', description: 'Журнал замечаний по борту' },
            { name: 'defect', description: 'Добавить замечание: /defect <текст>' },
            { name: 'fuel', description: 'Сводка заправок: /fuel [записей]' },
            { name: 'calc', description: 'Авиакалькулятор: /calc <выражение>' },
            { name: 'backup', description: 'Резервная копия базы данных (JSON)' },
            { name: 'stats', description: 'Статистика пользователей' },
            { name: 'update', description: 'Рассылка обновлений' }
        ]
    });
    return { subscription, commands: commands?.name ? 'ok' : commands };
}

// Возврат к опросу с ПК: снять подписку на вебхук
export function teardownBot(webhookUrl) {
    return maxRequest('DELETE', `/subscriptions?url=${encodeURIComponent(webhookUrl)}`);
}

export { handleMaxEvent };
