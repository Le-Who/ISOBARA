# Задание 01: cloak и rotor

**Владелец:** текущий агент `equipment_audit`  
**Параметры агента:** `gpt-6-luna`, `reasoning_effort=max`  
**Статус:** `generating`  
**Область вывода:** `output/assets/equipment-repair/`

Это задание принадлежит уже работающему аудитору. Другие агенты не открывают и не редактируют эти два файла. По контакт-листу подтверждён срез силуэта на обеих иконках. Проверьте отдельные исходники и альфа-канал; затем сделайте два раздельных edit-вызова встроенного `image_gen`, один для cloak и один для rotor, каждый с `transparent_background: true`. Не собирайте их в один лист и не заменяйте оба одной генерацией. До каждого редактирования просмотрите соответствующий исходник через `view_image` и передайте его как референс. Если кандидат аудитора уже устранил дефект и проходит QC, повторно его не генерируйте.

## Смысл и проверка

- `public/assets/cloak.webp` — плащ, который используется для рывка, скорости и соответствующих улучшений. Сохраните текущую форму, цвет ткани и существующую фурнитуру; задача — вернуть в кадр полный силуэт.
- `public/assets/rotor.webp` — иконка инструмента Аэролога, ветрового босса и улучшений скорости/вихря. Сохраните исходный ротор и его детали; верните только отсутствующую часть силуэта.

Обе картинки должны содержать один предмет по центру, целый силуэт и около 8% прозрачного запаса. Проверить настоящее прозрачное поле, альфа-bounds, касания границ, затем полный размер и 48/64 px на `#102a2e` и `#eee8d8`. Не добавлять части одежды, лопасти или украшения, которых нет в референсе.

## Промпт для cloak

Use case: stylized-concept. Asset type: one isolated icon for the existing dash and speed-upgrade cloak. Edit Image 1, the exact existing cloak icon. Keep its present garment identity, broad pale worn panels, muted teal edging, folds and existing clasp or fittings as shown; repair the clipped silhouette only. Show the complete cloak centered, with every tip and top detail inside the canvas and about 8% clear transparent margin. Match the project's detailed rendered item style and preserve the reference materials and palette. Make the whole cloak readable at 48 and 64 px on #102a2e and #eee8d8. Request a genuinely transparent background. One item only; no text, logo, frame, pedestal, scene, extra cloth, extra accessories, debris, shadow cloud or watermark. Do not redesign the item or invent lore.

**Референс и вызов:** сначала показать `E:\Projects\ISOBARA\public\assets\cloak.webp` через `view_image`, затем вызвать встроенный `image_gen` для edit ровно одного изображения с `referenced_image_paths` на этот исходник и `transparent_background=true`. Точный кандидат: `output/assets/equipment-repair/cloak.webp`; исходный PNG, полученный инструментом, сохранить рядом как `cloak-source.png`.

## Промпт для rotor

Use case: stylized-concept. Asset type: one isolated icon for the existing Aerologist instrument and wind-boss marker. Edit Image 1, the exact existing rotor icon. Preserve the rotor's current recognizable construction, proportions, materials, colors and details; repair the clipped outer silhouette only. Show one complete rotor centered, including all existing blades or outer parts, with about 8% clear transparent margin. Match the project's detailed rendered item style and the reference's surface treatment. Keep its main silhouette legible at 48 and 64 px against #102a2e and #eee8d8. Request a genuinely transparent background. One item only; no text, logo, frame, pedestal, scene, extra blades, extra device, detached debris, glow cloud or watermark. Do not redesign it or invent lore.

**Референс и вызов:** сначала показать `E:\Projects\ISOBARA\public\assets\rotor.webp` через `view_image`, затем вызвать встроенный `image_gen` для edit ровно одного изображения с `referenced_image_paths` на этот исходник и `transparent_background=true`. Точный кандидат: `output/assets/equipment-repair/rotor.webp`; исходный PNG сохранить рядом как `rotor-source.png`.

Для каждого файла зафиксировать точный промпт, исходный референс, пути PNG/WebP, размеры, alpha и bounds, запас от края, визуальную проверку на обоих фонах и в обоих малых размерах. Название или ID модели генератора не указывать: встроенный инструмент его не раскрывает.


## Идентификация своего результата при параллельной генерации

Не выбирайте последний по времени файл из общей папки generated_images: он может принадлежать соседнему агенту. Сохраняйте только точный путь/данные из собственного tool result; фиксируйте исходный путь и SHA256 и обязательно просмотрите скопированный PNG. При неизвестном или неоднозначном пути эскалируйте координатору; не подставляйте чужой результат. Совпадение SHA256 разных предметов блокирует приёмку.


## Уточнение порядка запуска пользователем

Каждый следующий производитель выполняет только одну назначенную генерацию и передаёт PNG, компактный WebP, provenance и короткий QC координатору. Контрольные исходники уже проверены общим аудитом: повторно проверять их агенту не нужно. Все принятые замены интегрируются вместе, затем выполняется один общий этап сборки и тестирования игры. Первая завершавшаяся задача cloak+rotor была запущена до этого уточнения. Одновременно доступны только два производителя при работающем агенте производительности; остальные запускаются по освобождению слота.
