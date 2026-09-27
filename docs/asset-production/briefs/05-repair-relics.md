# Задание 05: tonic и orb

**Владелец:** `asset-producer-05`  
**Параметры агента:** `gpt-6-luna`, `reasoning_effort=max`  
**Статус:** `queued`  
**Область вывода:** `output/assets/repair-candidates/05-repair-relics/`

Tonic имеет подтверждённые посторонние фрагменты. Исправляйте только его: сначала просмотрите исходник через `view_image`, затем вызовите встроенный `image_gen` отдельно для одного предмета с `transparent_background: true`. Orb предварительно чист; проверьте, что его alpha и силуэт подходят к текущему UI, и оставьте без генерации, если QC пройден.

## Смысл и область владения

- `public/assets/tonic.webp` — иконка полевого ремкомплекта, лечения и восстановления здоровья. Сохраните существующий флакон/контейнер и удалите лишние фрагменты.
- `public/assets/orb.webp` — шар-механизм, используемый для способности-импульса, улучшений силы способностей и босса Сборщика гроз. Аудит не выявил достаточного основания менять его.

## Промпт для tonic

Use case: stylized-concept. Asset type: one isolated icon for the existing repair kit and healing improvements. Edit Image 1, the exact existing tonic icon. Preserve its recognizable container/tonic identity, shape, closure, contents, proportions, materials and palette as shown; remove the foreign image fragments identified by the audit and clean the complete item's edge. Keep the contents within the container; do not add labels or medical symbols. Center the whole object with about 8% transparent margin. Match the project's detailed rendered-item style. Keep the silhouette distinct at 48 and 64 px on #102a2e and #eee8d8. Request a genuinely transparent background. One tonic only; no text, logo, frame, pedestal, scene, extra bottle, herbs, tools, detached droplets, debris or watermark. Do not redesign it or invent game content.

**Референс и вызов:** показать `E:\Projects\ISOBARA\public\assets\tonic.webp` через `view_image`; затем передать этот исходник как единственный edit-reference для одного вызова встроенного `image_gen`, `transparent_background=true`.

**Выход tonic:** `output/assets/repair-candidates/05-repair-relics/tonic-source.png`, `output/assets/repair-candidates/05-repair-relics/tonic.webp`, `tonic-provenance.json` и `tonic-qc.md` рядом.

## Проверка orb без регенерации

Показать `E:\Projects\ISOBARA\public\assets\orb.webp` через `view_image`; проверить реальный alpha, отсутствие срезов/чужих частей, достаточный прозрачный запас, контраст на `#102a2e` и `#eee8d8` при 48/64 px. При успехе — `accepted`; не создавать новый вариант.

Для tonic документируйте точный промпт, роль и путь референса, факт built-in edit, PNG/WebP кандидат, размеры и alpha bounds, отступ и касания. Для tonic и orb запишите видимость на четырёх фонах/размерах. Инструмент генерации не показывает модель-ID; не выводите его из названия агента.


## Идентификация своего результата при параллельной генерации

Не выбирайте последний по времени файл из общей папки generated_images: он может принадлежать соседнему агенту. Сохраняйте только точный путь/данные из собственного tool result; фиксируйте исходный путь и SHA256 и обязательно просмотрите скопированный PNG. При неизвестном или неоднозначном пути эскалируйте координатору; не подставляйте чужой результат. Совпадение SHA256 разных предметов блокирует приёмку.


## Уточнение порядка запуска пользователем

Каждый следующий производитель выполняет только одну назначенную генерацию и передаёт PNG, компактный WebP, provenance и короткий QC координатору. Контрольные исходники уже проверены общим аудитом: повторно проверять их агенту не нужно. Все принятые замены интегрируются вместе, затем выполняется один общий этап сборки и тестирования игры. Первая завершавшаяся задача cloak+rotor была запущена до этого уточнения. Одновременно доступны только два производителя при работающем агенте производительности; остальные запускаются по освобождению слота.
