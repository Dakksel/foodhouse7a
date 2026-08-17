/* =====================================================
   FOOD HOUSE — панель администратора
   Наличие + полный редактор меню (категории, позиции, цены)
   Требует роль "admin" в коллекции roles/{uid}
   ===================================================== */

const $ = sel => document.querySelector(sel);

const auth        = firebase.auth();
const db          = firebase.firestore();
const STATUS_DOC  = db.collection("status").doc("menu");
const MENU_DOC    = db.collection("menu").doc("structure");

let currentUnavailable = new Set();
let menuFlat        = { categories: [], items: [] }; // текущее состояние из Firestore
let menuDocExists   = false;
let unsubStatus  = null;
let unsubMenu    = null;

function cloneFlat(flat){ return JSON.parse(JSON.stringify(flat)); }
function escapeAttr(s){
  return String(s).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;");
}

/* ---------- РЕНДЕР: НАЛИЧИЕ ---------- */
function renderAvailability(){
  const wrap = $("#availList");
  wrap.innerHTML = MENU.map((g) => `
    <div class="admin-group">
      <h3 class="admin-group-title">${g.name}</h3>
      ${g.items.map((item) => {
        const off = currentUnavailable.has(item.id);
        return `
          <label class="admin-item ${off ? 'is-off' : ''}">
            <span class="admin-item-name">${item.name}</span>
            <span class="admin-toggle">
              <input type="checkbox" class="avail-cb" data-id="${item.id}" ${off ? '' : 'checked'}>
              <span class="admin-toggle-label">${off ? 'Нет в наличии' : 'В наличии'}</span>
            </span>
          </label>`;
      }).join("")}
    </div>
  `).join("");
}

/* ---------- РЕНДЕР: РЕДАКТОР МЕНЮ ---------- */
function renderMenuEditor(){
  const wrap = $("#menuEditor");

  if(!menuDocExists){
    wrap.innerHTML = `
      <div class="admin-init-box">
        <p>Меню в базе данных ещё не инициализировано. Нажмите кнопку ниже, чтобы загрузить туда текущее меню сайта — после этого его можно будет редактировать здесь.</p>
        <button id="initMenuBtn" class="admin-btn">Инициализировать меню в базе</button>
      </div>`;
    $("#initMenuBtn").addEventListener("click", ()=> saveMenu(MENU_SEED));
    return;
  }

  const cats  = menuFlat.categories;
  const items = menuFlat.items;

  wrap.innerHTML = cats.map(cat => `
    <div class="admin-menu-cat" data-cat-id="${cat.id}">
      <div class="admin-menu-cat-head">
        <input type="text" class="admin-cat-name-input" data-cat-id="${cat.id}" value="${escapeAttr(cat.name)}">
        <button class="admin-btn-small admin-save-cat" data-cat-id="${cat.id}">Сохранить</button>
        <button class="admin-btn-small admin-del-cat" data-cat-id="${cat.id}">Удалить категорию</button>
      </div>

      ${items.filter(it=>it.catId===cat.id).map(item => `
        <div class="admin-price-row" data-item-id="${item.id}">
          <input type="text" class="admin-item-name-input" data-item-id="${item.id}" value="${escapeAttr(item.name)}">
          <input type="number" class="admin-price-input" data-item-id="${item.id}" value="${item.price}" min="1" step="10">
          <span class="admin-price-currency">₸</span>
          <button class="admin-btn-small admin-save-item" data-item-id="${item.id}">Сохранить</button>
          <button class="admin-btn-small admin-del-item" data-item-id="${item.id}">Удалить</button>
        </div>
      `).join("")}

      <div class="admin-add-item-row">
        <input type="text" class="admin-new-item-name" data-cat-id="${cat.id}" placeholder="Название новой позиции">
        <input type="number" class="admin-new-item-price" data-cat-id="${cat.id}" placeholder="Цена" min="1" step="10">
        <button class="admin-btn-small admin-add-item" data-cat-id="${cat.id}">+ Добавить позицию</button>
      </div>
    </div>
  `).join("") + `
    <div class="admin-add-cat-row">
      <input type="text" id="newCatName" placeholder="Название новой категории (например БУРГЕР)">
      <select id="newCatColor">
        <option value="yellow">Жёлтая</option>
        <option value="red">Красная</option>
      </select>
      <button id="addCatBtn" class="admin-btn-small">+ Добавить категорию</button>
    </div>
  `;
}

