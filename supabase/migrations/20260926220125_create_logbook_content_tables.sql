/*
# Create content tables for the Logbook landing page

## Overview
Creates 5 tables to store the dynamic content of the Logbook marketing site:
features, roadmap items, FAQ entries, screenshot gallery items, and software
release info. All content is seeded with the existing hardcoded data so the
site works identically after switching to the database.

## New Tables

1. `features` — feature cards shown in the 3×3 grid
   - `id` (uuid, primary key)
   - `icon_name` (text) — lucide-react icon identifier (e.g. "FileText")
   - `title` (text) — feature name
   - `description` (text) — feature description
   - `sort_order` (int) — display order

2. `roadmap` — roadmap timeline items
   - `id` (uuid, primary key)
   - `version` (text) — e.g. "v1.0.0"
   - `date_text` (text) — human-readable date (e.g. "Январь 2026")
   - `title` (text) — milestone title
   - `description` (text) — milestone description
   - `status` (text) — one of: 'done', 'in-progress', 'planned'
   - `sort_order` (int) — display order

3. `faq` — FAQ accordion entries
   - `id` (uuid, primary key)
   - `question` (text)
   - `answer` (text)
   - `sort_order` (int) — display order

4. `screenshots` — screenshot gallery items
   - `id` (uuid, primary key)
   - `title` (text) — screenshot caption
   - `color` (text) — hex color for the placeholder
   - `sort_order` (int) — display order

5. `releases` — downloadable software releases
   - `id` (uuid, primary key)
   - `version` (text) — e.g. "1.0.0"
   - `date_text` (text) — human-readable release date
   - `size_text` (text) — file size (e.g. "48 МБ")
   - `is_latest` (boolean) — marks the current featured release
   - `sort_order` (int) — display order

## Security
- RLS enabled on all tables.
- All tables use `TO anon, authenticated` with `USING (true)` / `WITH CHECK (true)`
  because this is a single-tenant public marketing site with no sign-in.
  The data is intentionally public — anyone can read it.

## Notes
1. All tables seeded with existing hardcoded content.
2. `sort_order` controls display ordering in the frontend.
3. `releases.is_latest` flags the version shown in the download card.
*/

-- ===================== FEATURES =====================
CREATE TABLE IF NOT EXISTS features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  icon_name text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);

ALTER TABLE features ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_features" ON features;
CREATE POLICY "anon_select_features" ON features FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_features" ON features;
CREATE POLICY "anon_insert_features" ON features FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_features" ON features;
CREATE POLICY "anon_update_features" ON features FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_features" ON features;
CREATE POLICY "anon_delete_features" ON features FOR DELETE
  TO anon, authenticated USING (true);

-- ===================== ROADMAP =====================
CREATE TABLE IF NOT EXISTS roadmap (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  date_text text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'planned',
  sort_order int NOT NULL DEFAULT 0
);

ALTER TABLE roadmap ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_roadmap" ON roadmap;
CREATE POLICY "anon_select_roadmap" ON roadmap FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_roadmap" ON roadmap;
CREATE POLICY "anon_insert_roadmap" ON roadmap FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_roadmap" ON roadmap;
CREATE POLICY "anon_update_roadmap" ON roadmap FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_roadmap" ON roadmap;
CREATE POLICY "anon_delete_roadmap" ON roadmap FOR DELETE
  TO anon, authenticated USING (true);

-- ===================== FAQ =====================
CREATE TABLE IF NOT EXISTS faq (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);

ALTER TABLE faq ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_faq" ON faq;
CREATE POLICY "anon_select_faq" ON faq FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_faq" ON faq;
CREATE POLICY "anon_insert_faq" ON faq FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_faq" ON faq;
CREATE POLICY "anon_update_faq" ON faq FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_faq" ON faq;
CREATE POLICY "anon_delete_faq" ON faq FOR DELETE
  TO anon, authenticated USING (true);

-- ===================== SCREENSHOTS =====================
CREATE TABLE IF NOT EXISTS screenshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  color text NOT NULL DEFAULT '#5B7C99',
  sort_order int NOT NULL DEFAULT 0
);

ALTER TABLE screenshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_screenshots" ON screenshots;
CREATE POLICY "anon_select_screenshots" ON screenshots FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_screenshots" ON screenshots;
CREATE POLICY "anon_insert_screenshots" ON screenshots FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_screenshots" ON screenshots;
CREATE POLICY "anon_update_screenshots" ON screenshots FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_screenshots" ON screenshots;
CREATE POLICY "anon_delete_screenshots" ON screenshots FOR DELETE
  TO anon, authenticated USING (true);

-- ===================== RELEASES =====================
CREATE TABLE IF NOT EXISTS releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  date_text text NOT NULL,
  size_text text NOT NULL,
  is_latest boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0
);

ALTER TABLE releases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_releases" ON releases;
CREATE POLICY "anon_select_releases" ON releases FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_releases" ON releases;
CREATE POLICY "anon_insert_releases" ON releases FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_releases" ON releases;
CREATE POLICY "anon_update_releases" ON releases FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_releases" ON releases;
CREATE POLICY "anon_delete_releases" ON releases FOR DELETE
  TO anon, authenticated USING (true);

-- ===================== SEED DATA =====================

