// Lab 4, Part A: front-end logic for the storefront-style Gateway UI.
// Talks only to ui-service's own REST endpoints (/api/products,
// /api/products/{id}, /api/orders) - never a backend gRPC service
// directly. No emojis anywhere; one consistent stroke-icon set is used
// throughout, including a small illustrative icon per product category.

// ---- Shared status icons ----
const icons = {
  loading: `<svg class="icon spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-9-9"/></svg>`,
  success: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  warning: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  offline: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.58 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>`,
};

// ---- Product-category icons (simple, non-emoji, flat stroke style) ----
const productIcons = {
  laptop: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="10" rx="1"></rect><path d="M2 18h20l-1.5 2.5a1 1 0 0 1-.86.5H4.36a1 1 0 0 1-.86-.5L2 18Z"></path></svg>`,
  keyboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"></rect><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M18 13h.01M9 13h6"></path></svg>`,
  mouse: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2" width="12" height="20" rx="6"></rect><line x1="12" y1="2" x2="12" y2="10"></line></svg>`,
  monitor: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>`,
  box: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="m21 8-9-5-9 5 9 5 9-5Z"></path><path d="M3 8v8l9 5 9-5V8"></path><path d="M12 13v8"></path></svg>`,
};

// Known catalogue IDs -> icon key. Falls back to a generic box icon for
// any product ID not listed here, so the grid never breaks if the
// catalogue changes.
const idToIconKey = { P001: "laptop", P002: "keyboard", P003: "mouse", P004: "monitor" };
const tileColors = ["tile-blue", "tile-teal", "tile-amber", "tile-violet"];

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text == null ? "" : String(text);
  return div.innerHTML;
}

// =======================================================================
// Section 1: Find a Product by ID (unchanged behaviour from before -
// needed so any ID, including ones that don't exist, can be tested)
// =======================================================================

const lookupForm = document.getElementById("lookup-form");
const productIdInput = document.getElementById("product-id");
const lookupResult = document.getElementById("lookup-result");
const lookupBtn = document.getElementById("lookup-btn");

lookupForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const id = productIdInput.value.trim();
  lookupBtn.disabled = true;
  lookupResult.className = "result state-loading";
  lookupResult.innerHTML = `${icons.loading} <span>Looking up "${escapeHtml(id) || "..."}"...</span>`;

  try {
    const res = await fetch(`/api/products/${encodeURIComponent(id)}`);
    const data = await res.json();

    if (data.found) {
      lookupResult.className = "result state-success";
      lookupResult.innerHTML = `
        ${icons.success}
        <div>
          <div class="product-name">${escapeHtml(data.name)}</div>
          <div class="product-meta">ID: ${escapeHtml(data.productId)} &nbsp;&middot;&nbsp; Nu. ${data.price.toFixed(2)}</div>
        </div>`;
    } else if (data.errorCode === "unavailable") {
      lookupResult.className = "result state-unavailable";
      lookupResult.innerHTML = `${icons.offline} <span>${escapeHtml(data.message)}</span>`;
    } else {
      lookupResult.className = "result state-warning";
      lookupResult.innerHTML = `${icons.warning} <span>${escapeHtml(data.message)}</span>`;
    }
  } catch (err) {
    lookupResult.className = "result state-unavailable";
    lookupResult.innerHTML = `${icons.offline} <span>Could not reach the Gateway. Is ui-service running?</span>`;
  } finally {
    lookupBtn.disabled = false;
  }
});

// =======================================================================
// Section 2: Shop - browsable product grid with inline ordering
// =======================================================================

const grid = document.getElementById("product-grid");
const customerIdInput = document.getElementById("customer-id");
const toastContainer = document.getElementById("toast-container");

function renderSkeletons(n) {
  return Array.from({ length: n })
    .map(
      () => `
      <div class="product-card skeleton">
        <div class="thumb"></div>
        <div class="card-body">
          <div class="line"></div>
          <div class="line short"></div>
        </div>
      </div>`
    )
    .join("");
}

