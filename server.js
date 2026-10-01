const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const PORT = Number(process.env.PORT) || 3000;
const DEFAULT_USER_ID = 'mocab';

fs.mkdirSync(DATA_DIR, { recursive: true });
const database = new DatabaseSync(path.join(DATA_DIR, 'buenplan.db'));
database.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'Personal',
    priority TEXT NOT NULL DEFAULT 'media' CHECK (priority IN ('baja', 'media', 'alta')),
    due_date TEXT,
    completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS offers (
    id TEXT PRIMARY KEY,
    brand TEXT NOT NULL,
    brand_initials TEXT NOT NULL,
    brand_color TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    discount_label TEXT NOT NULL,
    description TEXT NOT NULL,
    terms TEXT NOT NULL,
    image_url TEXT NOT NULL,
    location TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    featured INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS redemptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    offer_id TEXT NOT NULL REFERENCES offers(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    code TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

database.prepare('INSERT OR IGNORE INTO users (id, username, display_name) VALUES (?, ?, ?)').run(DEFAULT_USER_ID, DEFAULT_USER_ID, 'Mocab');
const redemptionColumns = database.prepare('PRAGMA table_info(redemptions)').all();
if (!redemptionColumns.some((column) => column.name === 'user_id')) {
  database.exec(`ALTER TABLE redemptions ADD COLUMN user_id TEXT NOT NULL DEFAULT '${DEFAULT_USER_ID}'`);
}

const defaultOffers = [
  ['laurel-cafe', 'Café Laurel', 'CL', '#e9d7b4', 'Un café, el otro va por cuenta nuestra', 'Gastronomía', '2 x 1', 'Tu pausa favorita viene con compañía: pide dos bebidas y paga solo una.', 'Válido de lunes a viernes hasta las 12:00. Aplica a bebidas calientes tamaño mediano. No acumulable con otras promociones.', 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=85', 'En locales participantes', '2026-12-31', 1],
  ['casa-nori', 'Casa Nori', 'CN', '#e8b5a5', 'Una mesa para descubrir Japón', 'Gastronomía', '25% OFF', 'Un menú de temporada para compartir, con ingredientes frescos y mucho sabor.', '25% de descuento en menú de almuerzo de lunes a jueves. No incluye bebidas ni días festivos.', 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=900&q=85', 'Centro · 3 sucursales', '2026-11-30', 1],
  ['nube-estudio', 'Nube Estudio', 'NE', '#cbd9cf', 'Tu primera clase de movimiento', 'Bienestar', 'GRATIS', 'Prueba una clase de yoga o pilates y encuentra ese espacio que te hace bien.', 'Una clase de bienvenida por persona. Reserva previa requerida. Sujeto a disponibilidad.', 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=900&q=85', 'Roma Norte · CDMX', '2026-12-15', 1],
  ['marea-objetos', 'Marea Objetos', 'MO', '#d9c8b4', 'Piezas hechas para durar', 'Compras', '30% OFF', 'Diseño local, materiales honestos y objetos que hacen hogar.', '30% en artículos seleccionados de la colección Casa. No acumulable. Compra en línea y en tienda.', 'https://images.unsplash.com/photo-1490312278390-ab64016e0aa9?auto=format&fit=crop&w=900&q=85', 'En línea y tienda', '2026-11-15', 1],
  ['cine-alameda', 'Cine Alameda', 'CA', '#e8c978', 'Una historia más, por la mitad', 'Experiencias', '2 x 1', 'Invita a quien quieras: dos entradas para esa película que llevan semanas esperando.', 'Válido los martes en funciones antes de las 18:00. No incluye salas premium ni estrenos.', 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=85', 'Todas las salas', '2026-12-20', 1],
  ['verde-vivo', 'Verde Vivo', 'VV', '#bcd2b3', 'Comer rico también puede sentirse bien', 'Gastronomía', '20% OFF', 'Un menú vegetal de temporada para probar algo nuevo y salir con energía.', '20% de descuento en platillos principales. Consumo en sucursal. No incluye bebidas.', 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=85', 'Juárez · Condesa', '2026-11-30', 0],
  ['escape-lento', 'Escápate Lento', 'EL', '#bed0d4', 'Un fin de semana para bajar el ritmo', 'Viajes', '20% OFF', 'Dos noches entre naturaleza y silencio. El resto lo decides tú.', 'Reserva con 7 días de anticipación. Válido para estancias de domingo a jueves. Fechas sujetas a disponibilidad.', 'https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?auto=format&fit=crop&w=900&q=85', 'Valle de Bravo', '2026-12-31', 0],
  ['libros-lumbre', 'Lumbre Libros', 'LL', '#ddc8d8', 'Una lectura nueva, una para regalar', 'Compras', '2 x 1', 'Llévate esa novela pendiente y comparte otra historia con alguien.', 'Aplica en libros de editoriales independientes seleccionados. El de menor precio es gratis.', 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=900&q=85', 'En línea y tienda', '2026-12-01', 0],
  ['bici-urbana', 'Bici Urbana', 'BU', '#c5d5cb', 'Muévete ligero por la ciudad', 'Bienestar', '15% OFF', 'Explora la ciudad a tu manera con una bicicleta por todo el día.', 'Válido en renta de bicicleta urbana por día completo. Identificación oficial requerida.', 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=900&q=85', 'Polanco · Condesa', '2026-12-31', 0],
  ['taller-barro', 'Taller Barro', 'TB', '#dfc6ac', 'Haz algo con tus propias manos', 'Experiencias', '2 x 1', 'Una tarde de cerámica para aprender, crear y llevarte algo hecho por ti.', 'Reserva para dos personas. Incluye materiales y horneado de una pieza por persona.', 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=900&q=85', 'San Miguel Chapultepec', '2026-11-30', 0],
];

const insertOffer = database.prepare(`
  INSERT OR IGNORE INTO offers (id, brand, brand_initials, brand_color, title, category, discount_label, description, terms, image_url, location, expires_at, featured)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET image_url = excluded.image_url
`);
for (const offer of defaultOffers) insertOffer.run(...offer);

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_000_000) {
      throw Object.assign(new Error('El cuerpo de la solicitud es demasiado grande.'), { status: 413 });
    }
  }
  try {
    return body ? JSON.parse(body) : {};
  } catch {
    throw Object.assign(new Error('El JSON enviado no es válido.'), { status: 400 });
  }
}

function taskFromRow(row) {
  return { ...row, completed: Boolean(row.completed) };
}

function isValidDate(value) {
  return value === null || value === '' || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00`)));
}

async function handleApi(request, response, url) {
  const pathname = url.pathname;

  if (pathname === '/api/offers/categories' && request.method === 'GET') {
    const categories = database.prepare('SELECT category, COUNT(*) AS count FROM offers WHERE active = 1 GROUP BY category ORDER BY category').all();
    return sendJson(response, 200, categories);
  }

  if (pathname === '/api/offers' && request.method === 'GET') {
    const conditions = ['active = 1'];
    const parameters = {};
    const category = url.searchParams.get('category');
    const search = url.searchParams.get('search')?.trim();
    if (category) {
      conditions.push('category = @category');
      parameters.category = category;
    }
    if (search) {
      conditions.push('(brand LIKE @search OR title LIKE @search OR description LIKE @search OR category LIKE @search)');
      parameters.search = `%${search}%`;
    }
    const offers = database.prepare(`
      SELECT * FROM offers WHERE ${conditions.join(' AND ')}
      ORDER BY featured DESC, category ASC, brand ASC
    `).all(parameters);
    return sendJson(response, 200, offers.map((offer) => ({ ...offer, featured: Boolean(offer.featured) })));
  }

  if (pathname === '/api/redemptions' && request.method === 'POST') {
    const body = await readJson(request);
    const offerId = typeof body.offerId === 'string' ? body.offerId : '';
    const offer = database.prepare('SELECT id FROM offers WHERE id = ? AND active = 1').get(offerId);
    if (!offer) return sendJson(response, 404, { error: 'Este beneficio ya no está disponible.' });
    const code = `BP-${randomBytes(3).toString('hex').toUpperCase()}`;
    const result = database.prepare('INSERT INTO redemptions (offer_id, user_id, code) VALUES (?, ?, ?)').run(offerId, DEFAULT_USER_ID, code);
    return sendJson(response, 201, { id: Number(result.lastInsertRowid), offerId, userId: DEFAULT_USER_ID, code, createdAt: new Date().toISOString() });
  }

  if (pathname === '/api/users/current' && request.method === 'GET') {
    const user = database.prepare('SELECT id, username, display_name, created_at FROM users WHERE id = ?').get(DEFAULT_USER_ID);
    return sendJson(response, 200, user);
  }

  if (pathname === '/api/redemptions' && request.method === 'GET') {
    const redemptions = database.prepare(`
      SELECT r.id, r.offer_id AS offerId, r.user_id AS userId, r.code, r.created_at AS createdAt,
             o.brand, o.brand_initials AS brandInitials, o.brand_color AS brandColor, o.title
      FROM redemptions r
      JOIN offers o ON o.id = r.offer_id
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC
    `).all(DEFAULT_USER_ID).map((redemption) => ({
      id: redemption.id,
      offerId: redemption.offerId,
      userId: redemption.userId,
      code: redemption.code,
      createdAt: redemption.createdAt,
      offer: {
        brand: redemption.brand,
        brand_initials: redemption.brandInitials,
        brand_color: redemption.brandColor,
        title: redemption.title,
      },
    }));
    return sendJson(response, 200, redemptions);
  }

  if (pathname === '/api/stats' && request.method === 'GET') {
    const offers = database.prepare('SELECT COUNT(*) AS count FROM offers WHERE active = 1').get().count;
    const redemptions = database.prepare('SELECT COUNT(*) AS count FROM redemptions').get().count;
    return sendJson(response, 200, { offers, redemptions });
  }

  if (pathname === '/api/health' && request.method === 'GET') {
    return sendJson(response, 200, { status: 'ok', database: 'sqlite' });
  }

  if (pathname === '/api/stats' && request.method === 'GET') {
    const stats = database.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN completed = 0 AND due_date < date('now', 'localtime') THEN 1 ELSE 0 END) AS overdue
      FROM tasks
    `).get();
    return sendJson(response, 200, Object.fromEntries(Object.entries(stats).map(([key, value]) => [key, value ?? 0])));
  }

  if (pathname === '/api/tasks' && request.method === 'GET') {
    const conditions = [];
    const parameters = {};
    const status = url.searchParams.get('status');
    const category = url.searchParams.get('category');
    const search = url.searchParams.get('search')?.trim();

    if (status === 'pending') conditions.push('completed = 0');
    if (status === 'completed') conditions.push('completed = 1');
    if (category) {
      conditions.push('category = @category');
      parameters.category = category;
    }
    if (search) {
      conditions.push('(title LIKE @search OR description LIKE @search)');
      parameters.search = `%${search}%`;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const tasks = database.prepare(`
      SELECT * FROM tasks ${where}
      ORDER BY completed ASC, CASE priority WHEN 'alta' THEN 0 WHEN 'media' THEN 1 ELSE 2 END, due_date IS NULL, due_date ASC, created_at DESC
    `).all(parameters).map(taskFromRow);
    return sendJson(response, 200, tasks);
  }

  if (pathname === '/api/tasks' && request.method === 'POST') {
    const body = await readJson(request);
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const category = typeof body.category === 'string' && body.category.trim() ? body.category.trim() : 'Personal';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const priority = body.priority ?? 'media';
    const dueDate = body.dueDate || null;

    if (!title || title.length > 160) return sendJson(response, 400, { error: 'El título es obligatorio y debe tener 160 caracteres o menos.' });
    if (category.length > 40) return sendJson(response, 400, { error: 'La categoría debe tener 40 caracteres o menos.' });
    if (description.length > 1000) return sendJson(response, 400, { error: 'La descripción debe tener 1000 caracteres o menos.' });
    if (!['baja', 'media', 'alta'].includes(priority)) return sendJson(response, 400, { error: 'La prioridad no es válida.' });
    if (!isValidDate(dueDate)) return sendJson(response, 400, { error: 'La fecha límite no es válida.' });

    const result = database.prepare(`
      INSERT INTO tasks (title, description, category, priority, due_date)
      VALUES (@title, @description, @category, @priority, @dueDate)
    `).run({ title, description, category, priority, dueDate: dueDate || null });
    const task = database.prepare('SELECT * FROM tasks WHERE id = ?').get(Number(result.lastInsertRowid));
    return sendJson(response, 201, taskFromRow(task));
  }

  const taskMatch = pathname.match(/^\/api\/tasks\/(\d+)$/);
  if (taskMatch) {
    const id = Number(taskMatch[1]);
    const existing = database.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!existing) return sendJson(response, 404, { error: 'No se encontró esa tarea.' });

    if (request.method === 'PATCH') {
      const body = await readJson(request);
      const values = {
        title: existing.title,
        description: existing.description,
        category: existing.category,
        priority: existing.priority,
        dueDate: existing.due_date,
        completed: existing.completed,
      };

      if (Object.hasOwn(body, 'title')) values.title = typeof body.title === 'string' ? body.title.trim() : '';
      if (Object.hasOwn(body, 'description')) values.description = typeof body.description === 'string' ? body.description.trim() : '';
      if (Object.hasOwn(body, 'category')) values.category = typeof body.category === 'string' ? body.category.trim() : '';
      if (Object.hasOwn(body, 'priority')) values.priority = body.priority;
      if (Object.hasOwn(body, 'dueDate')) values.dueDate = body.dueDate || null;
      if (Object.hasOwn(body, 'completed')) values.completed = body.completed ? 1 : 0;

      if (!values.title || values.title.length > 160) return sendJson(response, 400, { error: 'El título es obligatorio y debe tener 160 caracteres o menos.' });
      if (!values.category || values.category.length > 40) return sendJson(response, 400, { error: 'La categoría es obligatoria y debe tener 40 caracteres o menos.' });
      if (values.description.length > 1000) return sendJson(response, 400, { error: 'La descripción debe tener 1000 caracteres o menos.' });
      if (!['baja', 'media', 'alta'].includes(values.priority)) return sendJson(response, 400, { error: 'La prioridad no es válida.' });
      if (!isValidDate(values.dueDate)) return sendJson(response, 400, { error: 'La fecha límite no es válida.' });

      database.prepare(`
        UPDATE tasks
        SET title = @title, description = @description, category = @category,
            priority = @priority, due_date = @dueDate, completed = @completed,
            updated_at = datetime('now')
        WHERE id = @id
      `).run({ ...values, id });
      const updated = database.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
      return sendJson(response, 200, taskFromRow(updated));
    }

    if (request.method === 'DELETE') {
      database.prepare('DELETE FROM tasks WHERE id = ?').run(id);
      response.writeHead(204);
      return response.end();
    }
  }

  return sendJson(response, 404, { error: 'Ruta de API no encontrada.' });
}

function serveStatic(response, pathname) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    response.writeHead(400);
    return response.end('Solicitud inválida');
  }

  const relativePath = decodedPath === '/' ? 'buenplan.html' : decodedPath.replace(/^\/+/, '');
  const filePath = path.resolve(PUBLIC_DIR, relativePath);
  if (!filePath.startsWith(`${PUBLIC_DIR}${path.sep}`)) {
    response.writeHead(403);
    return response.end('Prohibido');
  }

  fs.readFile(filePath, (error, contents) => {
    if (error) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return response.end('No encontrado');
    }
    response.writeHead(200, {
      'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    response.end(contents);
  });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/api/')) {
    try {
      await handleApi(request, response, url);
    } catch (error) {
      sendJson(response, error.status || 500, { error: error.status ? error.message : 'Ocurrió un error interno.' });
      if (!error.status) console.error(error);
    }
    return;
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    return response.end();
  }
  serveStatic(response, url.pathname);
});

server.listen(PORT, () => {
  console.log(`BuenPlan está listo en http://localhost:${PORT}`);
});

function closeServer() {
  server.close(() => {
    database.close();
    process.exit(0);
  });
}
process.on('SIGINT', closeServer);
process.on('SIGTERM', closeServer);