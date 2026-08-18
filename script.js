/* =====================================================
   FOOD HOUSE — menu data + cart + WhatsApp redirect
   ===================================================== */

const PHONE = "77001114856"; // international format, no "+"

/* ---------- 0. CONFIG ---------- */
const DELIVERY_THRESHOLD = 4000;  // ₸ — orders at or above this get free delivery
const DELIVERY_FEE       = 700;   // ₸ — charged when subtotal is below threshold

/* ---------- 1. MENU ---------- */
/* MENU и ITEMS теперь определены в menu-data.js (общий файл с панелью оператора) */

/* ---------- 2. STATE ---------- */
const state = { unavailable: new Set() };   // subTotal, delivery, grand, unavailable — популируются ниже
let cart = {};      // { id: qty }

const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

/* ---------- 3. RENDER ---------- */
function renderChips(){
  const wrap = $("#cats");
  wrap.innerHTML = MENU.map((g,i)=>
    `<button class="cat-chip ${i===0?'active':''}" data-id="${g.id}">${g.name}</button>`
  ).join("");
}

function renderMenu(){
  const wrap = $("#menu");
  wrap.innerHTML = MENU.map((g)=>`
    <section class="cat-section" id="cat-${g.id}" style="grid-column:1/-1">
      <h2 style="color:var(--red);border-bottom:2px solid var(--red);padding-bottom:6px;margin:18px 0 4px;letter-spacing:1px;text-transform:uppercase">${g.name}</h2>
    </section>
    ${g.items.map((item)=>{
      const off = state.unavailable.has(item.id);
      return `
        <div class="card ${off?'out-of-stock':''}">
          <div class="card-body">
            <h3>${item.name}</h3>
            ${off ? `<p class="out-badge">Нет в наличии</p>` : `<p class="desc">&nbsp;</p>`}
            <div class="price">${item.price.toLocaleString("ru-RU")} ₸</div>
            <div class="qty" data-id="${item.id}">
              <button class="minus" ${off?'disabled':''} aria-label="Убрать">−</button>
              <span>0</span>
              <button class="plus" ${off?'disabled':''} aria-label="Добавить">+</button>
            </div>
          </div>
        </div>`;
    }).join("")}
  `).join("");
}

/* ---------- 4. CART LOGIC ---------- */
function add(id){
  if(state.unavailable.has(id)) return; // товар временно недоступен
  cart[id] = (cart[id]||0) + 1; updateCart();
}
function sub(id){ if(!cart[id]) return; cart[id]--; if(cart[id]<=0) delete cart[id]; updateCart(); }

function updateCart(){
  /* counters on cards */
  $$(".qty").forEach(el=>{
    const id = el.dataset.id;
    el.querySelector("span").textContent = cart[id]||0;
  });

  /* top-bar badge + total */
  const count = Object.values(cart).reduce((a,b)=>a+b,0);
  const total = Object.entries(cart).reduce((sum,[id,q])=>{
    const it = ITEMS.find(x=>x.id===id); return sum + (it.price*q);
  },0);
  $("#cartBadge").textContent = count;
  $("#cartTotal").textContent = total.toLocaleString("ru-RU") + " ₸";

  /* drawer list */
  const list = $("#cartList");
  list.innerHTML = Object.entries(cart).map(([id,q])=>{
    const it = ITEMS.find(x=>x.id===id);
    return `<li>
      <span class="name">${it.name} × ${q}</span>
      <span class="price-col">${(it.price*q).toLocaleString("ru-RU")} ₸</span>
      <button class="rm" data-id="${id}" aria-label="Удалить">🗑</button>
    </li>`;
  }).join("");
  $("#emptyMsg").style.display = count?"none":"block";
  $("#orderForm").style.display = count?"block":"none";

  /* delivery fee */
  let fee = 0, hint = "", hintClass = "";
  if(total === 0){
    fee = 0; hint = "";
  } else if(total < DELIVERY_THRESHOLD){
    fee = DELIVERY_FEE;
    const need = DELIVERY_THRESHOLD - total;
    hint = `+${need.toLocaleString("ru-RU")} ₸ до бесплатной доставки`;
  } else {
    fee = 0;
    hint = "бесплатно 🎉";
    hintClass = "success";
  }
  $("#deliveryFee").textContent = fee ? `+${fee.toLocaleString("ru-RU")} ₸` : "бесплатно";
  $("#deliveryHint").textContent = hint;
  $("#deliveryHint").className = "hint-inline " + hintClass;

  const grand = total + fee;
  $("#subTotal").textContent = total.toLocaleString("ru-RU") + " ₸";
  $("#grandTotal").textContent = grand.toLocaleString("ru-RU") + " ₸";

  state.subTotal = total;
  state.delivery = fee;
  state.grand    = grand;
}

/* ---------- 4b. НАЛИЧИЕ ТОВАРОВ (синхронизация с панелью оператора) ---------- */
function applyAvailability(unavailableIds){
  state.unavailable = new Set(unavailableIds);

  /* если товар, который уже лежит в корзине, выключили — убираем и предупреждаем */
  const removed = [];
  Object.keys(cart).forEach(id=>{
    if(state.unavailable.has(id)){
      const it = ITEMS.find(x=>x.id===id);
      if(it) removed.push(it.name);
      delete cart[id];
    }
  });

  renderMenu();
  updateCart();

  if(removed.length){
    alert(`К сожалению, закончилось: ${removed.join(", ")}. Товар убран из корзины.`);
  }
}

