# ФОРМА

Мобильный дневник питания и тренировок.

- Недельное меню, редактируемые порции и учёт БЖУ.
- Две фуллбоди-тренировки с отдельными записями для двух залов.
- Замеры, график и резервные копии JSON.

Параметры и дневник хранятся в localStorage браузера. Автоматической облачной синхронизации нет. Профиль заполняется на устройстве, личные медицинские сведения в репозиторий не включены.

Статический сайт без сборки. Публикуется вместе с существующим GitHub Pages из каталога `/forma/`.

## Дневник и привычки v2

- Реальные продукты записываются отдельно от вкладки «Идеи меню».
- Базовые продукты и собственная библиотека работают локально. Внешний поиск по названию и штрихкоду использует Open Food Facts. БЖУ проверяются перед добавлением, неизвестные значения не заменяются нулями.
- Указанная порция пересчитывает пищевую ценность на 100 г или 100 мл. Снимок значений хранится в записи, поэтому изменения библиотеки не переписывают историю.
- Вода отмечается отдельными стаканами или произвольным объёмом. Изменение размера стакана влияет только на новые записи.
- Ручные привычки дополняются автоматическими отметками воды, белка и шагов.
- Старые отмеченные блюда и дополнительная еда переносятся в записи дневника. Старый ключ хранилища не удаляется. Обновлённый дневник использует отдельный ключ `forma-tracker-v2`, чтобы старые открытые вкладки не перезаписывали новые данные.
- Экспорт JSON включает продукты, записи, воду, привычки, замеры и тренировки.
- Сканер ZXing поставляется локально, запускает камеру только по кнопке и не отправляет видео на сервер. Фактическая работа камеры зависит от разрешений и браузера.

Данные Open Food Facts: https://world.openfoodfacts.org/data (ODbL). Доступность и полнота внешней базы могут меняться. FatSecret и YAZIO не подключены.

## iPhone / Huawei steps bridge

The frontend accepts a daily step total from an iPhone Shortcut, after local opt-in and explicit review. Setup lives on Today and Profile. No Huawei OAuth or direct Apple Health access is claimed. The user must create the Shortcut on their phone, filter Health samples to Huawei only, and verify the first total. No ready-made or signed Shortcut is included. Real iPhone execution remains to be verified.

Fragment format: `#health-steps?date=YYYY-MM-DD&steps=8123&key=LOCAL_KEY`. The fragment is removed before confirmation and is never included in HTTP requests. Values are date/integer/range checked, and only the local browser key is accepted. A confirmed transfer replaces that day's total; it does not add to it. Repeating a transfer is idempotent. The local connection key is not an account credential and is excluded from diary backup. Reconnect after clearing storage or changing browser. Steps remain local, like the rest of the diary. No background or ordinary-Safari-open auto sync.

## Health overview and recipes (build 11)

The visible manual food diary has been replaced by a recipe library (130 recipes). Legacy entries/products remain in storage and backups but are never added to imported nutrition. Calories and macros on Today come exclusively from confirmed Apple Health imports. Recipe favorites and imported health fields survive export/import. Filters include meal, ingredient/name, up to 15 active preparation minutes, and at least 25 g protein. Ingredient portions scale 1–4; kcal labels remain per one portion.

The private signed iPhone Shortcut is delivered separately to the user and MUST NOT be added to this public repo: it contains their local pairing key. It reads seven daily quantities: iPhone steps (source filter preserved from user's working file), dietary energy, protein, fat, carbohydrates, active energy and dietary water. The custom URL is `#health?date=...&FIELD=NUMBER&FIELDCount=COUNT&key=...`. Data lives in the fragment and is removed before review. Missing samples (`Count=0`) do not replace old fields. Import is explicit and field-selectable. Active energy covers all activity; it is not presented as walking-only. Health water and manually marked glasses are displayed separately, never summed.

The command is signed and its signed payload compared against the generated workflow. Website import is tested with synthetic data; real Health execution, type labels, unit selection and permissions require verification on the user's iPhone. No access to the user's Health store exists on this Mac. This release does not add arbitrary Health fields, sleep, clinical records or cloud storage.