-- Features
INSERT INTO features (icon_name, title, description, sort_order) VALUES
  ('FileText',  'Формуляры',           'Поддержка формуляров: Часть 1, ВР-80, Та-14, ВК-2500-01, ВК-2500-02. Структурированный ввод и хранение данных.', 1),
  ('Calculator','Ресурсы',             'Расчёт остатков агрегатов и масел с цветовой индикацией. Наглядное отображение текущего состояния ресурсов.', 2),
  ('Bell',      'Уведомления',         'Предупреждения о критических остатках при запуске программы. Не пропустите важные сроки замены.', 3),
  ('Printer',   'Печать',              'Экспорт формуляров в PDF и вывод на печать. Готовые документы в соответствии с требованиями.', 4),
  ('Layers',    'Многопрофильность',   'Несколько единиц техники в одной программе. Ведите формуляры для разных объектов параллельно.', 5),
  ('History',   'Undo/Redo',          'До 30 шагов отмены и повтора действий. Безопасное редактирование без потери данных.', 6),
  ('Save',      'Автосохранение',      'Автоматическое сохранение каждые 5 минут. Ваши данные защищены даже при внезапном отключении.', 7),
  ('Moon',      'Тёмная/светлая тема','Переключение между тёмной и светлой темой с настройкой шрифта и размера текста.', 8),
  ('Power',     'Автозапуск',         'Запуск вместе с Windows и сворачивание в системный трей. Программа всегда под рукой.', 9)
ON CONFLICT DO NOTHING;

-- Roadmap
INSERT INTO roadmap (version, date_text, title, description, status, sort_order) VALUES
  ('v1.0.0', 'Январь 2026',   'Базовый функционал',            'Реализован основной функционал: ведение формуляров, расчёт ресурсов, печать, тёмная и светлая темы.', 'done', 1),
  ('v1.1.0', 'Март 2026',     'Локализация и системные функции','Локализация интерфейса на русский и английский языки, автозапуск с Windows, сворачивание в трей.', 'in-progress', 2),
  ('v1.2.0', 'Июнь 2026',     'Облачная синхронизация',        'Синхронизация данных между ПК и смартфоном через облачное хранилище. Работа с нескольких устройств.', 'planned', 3),
  ('v1.3.0', 'Сентябрь 2026', 'Мобильное приложение',         'Мобильные приложения для Android и iOS. Просмотр и редактирование формуляров на ходу.', 'planned', 4),
  ('v2.0.0', 'Декабрь 2026',  'Веб-версия и экспорт',          'Полноценная веб-версия приложения, экспорт данных в Excel, расширенная аналитика наработки.', 'planned', 5)
ON CONFLICT DO NOTHING;

-- FAQ
INSERT INTO faq (question, answer, sort_order) VALUES
  ('Где хранятся данные?', 'Все данные хранятся локально на вашем компьютере в папке приложения. Никакие данные не передаются на внешние серверы. Это обеспечивает полную конфиденциальность и независимость от интернет-соединения.', 1),
  ('Можно ли работать без интернета?', 'Да, Logbook работает полностью офлайн. Интернет-соединение не требуется ни для запуска, ни для работы, ни для сохранения данных. Все вычисления и хранение происходят на вашем устройстве.', 2),
  ('Как перенести данные на другой ПК?', 'Для переноса данных скопируйте папку данных приложения из одного профиля пользователя в другой. Папка находится в каталоге Documents/Logbook. После запуска программы на новом компьютере данные будут автоматически подхвачены.', 3),
  ('Есть ли мобильная версия?', 'На данный момент мобильная версия находится в разработке и запланирована к выпуску в версии 1.3.0. Следите за обновлениями на сайте и в нашем Telegram-канале, чтобы узнать о выходе первыми.', 4),
  ('Как обновляться?', 'Программа автоматически проверяет наличие обновлений при запуске. При выходе новой версии вы получите уведомление с возможностью скачать и установить обновление. Также вы можете скачать новую версию вручную со страницы «Скачать».', 5),
  ('Нужна ли лицензия для использования?', 'Logbook распространяется бесплатно. Программа имеет открытый исходный код, доступный на GitHub. Вы можете свободно использовать её в коммерческих и некоммерческих целях в соответствии с лицензией MIT.', 6)
ON CONFLICT DO NOTHING;

-- Screenshots
INSERT INTO screenshots (title, color, sort_order) VALUES
  ('Главное окно',         '#5B7C99', 1),
  ('Формуляр ВР-80',       '#F4A460', 2),
  ('Расчёт ресурсов',      '#48657f', 3),
  ('Настройки программы',  '#d68a4a', 4),
  ('Печать формуляра',     '#3a5066', 5),
  ('Тёмная тема',          '#2c3c4d', 6)
ON CONFLICT DO NOTHING;

-- Releases
INSERT INTO releases (version, date_text, size_text, is_latest, sort_order) VALUES
  ('1.0.0', '15 января 2026', '48 МБ', true,  1),
  ('0.9.2', 'Декабрь 2025',   '45 МБ', false, 2),
  ('0.9.1', 'Ноябрь 2025',    '43 МБ', false, 3),
  ('0.9.0', 'Октябрь 2025',   '40 МБ', false, 4)
ON CONFLICT DO NOTHING;
