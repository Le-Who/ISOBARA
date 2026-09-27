# Задание 02: coil и fork

**Владелец:** `asset-producer-02`  
**Параметры агента:** `gpt-6-luna`, `reasoning_effort=max`  
**Статус:** `queued`  
**Область вывода:** `output/assets/repair-candidates/02-electrical-tools/`

Этот brief покрывает два существующих файла. Аудит нашёл посторонние фрагменты у coil. Для coil выполните один отдельный edit-вызов встроенного `image_gen` после `view_image`; включите ровно один исходный предмет и `transparent_background: true`. Не объединяйте несколько предметов в один результат. Fork только осмотрите и проверьте alpha. В исходном аудите у fork не установлено основание для регенерации, поэтому при успешном QC не генерируйте его.

## Смысл и область владения

- `public/assets/coil.webp` — электрический прибор Линейщика, связанный с сигналом и цепным разрядом; цель ремонта — удалить посторонние фрагменты и сохранить сам прибор.
- `public/assets/fork.webp` — полевой камертон Сборщика и иконка его ближнего инструмента. Только audit/accept при прохождении проверок; не заменять из-за общего желания обновить стиль.

## Промпт для coil

Use case: stylized-concept. Asset type: one isolated icon for the Lineman's electrical instrument and signal upgrades. Edit Image 1, the exact existing coil icon. Preserve its existing coil/device identity, full design, proportions, visible winding or electrical details, materials and palette; remove the foreign image fragments identified by audit and restore a clean item boundary. Do not replace or redesign the coil. Center the whole coil with about 8% transparent space around its silhouette. Match the project's detailed rendered-item finish. Keep the shape and key electrical detail readable at 48 and 64 px on #102a2e and #eee8d8. Request a genuinely transparent background. Show exactly one coil, with no text, logo, border, pedestal, background scene, extra device, extra loose wire not present in the reference, debris, effects cloud or watermark.

**Референс и вызов:** до edit показать `E:\Projects\ISOBARA\public\assets\coil.webp` через `view_image`, затем использовать его как `referenced_image_paths` для одного встроенного вызова `image_gen`, указав `transparent_background=true`. Не запускать вызов для fork при отсутствии нового свидетельства дефекта.

**Выход coil:** исходный результат генератора `output/assets/repair-candidates/02-electrical-tools/coil-source.png`, кандидат с альфой `output/assets/repair-candidates/02-electrical-tools/coil.webp`; проверенный промпт и происхождение сохранить в соседнем `coil-provenance.json`, результаты QC в `coil-qc.md`.

## Проверка fork без регенерации

Покажите `E:\Projects\ISOBARA\public\assets\fork.webp` через `view_image`. Проверьте, что у файла есть настоящий alpha-канал, полный силуэт камертона, свободный запас по краям и читаемость 48/64 px на светлом и тёмном фоне. Если всё проходит, верните `accepted`, сохранив исходный WebP без изменения. Если новая проверка покажет конкретный дефект, отметьте его и запросите передачу файла координатором; не редактируйте до передачи владения.

Для обоих файлов верните provenance и QC. В записи coil укажите точный промпт, локальный референс, режим edit, путь PNG и WebP, размеры, alpha и bounds, margin и касания границы, заметки для `#eee8d8`/`#102a2e` и 48/64 px. Модель генерации не указывать: интерфейс встроенного `image_gen` не раскрывает её ID.


## Идентификация своего результата при параллельной генерации

Не выбирайте последний по времени файл из общей папки generated_images: он может принадлежать соседнему агенту. Сохраняйте только точный путь/данные из собственного tool result; фиксируйте исходный путь и SHA256 и обязательно просмотрите скопированный PNG. При неизвестном или неоднозначном пути эскалируйте координатору; не подставляйте чужой результат. Совпадение SHA256 разных предметов блокирует приёмку.


## Уточнение порядка запуска пользователем

Каждый следующий производитель выполняет только одну назначенную генерацию и передаёт PNG, компактный WebP, provenance и короткий QC координатору. Контрольные исходники уже проверены общим аудитом: повторно проверять их агенту не нужно. Все принятые замены интегрируются вместе, затем выполняется один общий этап сборки и тестирования игры. Первая завершавшаяся задача cloak+rotor была запущена до этого уточнения. Одновременно доступны только два производителя при работающем агенте производительности; остальные запускаются по освобождению слота.
