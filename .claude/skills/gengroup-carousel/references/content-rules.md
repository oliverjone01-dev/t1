# Content Rules

Read this before writing any slide copy. Design makes a carousel look
publishable; copy makes it get saved. These rules are what separate a GENGROUP
carousel from generic AI output.

## HARD RULE: punctuation
Never use em dash "—" or en dash "–". Hyphen "-" only. Rewrite the sentence if a
dash is tempting. This applies to every slide and the caption.

## КЛИЕНТ-FIRST: structure from the pain, not the catalog

Every carousel starts from a real client problem and walks to the solution.
Order: **task -> solution -> fears -> budget -> process -> social proof -> CTA.**
The 7-slide arc in `slide-types.md` is this principle in carousel form.

Never open with the product. Open with what the client is afraid of getting
wrong, the money they could lose, or the decision they are stuck on.

## Hook slide: the only slide that matters first

If slide 1 does not stop the scroll, the other 6 are never seen. A strong hook
is one of:

- **Number + stakes**: "3 ошибки в стеклянной перегородке" / "8 мм против 30 000 ₽ переделки"
- **Contrarian**: "Дорогая фурнитура не спасёт тонкое стекло"
- **Direct question to the fear**: "Дверь играет через месяц? Вот почему"
- **Specific outcome**: "Расчёт перегородки под ваш проём за 24 часа"

Avoid: "Всё, что нужно знать о...", "Топ-5 советов" without stakes, anything a
generic account could post. One accent word in the headline (`.hl`), not three.

## Скользкая горка (mandatory) - каждый слайд тянет к следующему

Техника Сугармана: единственная задача каждого слайда - заставить пролистнуть на
следующий. Карусель смотрят на свайпах. Поэтому:

- **Последняя строка каждого слайда (кроме CTA) - открытая петля**: вопрос,
  недосказанность или обещание выгоды на следующем слайде. Заканчивай на `→`.
  Пример: "...а потом профиль приходится делать толще. Почему? →"
- Не закрывай мысль полностью на слайде - оставляй крючок.
- Слайд 1 (хук) обязан обещать ответ, а не давать его.
- Проверка: закрой следующий слайд рукой - хочется открыть? Если нет - переписать.

Это обязательная техника для каждой карусели, не опция.

## Anti-Slop standard (mandatory)

Every slide must pass the anti-median test: if a generic LLM could produce the
same line without GENGROUP context, rewrite it.

Rules:
1. **One concrete number per slide minimum.** mm, ₽, %, days, m², count.
   "8 мм от пролёта 90 см", not "качественное стекло".
2. **GENGROUP facts** when relevant: 16 000 m² production (Домодедово) is verified.
   Trust-band company figures - около 27 000 orders since 2018, 350+ projects
   (the repo-wide canon used by brand/SKILL.md, content-factory, geo-aeo) - are
   NOT yet verified by a 1С export: the cited source file is missing (see the
   escalation block in smm/public/index.html). Treat them as estimates to confirm
   before publishing, not as hard [ДАННЫЕ]. Zero invented stats - if you do not
   have the number, do not fabricate it, ask or omit.
3. **Factory-floor specificity**: name the actual failure mode, the real spec,
   the installation edge case. This is the voice of someone who makes the thing.
4. **Extractable**: each slide is a self-contained unit that makes sense alone.
5. **End on action**, not inspiration.

### Forbidden (AI slop)
- "В мире современного дизайна...", "Мы гордимся тем, что..."
- "Инновационные / уникальные / комплексные решения" without specifics
- "Широкий ассортимент" without numbers
- "позволяет реализовать", generic corporate filler
- Empty superlatives, three-adjective stacks, em dashes

Run the copy mentally through the `gengroup-humanizer-ru` standard: live rhythm,
short sentences, no канцелярит.

## Brand tone of voice

Match the brand. GENGLASS does not sound like VALONTI.

- **GENGLASS** - confident craftsman. Direct, technical when needed, warm.
  "Мы делаем. Вы получаете." Speaks from the factory floor.
- **VALONTI** - quiet luxury. Restraint. Short sentences. Let materials speak.
  "Камень. Металл. Стекло. Точка." Never loud, never salesy.
- **GENTERO** - professional partner, B2B. "1 объект = 6 зон. 1 подрядчик = 0 проблем."
- **METAL-GM** - industrial pragmatism, specs first. "Гибка, сварка, покраска -
  от чертежа до отгрузки за 10 дней." Contract production, not a marketplace brand.
- **GLASS-MEMORY** - respectful, dignified, never salesy. Craft and permanence.
  "Керамическая печать. Crystalvision. Память, которая не выцветает."

## Brand architecture guardrails (do not violate)
- VALONTI is never on marketplaces. Shower partitions are GENGLASS only.
- Steel memorials are GLASS-MEMORY, not Metal-GM.
- GENTERO core idea "1 объект = 6 зон" - stylistic lock-in across zones.
- Never mention ДомГласс / DomGlass / Glass-Store in any material.

## Caption + hashtags (deliver alongside the PNGs)

Write a caption that repeats the hook, expands one slide's point in 2-3
sentences, and ends with the CTA and the @handle. Then 8-15 hashtags mixing
broad (#стекляннаяперегородка) and niche (#лофтинтерьер #genglass). Keep the
brand voice in the caption too. No em dashes.

## ФЕНИКС self-audit (before delivery)

External-facing carousels target 9.9/10. Before handing over the PNGs, review
the contact sheet and score honestly. Do not inflate the number.

Check:
- [ ] Hook stops the scroll on its own, with a number or a stake
- [ ] Every slide has >=1 concrete number and zero slop phrases
- [ ] Brand theme correct (VALONTI light, others dark) and tone matches
- [ ] Gold used as punctuation, not flooded
- [ ] No em/en dashes anywhere, including the caption
- [ ] Dots and page numbers increment correctly
- [ ] Text inside the safe zone, nothing clipped, bottom-right light on slide 1
- [ ] PNG dimensions match the chosen format exactly
- [ ] CTA is one clear low-friction action

If any item fails, fix it and re-export before delivering. If the score is below
9.9, say so and state exactly what is weak rather than shipping it quietly.
