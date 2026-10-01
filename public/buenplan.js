const offerGrid = document.querySelector('#offer-grid');
const offerDialog = document.querySelector('#offer-dialog');
const categoryFilters = document.querySelector('#category-filters');
const localCanjesKey = 'buenplan-canjes';

const state = {
  view: 'offers',
  category: '',
  search: '',
  offers: [],
  categories: [],
  user: null,
  selectedOffer: null,
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function getCanjes() {
  try {
    const saved = JSON.parse(localStorage.getItem(localCanjesKey) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveCanje(canje) {
  const canjes = getCanjes();
  localStorage.setItem(localCanjesKey, JSON.stringify([canje, ...canjes.filter((item) => item.id !== canje.id)]));
}

async function api(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'No se pudo completar la solicitud.');
  return payload;
}

async function loadOffers() {
  offerGrid.setAttribute('aria-busy', 'true');
  const parameters = new URLSearchParams();
  if (state.category) parameters.set('category', state.category);
  if (state.search) parameters.set('search', state.search);
  try {
    const [offers, categories] = await Promise.all([
      api(`/api/offers?${parameters}`),
      api('/api/offers/categories'),
    ]);
    state.offers = offers;
    state.categories = categories;
    renderCategories();
    renderOffers();
    document.querySelector('#fact-offers').textContent = categories.reduce((sum, item) => sum + item.count, 0);
    document.querySelector('#fact-categories').textContent = categories.length;
  } catch (error) {
    offerGrid.innerHTML = `<div class="empty-results"><strong>No pudimos cargar los beneficios</strong><span>${escapeHtml(error.message)}</span></div>`;
    document.querySelector('#result-line').textContent = 'Vuelve a intentarlo en un momento.';
  } finally {
    offerGrid.setAttribute('aria-busy', 'false');
  }
}

async function loadCurrentUser() {
  try {
    state.user = await api('/api/users/current');
    document.querySelector('#current-user-name').textContent = state.user.username;
  } catch {
    document.querySelector('#current-user-name').textContent = 'mocab';
  }
}

function renderCategories() {
  const total = state.categories.reduce((sum, item) => sum + item.count, 0);
  const filters = [{ category: '', count: total }, ...state.categories.map((item) => ({ category: item.category, count: item.count }))];
  categoryFilters.innerHTML = filters.map(({ category, count }) => `
    <button class="category-chip${state.category === category ? ' is-active' : ''}" data-category="${escapeHtml(category)}" type="button">
      ${category ? escapeHtml(category) : 'Todos'} <span>${count}</span>
    </button>`).join('');
}

function renderOffers() {
  document.querySelector('#hero').classList.toggle('view-hidden', state.view !== 'offers');
  document.querySelector('.quick-facts').classList.toggle('view-hidden', state.view !== 'offers');
  document.querySelector('#como-funciona').classList.toggle('view-hidden', state.view !== 'offers');
  document.querySelector('.closing-banner').classList.toggle('view-hidden', state.view !== 'offers');
  document.querySelector('.catalog-toolbar').classList.toggle('view-hidden', state.view !== 'offers');
  document.querySelector('#offers-title').innerHTML = state.view === 'offers' ? 'Buenos planes, <em>mejor precio.</em>' : 'Tus beneficios <em>guardados.</em>';
  document.querySelector('#offers-description').textContent = state.view === 'offers'
    ? 'Elige algo rico, algo nuevo o simplemente algo para ti.'
    : 'Aquí tienes los códigos que activaste desde este dispositivo.';

  const title = state.view === 'offers' ? 'Buenos planes, mejor precio.' : 'Tus canjes';
  document.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('is-active', button.dataset.view === state.view));

  if (state.view === 'redemptions') {
    const canjes = getCanjes();
    document.querySelector('#result-line').textContent = `${canjes.length} ${canjes.length === 1 ? 'beneficio activado' : 'beneficios activados'}`;
    document.querySelector('#offers-title').setAttribute('aria-label', title);
    offerGrid.innerHTML = canjes.length
      ? `<div class="redemptions-view">${canjes.map(redemptionMarkup).join('')}</div>`
      : '<div class="empty-results"><strong>Aún no has activado ningún beneficio</strong><span>Cuando encuentres un buen plan, guarda aquí su código.</span></div>';
  } else {
    const resultCount = state.offers.length;
    document.querySelector('#result-line').textContent = `${resultCount} ${resultCount === 1 ? 'beneficio disponible' : 'beneficios disponibles'}`;
    offerGrid.innerHTML = resultCount
      ? state.offers.map(offerMarkup).join('')
      : '<div class="empty-results"><strong>No encontramos ese plan</strong><span>Prueba otra categoría o una búsqueda distinta.</span></div>';
  }
  document.querySelector('#redemption-count').textContent = getCanjes().length;
}

function offerMarkup(offer, index) {
  return `<article class="offer-card" style="animation-delay:${Math.min(index * 35, 210)}ms">
    <div class="offer-photo">
      <img src="${escapeHtml(offer.image_url)}" alt="${escapeHtml(offer.brand)}" loading="lazy">
      ${offer.featured ? '<span class="featured-label"><span aria-hidden="true">✳</span> FAVORITO</span>' : ''}
      <span class="offer-badge">${escapeHtml(offer.discount_label)}</span>
    </div>
    <div class="offer-copy">
      <div class="offer-brand-row"><span class="brand-avatar" style="background:${escapeHtml(offer.brand_color)}">${escapeHtml(offer.brand_initials)}</span><span class="offer-brand">${escapeHtml(offer.brand)}</span><span class="offer-category">${escapeHtml(offer.category)}</span></div>
      <h3>${escapeHtml(offer.title)}</h3>
      <p>${escapeHtml(offer.description)}</p>
      <div class="offer-card-bottom"><span class="offer-location">⌖ &nbsp;${escapeHtml(offer.location)}</span><button class="offer-open" data-offer-id="${escapeHtml(offer.id)}" type="button">Ver beneficio <span aria-hidden="true">→</span></button></div>
    </div>
  </article>`;
}

function redemptionMarkup(canje) {
  const offer = canje.offer || {};
  return `<article class="redemption-card">
    <span class="brand-avatar" style="background:${escapeHtml(offer.brand_color || '#eaf0e8')}">${escapeHtml(offer.brand_initials || 'BP')}</span>
    <div class="redemption-copy"><strong>${escapeHtml(offer.brand || 'BuenPlan')}</strong><span>${escapeHtml(offer.title || 'Beneficio guardado')}</span></div>
    <span class="redemption-code">${escapeHtml(canje.code)}</span>
  </article>`;
}

function showCanjeResult(canje) {
  document.querySelector('#redeem-code').textContent = canje.code;
  document.querySelector('#redeem-result').hidden = false;
  const button = document.querySelector('#redeem-button');
  button.disabled = true;
  button.innerHTML = 'Beneficio activado <span aria-hidden="true">✓</span>';
}

function openOffer(offer) {
  state.selectedOffer = offer;
  document.querySelector('#dialog-image').src = offer.image_url;
  document.querySelector('#dialog-image').alt = offer.brand;
  document.querySelector('#dialog-discount').textContent = offer.discount_label;
  document.querySelector('#dialog-avatar').textContent = offer.brand_initials;
  document.querySelector('#dialog-avatar').style.background = offer.brand_color;
  document.querySelector('#dialog-brand').textContent = offer.brand;
  document.querySelector('#dialog-location').textContent = offer.location;
  document.querySelector('#dialog-category').textContent = offer.category;
  document.querySelector('#dialog-title').textContent = offer.title;
  document.querySelector('#dialog-description').textContent = offer.description;
  document.querySelector('#dialog-terms').textContent = offer.terms;
  document.querySelector('#dialog-expiry').textContent = `Vigente hasta el ${new Intl.DateTimeFormat('es', { dateStyle: 'long' }).format(new Date(`${offer.expires_at}T12:00:00`))}.`;
  document.querySelector('#dialog-error').textContent = '';
  document.querySelector('#redeem-result').hidden = true;
  const button = document.querySelector('#redeem-button');
  button.disabled = false;
  button.innerHTML = 'Obtener mi beneficio <span aria-hidden="true">→</span>';
  const previous = getCanjes().find((item) => item.offerId === offer.id);
  if (previous) showCanjeResult(previous);
  offerDialog.showModal();
}

function setView(view) {
  state.view = view;
  renderOffers();
  if (view === 'offers') document.querySelector('#ofertas').scrollIntoView({ behavior: 'smooth', block: 'start' });
  else window.scrollTo({ top: 0, behavior: 'smooth' });
}

categoryFilters.addEventListener('click', (event) => {
  const button = event.target.closest('[data-category]');
  if (!button) return;
  state.category = button.dataset.category;
  state.view = 'offers';
  loadOffers();
});

document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
document.querySelector('a[href="#como-funciona"]').addEventListener('click', () => {
  if (state.view !== 'offers') setView('offers');
});

let searchTimer;
document.querySelector('#offer-search').addEventListener('input', (event) => {
  window.clearTimeout(searchTimer);
  state.search = event.target.value.trim();
  state.view = 'offers';
  searchTimer = window.setTimeout(loadOffers, 180);
});

offerGrid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-offer-id]');
  if (!button) return;
  const offer = state.offers.find((item) => item.id === button.dataset.offerId);
  if (offer) openOffer(offer);
});

