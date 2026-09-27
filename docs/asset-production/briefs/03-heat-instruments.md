# Задание 03: furnace и gauge

**Владелец:** `asset-producer-03`  
**Параметры агента:** `gpt-6-luna`, `reasoning_effort=max`  
**Статус:** `queued`  
**Область вывода:** `output/assets/repair-candidates/03-heat-instruments/`

У furnace подтверждены посторонние фрагменты. После просмотра исходника через `view_image` отредактируйте только его одним отдельным вызовом встроенного `image_gen` с `transparent_background: true`. Gauge аудит не признал дефектным: выполните визуальный и alpha-аудит, но не запускайте генерацию, если он проходит QC. Если появились новые конкретные доказательства дефекта gauge, остановитесь и попросите координатора передать файл.

## Смысл и область владения

- `public/assets/furnace.webp` — накопитель тепла, иконка Котельщика и улучшения восстановления энергии. Удалить посторонние куски вокруг существующего предмета; сохранить его корпус, огонь и текущие детали.
- `public/assets/gauge.webp` — измерительный прибор для точного расчёта/критического шанса и кулдаунов; им также обозначена мастерская станции. Сохранить исходное изображение, если QC подтверждает целостность и прозрачность.

## Промпт для furnace

Use case: stylized-concept. Asset type: one isolated icon for stored heat, energy recovery and the existing Stoker. Edit Image 1, the exact existing furnace icon. Preserve the current heat-container/furnace identity, complete body, fittings, materials, proportions, warm inner heat and original colors; remove the foreign image fragments identified in the audit and clean only the item boundary. Keep any glow contained within the object as in the reference. Center the complete item with about 8% transparent margin. Match the project's detailed rendered-item style. Keep its silhouette readable at 48 and 64 px on #102a2e and #eee8d8. Request a genuinely transparent background. One furnace only; no text, logo, frame, pedestal, room, second object, sparks, debris, added pipes, external fire cloud or watermark. Do not invent new game content.

**Референс и вызов:** до edit показать `E:\Projects\ISOBARA\public\assets\furnace.webp`, затем использовать его как `referenced_image_paths` для одного встроенного `image_gen` вызова с `transparent_background=true`. Цель — очистка исходного изображения, а не перерисовка накопителя тепла.

**Выход furnace:** `output/assets/repair-candidates/03-heat-instruments/furnace-source.png`, `output/assets/repair-candidates/03-heat-instruments/furnace.webp`, `furnace-provenance.json` и `furnace-qc.md` в той же папке.

## Проверка gauge без регенерации

Покажите `E:\Projects\ISOBARA\public\assets\gauge.webp` через `view_image`. Проверьте настоящий alpha, целый силуэт, отсутствие посторонних частей, запас до края и видимость на `#102a2e` и `#eee8d8` при 48 и 64 px. Если всё проходит — `accepted` и генерации нет. Не делайте новый вариант ради единообразия.

В provenance furnace запишите точный промпт и роль референса, built-in edit, PNG/WebP пути, размеры, alpha, непрозрачные bounds, отступ и касания границы. Для обеих иконок занесите проверку тёмного и светлого фона, 48/64 px и причину генерации или её отсутствия. Не называйте модель картинки: её ID недоступен интерфейсу встроенного инструмента.


## Идентификация своего результата при параллельной генерации

Не выбирайте последний по времени файл из общей папки generated_images: он может принадлежать соседнему агенту. Сохраняйте только точный путь/данные из собственного tool result; фиксируйте исходный путь и SHA256 и обязательно просмотрите скопированный PNG. При неизвестном или неоднозначном пути эскалируйте координатору; не подставляйте чужой результат. Совпадение SHA256 разных предметов блокирует приёмку.


## Уточнение порядка запуска пользователем

Каждый следующий производитель выполняет только одну назначенную генерацию и передаёт PNG, компактный WebP, provenance и короткий QC координатору. Контрольные исходники уже проверены общим аудитом: повторно проверять их агенту не нужно. Все принятые замены интегрируются вместе, затем выполняется один общий этап сборки и тестирования игры. Первая завершавшаяся задача cloak+rotor была запущена до этого уточнения. Одновременно доступны только два производителя при работающем агенте производительности; остальные запускаются по освобождению слота.
