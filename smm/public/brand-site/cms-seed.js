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
  // ПРИМЕЧАНИЕ: даты в stages ниже - демонстрационные (конец июня / начало июля 2026),
  // показывают, как заполнять этапы и сроки. В реальной работе ведутся в Google-таблице.
  plan: [
    { id:'w1-mon-g', week:1, slot:'Пн', brand:'G', channel:'IG/VK', format:'Reels', rubric:'До/после', idea:'До/после ванной', hook:'«дешевле, чем подумаете»', goal:'охват', status:'опубликовано', url:'https://instagram.com/p/example-genglass-1', owner:'SMM', situational:false,
      media:'image', pubdate:'12.06.2026', alt:'Ванная до и после ремонта',
      cover:'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22600%22%20height%3D%22400%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%221%22%20y2%3D%221%22%3E%3Cstop%20offset%3D%220%22%20stop-color%3D%22%232A3947%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%234C6B82%22%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Crect%20width%3D%22600%22%20height%3D%22400%22%20fill%3D%22url(%23g)%22%2F%3E%3Ctext%20x%3D%2240%22%20y%3D%22360%22%20font-family%3D%22Arial%22%20font-size%3D%2230%22%20font-weight%3D%22bold%22%20fill%3D%22%23ffffff%22%20opacity%3D%220.92%22%3EGENGLASS%20%C2%B7%20%D0%B4%D0%BE%2F%D0%BF%D0%BE%D1%81%D0%BB%D0%B5%3C%2Ftext%3E%3C%2Fsvg%3E',
      text:'Ванная, которую вы не узнаете 🛁✨\n\nПоменяли одну деталь, а выглядит как полный ремонт. Свайпай до/после 👉\n\nСколько по-вашему это стоило? Пиши в комментах 💬\n\n#ремонт #ваннаякомната #дизайнинтерьера #genglass #доипосле' },
    { id:'w1-tue-v', week:1, slot:'Вт', brand:'V', channel:'IG/Pin', format:'Reels макро', rubric:'Материал крупно', idea:'Срез Nero Marquina', hook:'«прожилку не повторить»', goal:'охват целевой', status:'опубликовано', url:'https://instagram.com/p/example-valonti-1', owner:'SMM', situational:false,
      media:'image', pubdate:'13.06.2026', alt:'Макро-срез камня Nero Marquina',
      cover:'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22600%22%20height%3D%22400%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%221%22%20y2%3D%221%22%3E%3Cstop%20offset%3D%220%22%20stop-color%3D%22%233A2E12%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23B08A3E%22%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Crect%20width%3D%22600%22%20height%3D%22400%22%20fill%3D%22url(%23g)%22%2F%3E%3Ctext%20x%3D%2240%22%20y%3D%22360%22%20font-family%3D%22Arial%22%20font-size%3D%2230%22%20font-weight%3D%22bold%22%20fill%3D%22%23ffffff%22%20opacity%3D%220.92%22%3EVALONTI%20%C2%B7%20%D0%BC%D0%B0%D1%82%D0%B5%D1%80%D0%B8%D0%B0%D0%BB%3C%2Ftext%3E%3C%2Fsvg%3E',
      text:'Срез Nero Marquina под светом ⚫️\n\nЭту прожилку невозможно повторить, она одна на весь блок. Натуральный камень помнит миллионы лет 🪨\n\nДизайнерам: запросите образец в личку 📩\n\n#naturalstone #neromarquina #валонти #материал #интерьер' },
    { id:'w1-wed-g', week:1, slot:'Ср', brand:'G', channel:'IG/VK/Pin', format:'карусель', rubric:'Этот VS тот', idea:'7 ошибок при выборе', hook:'«сохрани, если ремонт»', goal:'сохранения', status:'готово', url:'', owner:'SMM', situational:false,
      media:'carousel', pubdate:'', alt:'',
      text:'7 ошибок при выборе, сохрани если делаешь ремонт 📌\n\nРазобрали на примерах, что реально влияет на срок службы 🔧\n\n#чеклист #ремонт #какбыбрать #genglass' },
    { id:'w1-thu-v', week:1, slot:'Чт', brand:'V', channel:'YT->нарезки', format:'длинное', rubric:'Рождение изделия', idea:'Столешница, часть 1', hook:'«от блока до объекта»', goal:'доверие', status:'готово', url:'', owner:'Богдан', situational:false,
      shot:'Цех VALONTI: слэб Nero Marquina на столе раскроя. Снять 4 опорных кадра: 1) блок камня крупно, прожилка; 2) разметка и рез; 3) руки мастера на кромке; 4) готовая столешница под галерейным светом. Горизонт ровный, без людей в кадре кроме рук Богдана.',
      howto:'Длинное 16:9 для YouTube (база), из него 3-4 вертикальные нарезки 9:16 по 30-45с. Хук в первые 3с: контраст «сырой блок -> финиш». Чистый звук станка, без музыки поверх голоса. Галерейный свет, без ценников и текста-баннеров в кадре.',
      ref:'https://www.pinterest.com/search/pins/?q=stone%20fabrication%20honed',
      participants:'Богдан (голос-эксперт, руки), оператор-Аня',
      stages:[{label:'сценарий',who:'Аня',due:'30.06'},{label:'съёмка',who:'Аня + Богдан',due:'02.07'},{label:'монтаж длинного',who:'подрядчик',due:'05.07'},{label:'нарезки',who:'Аня',due:'07.07'},{label:'обложка',who:'Кирилл',due:'07.07'},{label:'согл смысла',who:'Иван',due:'08.07'}] },
    { id:'w1-fri-g', week:1, slot:'Пт', brand:'G', channel:'IG/VK', format:'Reels', rubric:'ASMR-процесс', idea:'Резка стекла', hook:'«звук, который успокаивает»', goal:'охват', status:'план', url:'', owner:'SMM', situational:false,
      shot:'Производство Домодедово: раскрой стекла. Кадры: 1) стеклорез по линии, макро; 2) разлом по резу; 3) шлифовка кромки, искры/вода; 4) чистый край на просвет. Без лиц, фокус на инструменте и материале.',
      howto:'Reels 9:16, 15-25с. Чистый звук процесса (ASMR), без голоса и музыки. Хук - самый сочный звук в первые 3с (разлом). Субтитр-плашка минимум, бренд-водяной знак в углу.',
      ref:'архетип: «glass cutting ASMR» / satisfying manufacturing [ПРОВЕРИТЬ перед съёмкой]',
      participants:'мастер цеха, оператор-Аня',
      stages:[{label:'сценарий',who:'SMM',due:'01.07'},{label:'съёмка',who:'Аня',due:'03.07'},{label:'монтаж',who:'Аня',due:'04.07'},{label:'обложка',who:'Кирилл',due:'04.07'},{label:'публикация',who:'SMM',due:'05.07'}] },
    { id:'w1-sat-v', week:1, slot:'Сб', brand:'V', channel:'IG/Pin', format:'карусель', rubric:'Деталь', idea:'5 параметров ТЗ на камень', hook:'«сохраните в доску»', goal:'контакты', status:'план', url:'', owner:'SMM', situational:false,
      shot:'Карусель-спека: 5 слайдов, каждый - один параметр ТЗ (порода, финиш honed/polished, толщина, кромка, стык слэбов). Макро-фото фактуры + короткая подпись. Слайд 6 - CTA «запросить Sample-box».',
      howto:'Карусель 4:5, 6 слайдов под сохранение в доску проекта. Язык материала (honed, слэб, прожилка), без ценников. Первый слайд - сильный макро-крючок. Pinterest-пин из обложки.',
      ref:'механика «spec-карточка -> сохранение в доску» (audience.html)',
      participants:'дизайнер-консультант (текст), Кирилл (вёрстка)',
      stages:[{label:'текст/спека',who:'Аня',due:'02.07'},{label:'фото материала',who:'Аня',due:'03.07'},{label:'вёрстка карусели',who:'Кирилл',due:'04.07'},{label:'согл смысла',who:'Иван',due:'05.07'},{label:'публикация',who:'SMM',due:'06.07'}] },
    { id:'w1-sit-g', week:1, slot:'-', brand:'G', channel:'Stories', format:'ситуатив', rubric:'-', idea:'спецзаказ / тренд с колёс', hook:'-', goal:'вовлечение', status:'план', url:'', owner:'SMM', situational:true },
    { id:'w1-sit-v', week:1, slot:'-', brand:'V', channel:'Stories', format:'ситуатив', rubric:'-', idea:'нестандарт с колёс', hook:'-', goal:'доверие', status:'план', url:'', owner:'SMM', situational:true }
  ],
  // снэпшоты статистики постов (демо). На вкладке «Статистика» в таблице: одна
  // строка = один снэпшот: id, охват, сохранения, переходы, контакты, тип(48h/7d), дата.
  stats: [
    { id:'w1-mon-g', reach:18420, saves:640, clicks:512, contacts:0, er:6.3, snap:'7d', date:'19.06.2026' },
    { id:'w1-mon-g', reach:12030, saves:410, clicks:300, contacts:0, er:5.9, snap:'48h', date:'14.06.2026' },
    { id:'w1-tue-v', reach:3240, saves:210, clicks:95, contacts:14, er:9.8, snap:'7d', date:'20.06.2026' }
  ]
};
