/* ============================================================================
   cms-seed.js - встроенный «посевной» набор данных контент-системы GENGROUP.

   Назначение:
   1) FALLBACK. Если Google-таблица не настроена/недоступна/отвалилась - сайт
      рендерит рубрикатор и контент-план из этого файла и НЕ пустеет.
   2) ШАБЛОН. Ровно эта структура колонок выгружается в Google-таблицу (см.
      README-cms.md). SMM ведёт таблицу, сайт читает её при загрузке; этот seed
      остаётся страховкой и точкой отсчёта.

   Поля строки РУБРИКАТОРА:
     brand 'G'|'V', rubric, format, channel, task, freq, kpi, active(true/false)
   Поля строки ПЛАНА:
     id(уникальный, стабильный - НЕ переиспользовать), week, slot, brand 'G'|'V',
     channel, format, rubric, idea, hook, goal,
     status 'план'|'готово'|'опубликовано', url(на пост, если опубликовано),
     owner, situational(true/false)
   ========================================================================== */
window.GG_CMS_SEED = {
  updated: '2026-06-16',
  rubricator: [
    // GENGLASS · B2C
    { brand:'G', rubric:'До/после', format:'Reels, split-screen', channel:'IG, VK, YT Shorts', task:'охват', freq:'2/нед', kpi:'досмотр >50%, шеры', active:true },
    { brand:'G', rubric:'Сколько стоит на самом деле', format:'карусель + Reels', channel:'IG, VK', task:'продажа', freq:'1/нед', kpi:'сохранения, переходы в каталог', active:true },
    { brand:'G', rubric:'Грабли ремонта', format:'говорящая голова + b-roll', channel:'Reels, VK, YT', task:'доверие', freq:'1/нед', kpi:'комментарии, сохранения', active:true },
    { brand:'G', rubric:'ASMR-процесс', format:'Reels, чистый звук', channel:'IG, Pinterest, YT', task:'охват', freq:'1-2/нед', kpi:'досмотр, репосты', active:true },
    { brand:'G', rubric:'Мем / тренд-джек', format:'Reels тренд-аудио', channel:'IG, VK', task:'вовлечение', freq:'по ситуации', kpi:'охват не-подписчиков', active:true },
    { brand:'G', rubric:'Этот VS тот', format:'карусель, split Reels', channel:'IG, VK, Pinterest', task:'информирование', freq:'1/нед', kpi:'сохранения, дочитывание', active:true },
    { brand:'G', rubric:'Отзыв / кейс клиента', format:'UGC Reels + Stories', channel:'IG, VK', task:'доверие', freq:'1/нед', kpi:'переходы в профиль, заявки', active:true },
    { brand:'G', rubric:'Каталог в кадре', format:'Reels-листалка, Stories', channel:'IG, VK, Pinterest', task:'продажа', freq:'2/нед', kpi:'клики по ссылке', active:true },
    // VALONTI · B2D
    { brand:'V', rubric:'Материал крупно', format:'Reels макро, чистый звук', channel:'IG, Pinterest, YT', task:'охват целевой', freq:'2/нед', kpi:'сохранения, репины', active:true },
    { brand:'V', rubric:'Рождение изделия', format:'длинное -> нарезки', channel:'YT, Reels, VK', task:'доверие / авторство', freq:'1 длинное + 3-4 нарезки/нед', kpi:'досмотр, подписки целевых', active:true },
    { brand:'V', rubric:'Авторский разбор от Богдана', format:'говорящая голова, галерейный свет', channel:'Reels, YT, VK', task:'доверие', freq:'1/нед', kpi:'сохранения, переходы в личку', active:true },
    { brand:'V', rubric:'Нестандарт под объект', format:'кейс-карусель + Reels', channel:'IG, Pinterest, VK', task:'продажа B2D', freq:'1/нед', kpi:'запросы прайса, контакты', active:true },
    { brand:'V', rubric:'Деталь, которую не видит заказчик', format:'макро Reels + текст', channel:'IG, Pinterest', task:'информирование', freq:'1/нед', kpi:'сохранения, комментарии дизайнеров', active:true },
    { brand:'V', rubric:'Мастер за работой', format:'Reels, драматичный свет', channel:'IG, YT, VK', task:'доверие', freq:'1/нед', kpi:'досмотр, репосты в проф-сообщества', active:true },
    { brand:'V', rubric:'Spec / palette drop', format:'Pinterest-пины + карусель', channel:'Pinterest, IG', task:'pull / информирование', freq:'1-2/нед', kpi:'репины, заявки на образцы', active:true }
  ],
  plan: [
    { id:'w1-mon-g', week:1, slot:'Пн', brand:'G', channel:'IG/VK', format:'Reels', rubric:'До/после', idea:'До/после ванной', hook:'«дешевле, чем подумаете»', goal:'охват', status:'опубликовано', url:'https://instagram.com/p/example-genglass-1', owner:'SMM', situational:false },
    { id:'w1-tue-v', week:1, slot:'Вт', brand:'V', channel:'IG/Pin', format:'Reels макро', rubric:'Материал крупно', idea:'Срез Nero Marquina', hook:'«прожилку не повторить»', goal:'охват целевой', status:'опубликовано', url:'https://instagram.com/p/example-valonti-1', owner:'SMM', situational:false },
    { id:'w1-wed-g', week:1, slot:'Ср', brand:'G', channel:'IG/VK/Pin', format:'карусель', rubric:'Этот VS тот', idea:'7 ошибок при выборе', hook:'«сохрани, если ремонт»', goal:'сохранения', status:'готово', url:'', owner:'SMM', situational:false },
    { id:'w1-thu-v', week:1, slot:'Чт', brand:'V', channel:'YT->нарезки', format:'длинное', rubric:'Рождение изделия', idea:'Столешница, часть 1', hook:'«от блока до объекта»', goal:'доверие', status:'готово', url:'', owner:'Богдан', situational:false },
    { id:'w1-fri-g', week:1, slot:'Пт', brand:'G', channel:'IG/VK', format:'Reels', rubric:'ASMR-процесс', idea:'Резка стекла', hook:'«звук, который успокаивает»', goal:'охват', status:'план', url:'', owner:'SMM', situational:false },
    { id:'w1-sat-v', week:1, slot:'Сб', brand:'V', channel:'IG/Pin', format:'карусель', rubric:'Деталь', idea:'5 параметров ТЗ на камень', hook:'«сохраните в доску»', goal:'контакты', status:'план', url:'', owner:'SMM', situational:false },
    { id:'w1-sit-g', week:1, slot:'-', brand:'G', channel:'Stories', format:'ситуатив', rubric:'-', idea:'спецзаказ / тренд с колёс', hook:'-', goal:'вовлечение', status:'план', url:'', owner:'SMM', situational:true },
    { id:'w1-sit-v', week:1, slot:'-', brand:'V', channel:'Stories', format:'ситуатив', rubric:'-', idea:'нестандарт с колёс', hook:'-', goal:'доверие', status:'план', url:'', owner:'SMM', situational:true }
  ]
};
