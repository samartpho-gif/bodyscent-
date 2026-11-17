const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbywsAnsjktjCEeV5fkEtKM7dyFbXcsFWJ1Rs8NIVk0C5deK4bPQFiRpKcI-o2Kt5vljUg/exec';


const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRaHLuhNQByERCNFANDszHS5sg7nAkm9aqb3RJd3_OOR4_KiZcI6KS-7V3L1bthDCmPSQwwyAjNBwTY/pub?output=csv';

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('product-list') && document.getElementById('filter-bar')) {
    initProductPage();
  }
  if (document.getElementById('orderForm')) {
    initOrderPage();
  }
  if (document.querySelector('#ordersTable tbody')) {
    initAdminPage();
  }
});

// ============================================================================
// ส่วนที่ 1: หน้าสินค้า (product.html)
// ============================================================================
let allProducts = [];

async function initProductPage() {
  const filterBar = document.getElementById('filter-bar');
  const productList = document.getElementById('product-list');

  const moods = [
    { key: 'all', label: 'ทั้งหมด' },
    { key: 'fresh', label: 'Fresh' },
    { key: 'sweet', label: 'Sweet' },
    { key: 'confident', label: 'Confident' },
    { key: 'romance', label: 'Romance' }
  ];

  // อ่าน URL parameter ?mood=xxx
  const urlParams = new URLSearchParams(window.location.search);
  const initialMood = (urlParams.get('mood') || 'all').toLowerCase();

  // สร้างปุ่มกรองใน #filter-bar
  filterBar.innerHTML = '';
  moods.forEach(m => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'filter-btn' + (m.key === initialMood ? ' active' : '');
    btn.textContent = m.label;
    btn.dataset.mood = m.key;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderProducts(m.key);
    });
    filterBar.appendChild(btn);
  });

  // โหลดข้อมูลจาก products.json
  try {
    const response = await fetch('products.json');
    if (!response.ok) throw new Error('ไม่สามารถโหลดไฟล์ products.json ได้');
    allProducts = await response.json();
    renderProducts(initialMood);
  } catch (error) {
    console.error(error);
    productList.innerHTML = '<p style="text-align:center; grid-column:1/-1;">ไม่สามารถโหลดรายการสินค้าได้ กรุณาเปิดผ่าน Web Server (เช่น Live Server หรือ Vercel)</p>';
  }
}

function renderProducts(selectedMood) {
  const productList = document.getElementById('product-list');
  const filtered = selectedMood === 'all'
    ? allProducts
    : allProducts.filter(item => item.mood.toLowerCase() === selectedMood);

  if (filtered.length === 0) {
    productList.innerHTML = '<p style="text-align:center; grid-column:1/-1;">ไม่พบสินค้าในหมวดหมู่นี้</p>';
    return;
  }

  productList.innerHTML = filtered.map(product => {
    const orderUrl = `order.html?item=${encodeURIComponent(product.name)}&price=${encodeURIComponent(product.price)}`;
    return `
      <article class="product-card">
        <div class="product-img-wrap">
          <img src="${product.image}" alt="${product.name}" loading="lazy">
        </div>
        <div class="product-info">
          <span class="product-tag">
            <span class="tag-dot ${product.mood}"></span>
            ${product.mood} &bull; ${product.type === 'rollon' ? 'Roll-on' : 'Body Mist'}
          </span>
          <h3 class="product-name">${product.name}</h3>
          <p class="product-desc">${product.description}</p>
          <div class="product-meta">
            <span class="product-size">ขนาด ${product.size}</span>
            <span class="product-price">฿${product.price}</span>
          </div>
          <a href="${orderUrl}" class="btn-outline">สั่งซื้อ</a>
        </div>
      </article>
    `;
  }).join('');
}

// ============================================================================
// ส่วนที่ 2: หน้าสั่งซื้อ (order.html) - ส่งข้อมูลเข้า Google Apps Script
// ============================================================================
function initOrderPage() {
  const params = new URLSearchParams(window.location.search);
  const itemParam = params.get('item') || '';
  const priceParam = params.get('price') || '';

  const itemsInput = document.getElementById('items');
  const totalInput = document.getElementById('total');

  if (itemsInput) itemsInput.value = itemParam;
  if (totalInput) totalInput.value = priceParam;

  const orderForm = document.getElementById('orderForm');
  orderForm.addEventListener('submit', function (e) {
    e.preventDefault();

    const submitBtn = orderForm.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'กำลังส่งคำสั่งซื้อ...';
    }

    const payload = {
      customerName: document.getElementById('customerName').value.trim(),
      contact: document.getElementById('contact').value.trim(),
      items: document.getElementById('items').value.trim(),
      total: document.getElementById('total').value.trim(),
      note: document.getElementById('note').value.trim()
    };

    // ส่งข้อมูลแบบ POST เป็น JSON string ธรรมดา ไม่ตั้ง headers เอง และไม่ใช้ no-cors (สไลด์ 28)
    fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
      .then(() => {
        window.location.href = 'thankyou.html';
      })
      .catch(error => {
        console.error(error);
        alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'ยืนยันสั่งซื้อ';
        }
      });
  });
}

// ============================================================================
// ส่วนที่ 3: หน้าแอดมิน (admin.html) - อ่านข้อมูลจาก Google Sheet CSV
// ============================================================================
async function initAdminPage() {
  const tbody = document.querySelector('#ordersTable tbody');
  tbody.innerHTML = '<tr><td colspan="6" class="empty-state">กำลังโหลดข้อมูลคำสั่งซื้อจาก Google Sheet...</td></tr>';

  try {
    const response = await fetch(CSV_URL);
    if (!response.ok) throw new Error('ไม่สามารถดึงข้อมูล CSV จาก Google Sheet ได้');
    const csvText = await response.text();
    const rows = parseCSV(csvText);

    // แถวแรก (index 0) คือหัวคอลัมน์ ข้อมูลจริงเริ่มที่ index 1
    const dataRows = rows.slice(1).filter(row => row.some(cell => cell.trim() !== ''));

    if (dataRows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">ยังไม่มีคำสั่งซื้อ</td></tr>';
      return;
    }

    // เรียงจากรายการล่าสุดขึ้นก่อน (reverse)
    const latestFirst = dataRows.reverse();

    tbody.innerHTML = latestFirst.map(cols => {
      const timestamp = escapeHtml(cols[0] || '-');
      const customerName = escapeHtml(cols[1] || '-');
      const contact = escapeHtml(cols[2] || '-');
      const items = escapeHtml(cols[3] || '-');
      const total = escapeHtml(cols[4] || '-');
      const note = escapeHtml(cols[5] || '-');

      return `
        <tr>
          <td>${timestamp}</td>
          <td>${customerName}</td>
          <td>${contact}</td>
          <td>${items}</td>
          <td>${total}</td>
          <td>${note}</td>
        </tr>
      `;
    }).join('');
  } catch (error) {
    console.error(error);
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">ยังไม่มีคำสั่งซื้อ หรือยังไม่ได้ตั้งค่า CSV_URL ในไฟล์ script.js</td></tr>';
  }
}

// ฟังก์ชัน Parse CSV เองโดยไม่ใช้ library ภายนอก (รองรับเครื่องหมายคำพูดและลูกน้ำในช่องข้อมูล)
function parseCSV(text) {
  const rows = [];
  let currentRow = [];
  let currentCell = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentCell += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentCell.trim());
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    rows.push(currentRow);
  }

  return rows;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
