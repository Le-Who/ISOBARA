# Задание 04: prism и vest

> Историческое задание; выполнено и принято 28.09.2026. Актуальные статусы — в [jobs.json](../jobs.json), результат — в [отчёте интеграции](../../../evidence/asset-integration-checks.md). Не запускать повторно без нового подтверждённого дефекта. Ниже сохранены исходные требования.

**Владелец:** `asset-producer-04`  
**Параметры агента:** `gpt-6-luna`, `reasoning_effort=max`  
**Статус:** `accepted`
**Область вывода:** `output/assets/repair-candidates/04-upgrade-equipment/`

У prism зафиксированы посторонние фрагменты; отредактируйте только этот предмет. До edit просмотрите локальный референс через `view_image`, затем сделайте один отдельный вызов встроенного `image_gen` с `transparent_background: true`. Vest предварительно прошёл визуальную проверку без видимой причины для замены; убедитесь, что его исходный alpha и силуэт подходят, и не генерируйте, если проходит QC.

## Смысл и область владения

- `public/assets/prism.webp` — предметная иконка эффекта «Сквозная линия», то есть улучшения пробивания большего числа целей. Сохраните существующую форму призмы и оптические материалы; удалите именно лишние фрагменты.
- `public/assets/vest.webp` — защитная оболочка/броня и связанные улучшения здоровья, защиты и щита. Оставьте существующий WebP при успешной проверке.

## Промпт для prism

Use case: stylized-concept. Asset type: one isolated icon for the existing piercing/refraction upgrade. Edit Image 1, the exact existing prism icon. Preserve the prism's present optical-object identity, outline, facets, materials, proportions and palette; remove the foreign image fragments identified by audit and restore the clean complete silhouette. Do not turn it into another crystal or add a beam. Center the full prism with about 8% transparent margin. Match the project's detailed rendered-item finish and the reference lighting. Ensure its main outline and facets remain readable at 48 and 64 px on #102a2e and #eee8d8. Request a genuinely transparent background. Exactly one prism; no words, logo, border, pedestal, scene, extra crystal, detached light rays, debris or watermark. Do not redesign it or add lore.

**Референс и вызов:** просмотреть `E:\Projects\ISOBARA\public\assets\prism.webp` через `view_image`, затем использовать его как источник edit в одном вызове встроенного `image_gen` с `transparent_background=true`.

**Выход prism:** `output/assets/repair-candidates/04-upgrade-equipment/prism-source.png`, `output/assets/repair-candidates/04-upgrade-equipment/prism.webp`, `prism-provenance.json` и `prism-qc.md` в той же папке.

## Проверка vest без регенерации

Просмотреть `E:\Projects\ISOBARA\public\assets\vest.webp` через `view_image`. Подтвердить альфа-канал, полный узнаваемый предмет, чистый край, запас от краёв и читаемость при 48/64 px на светлом/тёмном фоне. Если всё верно — записать `accepted` без изменения существующего изображения. Любой новый дефект передать координатору до редактирования.

Возвратите точный промпт prism и его референс, PNG/WebP файлы, размеры, alpha-channel QC и bounds, отступ и касания края. Для обоих файлов сохраните сводку четырёх визуальных проверок: 48 и 64 px на обоих фонах. Не указывать неподтверждённую модель генерации.


## Идентификация своего результата при параллельной генерации

Не выбирайте последний по времени файл из общей папки generated_images: он может принадлежать соседнему агенту. Сохраняйте только точный путь/данные из собственного tool result; фиксируйте исходный путь и SHA256 и обязательно просмотрите скопированный PNG. При неизвестном или неоднозначном пути эскалируйте координатору; не подставляйте чужой результат. Совпадение SHA256 разных предметов блокирует приёмку.


## Уточнение порядка запуска пользователем

Каждый следующий производитель выполняет только одну назначенную генерацию и передаёт PNG, компактный WebP, provenance и короткий QC координатору. Контрольные исходники уже проверены общим аудитом: повторно проверять их агенту не нужно. Все принятые замены интегрируются вместе, затем выполняется один общий этап сборки и тестирования игры. Первая завершавшаяся задача cloak+rotor была запущена до этого уточнения. Одновременно доступны только два производителя при работающем агенте производительности; остальные запускаются по освобождению слота.
