# Задание 07: void

> Историческое задание; выполнено и принято 28.09.2026. Актуальные статусы — в [jobs.json](../jobs.json), результат — в [отчёте интеграции](../../../evidence/asset-integration-checks.md). Не запускать повторно без нового подтверждённого дефекта. Ниже сохранены исходные требования.

Один агент gpt-6-luna, reasoning_effort=max. Один предмет, один вызов встроенного image_gen, transparent_background:true. Повторный крупный просмотр подтвердил срез верхних металлических дуг (53 пикселя верхней границы при alpha>=16).

До edit посмотреть E:/Projects/ISOBARA/public/assets/void.webp через view_image, затем передать точный путь в referenced_image_paths.

Промпт:

Edit Image 1: restore the complete upper outline of this exact dark weather-forecast relic. Preserve its black stone egg body, aged brass curved cage blades and central luminous violet spiral lens. One isolated complete object, same detailed worn item-render style, native transparent background, all upper and lower metal tips fully visible, centered with 10 percent transparent margin on each side. No text, frame, extra items, detached debris, background scene or external glow cloud. Keep its identity; repair the crop rather than copy it.

Сохранить только собственный exact output_hint, никогда не newest из общей папки. Каталог output/assets/repair-candidates/07-void-repair/: void-source.png, void.webp (lossless, max384px, уменьшить целый холст без crop), provenance.json с промптом/путём/SHA256 и qc.json с alpha/bbox/краями. Просмотреть light/dark и 48/64px. Никаких игровых тестов/правок shared файлов; передать координатору для общей интеграции и одного этапа тестов.
