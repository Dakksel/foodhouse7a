/* =====================================================
   FOOD HOUSE — данные меню
   Стартовые (сид) данные — используются, пока админ не
   инициализирует "живое" меню в Firestore (кнопка в панели
   администратора). После этого сайт и обе панели работают
   с данными из Firestore (документ menu/structure).
   ===================================================== */

const MENU_SEED = {
  categories: [
    { id:"c0", name:"ДОНЕР",         color:"yellow" },
    { id:"c1", name:"ШАУРМА",        color:"yellow" },
    { id:"c2", name:"ТҮРІК ДОНЕРІ",  color:"yellow" },
    { id:"c3", name:"СНЕКЕТ",        color:"red" },
    { id:"c4", name:"ХОТ-ДОГ",       color:"red" },
    { id:"c5", name:"STREET BOX",    color:"red" },
    { id:"c6", name:"БУРГЕР",        color:"red" },
    { id:"c7", name:"ПИЦЦА",         color:"red" },
    { id:"c8", name:"ТВИСТЕР",       color:"red" },
    { id:"c9", name:"ЧИКЕН",         color:"yellow" },
  ],
  items: [
    { id:"c0-0", catId:"c0", name:"Донер тауық етінен", price:1690 },
    { id:"c0-1", catId:"c0", name:"Донер сиыр етінен", price:1790 },
    { id:"c0-2", catId:"c0", name:"Донер аралас", price:1790 },

    { id:"c1-0", catId:"c1", name:"Шаурма тауық етінен", price:1290 },
    { id:"c1-1", catId:"c1", name:"Шаурма сиыр етінен", price:1390 },
    { id:"c1-2", catId:"c1", name:"Шаурма аралас", price:1390 },

    { id:"c2-0", catId:"c2", name:"Түрік донері тауық етінен", price:1690 },
    { id:"c2-1", catId:"c2", name:"Түрік донері сиыр етінен", price:1790 },
    { id:"c2-2", catId:"c2", name:"Түрік донері аралас", price:1790 },

    { id:"c3-0", catId:"c3", name:"Фри картоп", price:890 },
    { id:"c3-1", catId:"c3", name:"Наггетстер", price:990 },
    { id:"c3-2", catId:"c3", name:"Картоп тілімдері", price:990 },
    { id:"c3-3", catId:"c3", name:"Стрипстер", price:1790 },

    { id:"c4-0", catId:"c4", name:"Хот-дог классикалық", price:890 },
    { id:"c4-1", catId:"c4", name:"Хот-дог Big", price:1090 },

    { id:"c5-0", catId:"c5", name:"Street Box", price:1990 },

    { id:"c6-0", catId:"c6", name:"Бургер классикалық", price:1690 },
    { id:"c6-1", catId:"c6", name:"Бургер Цезарь", price:1890 },
    { id:"c6-2", catId:"c6", name:"Бургер Италиялық", price:2390 },
    { id:"c6-3", catId:"c6", name:"Бургер Мексикалық", price:2390 },

    { id:"c7-0", catId:"c7", name:"Маргарита", price:2190 },
    { id:"c7-1", catId:"c7", name:"Пепперони", price:2490 },
    { id:"c7-2", catId:"c7", name:"Саңырауқұлақ қосылған тауық еті", price:2690 },
    { id:"c7-3", catId:"c7", name:"4 мезгіл", price:2790 },
    { id:"c7-4", catId:"c7", name:"Тартылған ет қосылған", price:2690 },
    { id:"c7-5", catId:"c7", name:"Тәтті", price:2590 },

    { id:"c8-0", catId:"c8", name:"Твистер", price:1690 },

    { id:"c9-0", catId:"c9", name:"Қанаттар 8 шт", price:2090 },
    { id:"c9-1", catId:"c9", name:"Қанаттар 15 шт", price:3490 },
    { id:"c9-2", catId:"c9", name:"Қанаттар 24 шт", price:5290 },
  ]
};

/* Рабочие данные (перезаписываются "живыми" данными из Firestore) */
let MENU  = [];
let ITEMS = [];

/* Собрать MENU (категории с вложенными items) и ITEMS (плоский список)
   из "плоской" структуры {categories, items} — используется и для
   сид-данных, и для live-данных из Firestore */
function rebuildMenuFromFlat(flat){
  const categories = (flat && flat.categories) || [];
  const items = (flat && flat.items) || [];
  ITEMS = items;
  MENU = categories.map(cat => ({
    ...cat,
    items: items.filter(it => it.catId === cat.id)
  }));
}

/* генератор случайных ID для новых категорий/позиций, добавленных через админку */
function genId(prefix){
  return prefix + "_" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}

rebuildMenuFromFlat(MENU_SEED);
