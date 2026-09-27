# Задание 06: seed и void

> Историческое задание; выполнено и принято 28.09.2026. Актуальные статусы — в [jobs.json](../jobs.json), результат — в [отчёте интеграции](../../../evidence/asset-integration-checks.md). Не запускать повторно без нового подтверждённого дефекта. Ниже сохранены исходные требования.

**Владелец:** `asset-producer-06`  
**Параметры агента:** `gpt-6-luna`, `reasoning_effort=max`  
**Статус:** `accepted`
**Область вывода:** `output/assets/repair-candidates/06-garden-forecast/`

Seed визуально срезан сверху. Это единственная цель генерации данного задания. Сначала изучите исходник через `view_image`, затем запустите один отдельный edit-вызов встроенного `image_gen` с `transparent_background: true`. Void только проверьте: аудит не подтвердил дефект, поэтому при успешном QC регенерации нет.

## Смысл и область владения

- `public/assets/seed.webp` — существующая иконка Садовника и улучшения семенного веера Аэролога. Верните верхнюю часть именно исходного предмета, не выращивайте из него растение.
- `public/assets/void.webp` — существующая иконка Нулевого фронта, последнего хранителя контура. Сохраните исходный образ иконки без изменений, если он полностью помещается и alpha настоящий.

## Промпт для seed

Use case: stylized-concept. Asset type: one isolated icon for the existing Gardener and seed-fan upgrade. Edit Image 1, the exact existing seed icon. Preserve the current seed/seed-pod identity, existing visible structure, proportions, materials and colors; restore the missing top so the full original silhouette is visible, then clean only the edge. Do not grow it into a plant or add leaves, roots or another object. Center one complete seed with about 8% transparent margin. Match the project's detailed rendered-item finish. Its main shape must read at 48 and 64 px on #102a2e and #eee8d8. Request a genuinely transparent background. One seed only; no text, logo, frame, pedestal, soil, garden scene, extra seed, detached particles or watermark. Do not invent game content.

**Референс и вызов:** просмотреть `E:\Projects\ISOBARA\public\assets\seed.webp` через `view_image`, затем вызвать встроенный `image_gen` для одного edit с `referenced_image_paths` на этот исходник и `transparent_background=true`.

**Выход seed:** `output/assets/repair-candidates/06-garden-forecast/seed-source.png`, `output/assets/repair-candidates/06-garden-forecast/seed.webp`, `seed-provenance.json` и `seed-qc.md`.

## Проверка void без регенерации

Просмотреть `E:\Projects\ISOBARA\public\assets\void.webp` через `view_image`. Проверить настоящий alpha, отсутствие срезанного силуэта и посторонних частей, прозрачный запас, затем 48/64 px на светлом `#eee8d8` и тёмном `#102a2e` фоне. Принять текущий WebP без генерации при успешном результате. Если обнаружится другой дефект, запросить у координатора явную передачу владельца, прежде чем менять файл.

Для обоих файлов возвращайте provenance и QC; для seed включите вручную написанный промпт, исходный референс, built-in edit, PNG и WebP пути, размер, alpha, bounds и margin. Запишите видимость обоих изображений в четырёх комбинациях размера и фона. Не указывать предположительный ID модели генерации.


## Идентификация своего результата при параллельной генерации

Не выбирайте последний по времени файл из общей папки generated_images: он может принадлежать соседнему агенту. Сохраняйте только точный путь/данные из собственного tool result; фиксируйте исходный путь и SHA256 и обязательно просмотрите скопированный PNG. При неизвестном или неоднозначном пути эскалируйте координатору; не подставляйте чужой результат. Совпадение SHA256 разных предметов блокирует приёмку.


## Уточнение порядка запуска пользователем

Каждый следующий производитель выполняет только одну назначенную генерацию и передаёт PNG, компактный WebP, provenance и короткий QC координатору. Контрольные исходники уже проверены общим аудитом: повторно проверять их агенту не нужно. Все принятые замены интегрируются вместе, затем выполняется один общий этап сборки и тестирования игры. Первая завершавшаяся задача cloak+rotor была запущена до этого уточнения. Одновременно доступны только два производителя при работающем агенте производительности; остальные запускаются по освобождению слота.