/* ---------- СОХРАНЕНИЕ: НАЛИЧИЕ ---------- */
async function toggleAvailability(id, available){
  const status = $("#saveStatus");
  status.textContent = "Сохранение…";
  try{
    await STATUS_DOC.set({
      unavailable: available
        ? firebase.firestore.FieldValue.arrayRemove(id)
        : firebase.firestore.FieldValue.arrayUnion(id)
    }, { merge: true });
    status.textContent = "Сохранено ✓";
  }catch(e){
    console.error(e);
    status.textContent = "Ошибка сохранения наличия.";
  }
}

/* ---------- СОХРАНЕНИЕ: МЕНЮ ---------- */
async function saveMenu(newFlat){
  const status = $("#saveStatus");
  status.textContent = "Сохранение…";
  try{
    await MENU_DOC.set(newFlat);
    status.textContent = "Сохранено ✓ Обновится у всех клиентов мгновенно";
  }catch(e){
    console.error(e);
    status.textContent = "Ошибка сохранения. Проверьте интернет.";
  }
}

async function saveCategoryName(catId, newName){
  if(!newName.trim()) return;
  const next = cloneFlat(menuFlat);
  const cat = next.categories.find(c=>c.id===catId);
  if(cat) cat.name = newName.trim();
  await saveMenu(next);
}

async function deleteCategory(catId){
  const hasItems = menuFlat.items.some(it=>it.catId===catId);
  if(hasItems){
    alert("Сначала удалите все позиции в этой категории (или перенесите их в другую).");
    return;
  }
  if(!confirm("Удалить категорию?")) return;
  const next = cloneFlat(menuFlat);
  next.categories = next.categories.filter(c=>c.id!==catId);
  await saveMenu(next);
}

async function saveItem(itemId, newName, newPrice){
  const price = Number(newPrice);
  if(!newName.trim() || !price || price<=0){
    $("#saveStatus").textContent = "Проверьте название и цену (цена больше 0).";
    return;
  }
  const next = cloneFlat(menuFlat);
  const item = next.items.find(i=>i.id===itemId);
  if(item){ item.name = newName.trim(); item.price = price; }
  await saveMenu(next);
}

async function deleteItem(itemId){
  if(!confirm("Удалить позицию из меню?")) return;
  const next = cloneFlat(menuFlat);
  next.items = next.items.filter(i=>i.id!==itemId);
  await saveMenu(next);
}

async function addItem(catId, name, price){
  const p = Number(price);
  if(!name.trim() || !p || p<=0){
    $("#saveStatus").textContent = "Введите название и цену новой позиции.";
    return;
  }
  const next = cloneFlat(menuFlat);
  next.items.push({ id: genId("it"), catId, name: name.trim(), price: p });
  await saveMenu(next);
}

async function addCategory(name, color){
  if(!name.trim()){
    $("#saveStatus").textContent = "Введите название категории.";
    return;
  }
  const next = cloneFlat(menuFlat);
  next.categories.push({ id: genId("cat"), name: name.trim(), color });
  await saveMenu(next);
}

/* ---------- ИНИЦИАЛИЗАЦИЯ ПАНЕЛИ ---------- */
function initPanel(){
  if(unsubStatus) unsubStatus();
  if(unsubMenu)   unsubMenu();

  unsubStatus = STATUS_DOC.onSnapshot(snap=>{
    const data = snap.exists ? snap.data() : {};
    currentUnavailable = new Set(data.unavailable || []);
    renderAvailability();
  }, err=>{
    console.error(err);
    $("#saveStatus").textContent = "Не удалось загрузить наличие.";
  });

  unsubMenu = MENU_DOC.onSnapshot(snap=>{
    menuDocExists = snap.exists;
    menuFlat = snap.exists ? snap.data() : { categories: [], items: [] };
    if(snap.exists) rebuildMenuFromFlat(menuFlat); // чтобы вкладка "Наличие" тоже видела актуальные позиции
    renderAvailability();
    renderMenuEditor();
  }, err=>{
    console.error(err);
    $("#saveStatus").textContent = "Не удалось загрузить меню.";
  });
}