function subscribeAvailability(){
  if(typeof db === "undefined"){
    console.warn("Firebase не настроен — статус наличия работать не будет.");
    return;
  }
  db.collection("status").doc("menu").onSnapshot(
    snap=>{
      const data = snap.exists ? snap.data() : {};
      applyAvailability(data.unavailable || []);
    },
    err=>{ console.error("Ошибка синхронизации наличия:", err); }
  );
}

/* ---------- 4c. МЕНЮ (категории/позиции/цены — синхронизация с панелью администратора) ---------- */
function subscribeMenu(){
  if(typeof db === "undefined") return;
  db.collection("menu").doc("structure").onSnapshot(
    snap=>{
      if(!snap.exists) return; // ещё не инициализировано администратором — используем сид-данные
      rebuildMenuFromFlat(snap.data());
      renderChips();
      renderMenu();
      updateCart();
    },
    err=>{ console.error("Ошибка синхронизации меню:", err); }
  );
}

/* ---------- 5. DRAWER OPEN/CLOSE ---------- */
function openDrawer(){ $("#drawer").classList.add("on"); $("#overlay").classList.add("on"); }
function closeDrawer(){ $("#drawer").classList.remove("on"); $("#overlay").classList.remove("on"); }

/* ---------- 6. WHATSAPP REDIRECT ---------- */
function buildMessage(){
  const name = $("#custName").value.trim();
  const addr = $("#custAddress").value.trim();
  const gate = $("#custGate").value.trim();
  const pay  = $("#custPay").value;
  const note = $("#custNote").value.trim();

  if(!name || !addr){ alert("Пожалуйста, заполните имя и адрес доставки."); return null; }

  const lines = Object.entries(cart).map(([id,q])=>{
    const it = ITEMS.find(x=>x.id===id);
    return `• ${it.name} × ${q} — ${(it.price*q).toLocaleString("ru-RU")} ₸`;
  });

  const sub   = state.subTotal;
  const fee   = state.delivery;
  const grand = state.grand;
  const feeLine = fee ? `• Доставка: +${fee.toLocaleString("ru-RU")} ₸` : `• Доставка: бесплатно`;

  return [
    "   Новый заказ — Food House ",
    "",
    `  Имя: ${name}`,
    `  Адрес: ${addr}`,
    gate ? `  Домофон/этаж: ${gate}` : null,
    `  Оплата: ${pay}`,
    "",
    " Заказ: ",
    ...lines,
    "",
    ` Сумма: ${sub.toLocaleString("ru-RU")} ₸`,
    feeLine,
    `  Итого: ${grand.toLocaleString("ru-RU")} ₸ `,
    note ? `\nКомментарий: ${note}` : "",
  ].filter(Boolean).join("\n");
}

/* Удаляет любые эмодзи (в т.ч. набранные вручную в комментарии) из текста заказа */
function stripEmoji(text){
  return text
    // сами эмодзи (основной диапазон + доп. символы)
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu, "")
    // модификаторы: variation selector, ZWJ, тон кожи, региональные буквы (флаги)
    .replace(/[\u{FE0F}\u{FE0E}\u{200D}\u{1F3FB}-\u{1F3FF}\u{1F1E6}-\u{1F1FF}]/gu, "")
    // подчищаем двойные пробелы, которые могли остаться на месте эмодзи
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ \n/g, "\n");
}

function sendToWhatsApp(){
  let msg = buildMessage();
  if(!msg) return;
  msg = stripEmoji(msg);
  const url = `https://wa.me/${PHONE}?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank");
}

/* ---------- 7. EVENT WIRING ---------- */
function init(){
  renderChips();
  renderMenu();
  updateCart();
  subscribeAvailability();
  subscribeMenu();

  /* переключение категорий (обработчик один раз — renderChips() только меняет разметку) */
  $("#cats").addEventListener("click", e=>{
    const b = e.target.closest(".cat-chip"); if(!b) return;
    $$(".cat-chip").forEach(c=>c.classList.remove("active"));
    b.classList.add("active");
    document.getElementById(`cat-${b.dataset.id}`)?.scrollIntoView({behavior:"smooth",block:"start"});
  });

  /* click delegation for + / - */
  $("#menu").addEventListener("click", e=>{
    const q = e.target.closest(".qty"); if(!q) return;
    const id = q.dataset.id;
    if(e.target.classList.contains("plus")) add(id);
    else if(e.target.classList.contains("minus")) sub(id);
  });

  /* drawer */
  $("#cartBtn").addEventListener("click", openDrawer);
  $("#closeDrawer").addEventListener("click", closeDrawer);
  $("#overlay").addEventListener("click", closeDrawer);

  /* remove single line */
  $("#cartList").addEventListener("click", e=>{
    const b = e.target.closest(".rm"); if(!b) return;
    delete cart[b.dataset.id]; updateCart();
  });

  /* send */
  $("#sendBtn").addEventListener("click", sendToWhatsApp);
}

document.addEventListener("DOMContentLoaded", init);