function renderCard(product, index) {
  const iconKey = idToIconKey[product.productId] || "box";
  const tileClass = tileColors[index % tileColors.length];
  return `
    <div class="product-card" data-id="${escapeHtml(product.productId)}">
      <div class="thumb ${tileClass}">${productIcons[iconKey]}</div>
      <div class="card-body">
        <div class="p-name">${escapeHtml(product.name)}</div>
        <div class="p-price">Nu. ${product.price.toFixed(2)}</div>
        <div class="order-row">
          <input type="number" min="1" value="1" class="qty-input" aria-label="Quantity for ${escapeHtml(product.name)}" />
          <button type="button" class="place-order-btn">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path>
              <path d="M3 6h18"></path>
              <path d="M16 10a4 4 0 0 1-8 0"></path>
            </svg>
            <span>Place Order</span>
          </button>
        </div>
      </div>
    </div>`;
}

async function loadCatalog() {
  grid.innerHTML = renderSkeletons(4);

  try {
    const res = await fetch("/api/products");
    const data = await res.json();
    const products = data.products || [];

    if (products.length === 0) {
      grid.innerHTML = `<p class="empty-state">${icons.warning} No products could be loaded right now.</p>`;
      return;
    }

    grid.innerHTML = products.map(renderCard).join("");
    grid.querySelectorAll(".place-order-btn").forEach((btn) => btn.addEventListener("click", onPlaceOrderClick));
  } catch (err) {
    grid.innerHTML = `<p class="empty-state">${icons.offline} Could not reach the Gateway. Is ui-service running?</p>`;
  }
}

async function onPlaceOrderClick(event) {
  const btn = event.currentTarget;
  const card = btn.closest(".product-card");
  const productId = card.dataset.id;
  const quantity = parseInt(card.querySelector(".qty-input").value, 10) || 0;
  const customerId = customerIdInput.value.trim();

  if (!customerId) {
    showToast("warning", "Please enter your Customer ID at the top before placing an order.");
    customerIdInput.focus();
    return;
  }
  if (quantity <= 0) {
    showToast("warning", "Quantity must be at least 1.");
    return;
  }

  const originalHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `${icons.loading} <span>Placing...</span>`;

  try {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId, productId, quantity }),
    });
    const data = await res.json();

    if (data.success) {
      showToast("success", buildOrderSummaryHTML(data), true);
    } else if (data.errorCode === "unavailable") {
      showToast("unavailable", `${data.step ? `[${data.step}] ` : ""}${data.message}`);
    } else {
      showToast("warning", `${data.step ? `[${data.step}] ` : ""}${data.message}`);
    }
  } catch (err) {
    showToast("unavailable", "Could not reach the Gateway. Is ui-service running?");
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHTML;
  }
}

function buildOrderSummaryHTML(data) {
  const notifItems = (data.notifications || []).map((n) => `<li>${escapeHtml(n)}</li>`).join("");
  return `
    <div>
      <div class="order-summary-title">Order ${escapeHtml(data.orderId)} placed</div>
      <div class="order-detail">Customer: ${escapeHtml(data.customerName)}</div>
      <div class="order-detail">Product: ${escapeHtml(data.productName)} &middot; Nu. ${data.unitPrice.toFixed(2)} each</div>
      <div class="order-detail">Total charged: Nu. ${data.totalAmount.toFixed(2)} &middot; Payment ID: ${escapeHtml(data.paymentId)}</div>
      <div class="order-detail">Remaining stock: ${data.remainingStock}</div>
      ${notifItems ? `<ul class="notification-list">${notifItems}</ul>` : ""}
    </div>`;
}

// showToast renders a small, auto-dismissing panel in the bottom-right
// corner - success toasts stay a little longer since they hold more
// information (order summary + notifications).
function showToast(kind, htmlOrText, isHTML = false) {
  const toast = document.createElement("div");
  toast.className = `toast toast-${kind}`;
  const icon = kind === "success" ? icons.success : kind === "unavailable" ? icons.offline : icons.warning;
  toast.innerHTML = `${icon} ${isHTML ? htmlOrText : `<span>${escapeHtml(htmlOrText)}</span>`}`;
  toastContainer.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("show"));

  const lifetime = isHTML ? 9000 : 6000;
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 250);
  }, lifetime);
}

loadCatalog();