document.querySelector('#dialog-close').addEventListener('click', () => offerDialog.close());
offerDialog.addEventListener('click', (event) => { if (event.target === offerDialog) offerDialog.close(); });

document.querySelector('#redeem-button').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  if (!state.selectedOffer) return;
  button.disabled = true;
  document.querySelector('#dialog-error').textContent = '';
  try {
    const redemption = await api('/api/redemptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offerId: state.selectedOffer.id }),
    });
    const savedCanje = { ...redemption, offer: state.selectedOffer };
    saveCanje(savedCanje);
    showCanjeResult(savedCanje);
    document.querySelector('#redemption-count').textContent = getCanjes().length;
    showToast('Listo. Guarda tu código para usar el beneficio.');
  } catch (error) {
    document.querySelector('#dialog-error').textContent = error.message;
    button.disabled = false;
  }
});

document.querySelector('#copy-code').addEventListener('click', async () => {
  const code = document.querySelector('#redeem-code').textContent;
  try {
    await navigator.clipboard.writeText(code);
    showToast('Código copiado.');
  } catch {
    showToast(`Tu código es ${code}`);
  }
});

let toastTimer;
function showToast(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2800);
}

const mobileMenuButton = document.querySelector('#mobile-menu-button');
mobileMenuButton.addEventListener('click', () => {
  const nav = document.querySelector('.main-nav');
  const isOpen = nav.classList.toggle('is-open');
  mobileMenuButton.setAttribute('aria-expanded', String(isOpen));
});
document.querySelectorAll('.main-nav a, .main-nav button').forEach((item) => item.addEventListener('click', () => {
  document.querySelector('.main-nav').classList.remove('is-open');
  mobileMenuButton.setAttribute('aria-expanded', 'false');
}));

document.addEventListener('keydown', (event) => {
  if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) && !offerDialog.open) {
    event.preventDefault();
    document.querySelector('#offer-search').focus();
  }
});

document.querySelector('#redemption-count').textContent = getCanjes().length;
loadCurrentUser();
loadOffers();