/* ---------- ВХОД / ВЫХОД + ПРОВЕРКА РОЛИ ---------- */
function showLogin(){
  $("#loginBox").style.display = "block";
  $("#panelBox").style.display = "none";
}
function showPanel(){
  $("#loginBox").style.display = "none";
  $("#panelBox").style.display = "block";
}

async function checkRoleAndInit(user){
  try{
    const roleSnap = await db.collection("roles").doc(user.uid).get();
    const role = roleSnap.exists ? roleSnap.data().role : null;
    if(role !== "admin"){
      $("#loginError").textContent = "У этого аккаунта нет прав администратора.";
      await auth.signOut();
      return;
    }
    showPanel();
    initPanel();
  }catch(e){
    console.error(e);
    $("#loginError").textContent = "Ошибка проверки доступа.";
    await auth.signOut();
  }
}

auth.onAuthStateChanged(user=>{
  if(user){
    checkRoleAndInit(user);
  } else {
    if(unsubStatus){ unsubStatus(); unsubStatus = null; }
    if(unsubMenu){   unsubMenu();   unsubMenu   = null; }
    showLogin();
  }
});

$("#loginBtn").addEventListener("click", async ()=>{
  const email = $("#opEmail").value.trim();
  const pass  = $("#opPass").value;
  const err   = $("#loginError");
  err.textContent = "";
  if(!email || !pass){ err.textContent = "Заполните email и пароль."; return; }
  try{
    await auth.signInWithEmailAndPassword(email, pass);
  }catch(e){
    err.textContent = "Неверный email или пароль.";
  }
});
$("#opPass").addEventListener("keydown", e=>{
  if(e.key === "Enter") $("#loginBtn").click();
});

$("#logoutBtn").addEventListener("click", ()=> auth.signOut());

/* ---------- СОБЫТИЯ: НАЛИЧИЕ ---------- */
$("#availList").addEventListener("change", e=>{
  const cb = e.target.closest(".avail-cb");
  if(!cb) return;
  toggleAvailability(cb.dataset.id, cb.checked);
});

/* ---------- СОБЫТИЯ: РЕДАКТОР МЕНЮ ---------- */
$("#menuEditor").addEventListener("click", e=>{
  const saveCatBtn = e.target.closest(".admin-save-cat");
  if(saveCatBtn){
    const input = document.querySelector(`.admin-cat-name-input[data-cat-id="${saveCatBtn.dataset.catId}"]`);
    saveCategoryName(saveCatBtn.dataset.catId, input.value);
    return;
  }

  const delCatBtn = e.target.closest(".admin-del-cat");
  if(delCatBtn){ deleteCategory(delCatBtn.dataset.catId); return; }

  const saveItemBtn = e.target.closest(".admin-save-item");
  if(saveItemBtn){
    const id = saveItemBtn.dataset.itemId;
    const nameInput  = document.querySelector(`.admin-item-name-input[data-item-id="${id}"]`);
    const priceInput = document.querySelector(`.admin-price-input[data-item-id="${id}"]`);
    saveItem(id, nameInput.value, priceInput.value);
    return;
  }

  const delItemBtn = e.target.closest(".admin-del-item");
  if(delItemBtn){ deleteItem(delItemBtn.dataset.itemId); return; }

  const addItemBtn = e.target.closest(".admin-add-item");
  if(addItemBtn){
    const catId = addItemBtn.dataset.catId;
    const nameInput  = document.querySelector(`.admin-new-item-name[data-cat-id="${catId}"]`);
    const priceInput = document.querySelector(`.admin-new-item-price[data-cat-id="${catId}"]`);
    addItem(catId, nameInput.value, priceInput.value);
    return;
  }

  const addCatBtn = e.target.closest("#addCatBtn");
  if(addCatBtn){
    addCategory($("#newCatName").value, $("#newCatColor").value);
    return;
  }
});

/* ---------- ВКЛАДКИ ---------- */
document.querySelectorAll(".admin-tab").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".admin-tab").forEach(b=>b.classList.remove("is-active"));
    btn.classList.add("is-active");
    $("#availTab").style.display = btn.dataset.tab === "avail" ? "block" : "none";
    $("#menuTab").style.display  = btn.dataset.tab === "menu"  ? "block" : "none";
  });
});
