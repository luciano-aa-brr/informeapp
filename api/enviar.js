const crypto = require('crypto');

const MESES_ES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function compararSeguro(valorA, valorB) {
    const bufA = Buffer.from(String(valorA));
    const bufB = Buffer.from(String(valorB));
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

function verificarTokenSesion(token, pinReal) {
    if (typeof token !== 'string') return false;
    const partes = token.split('.');
    if (partes.length !== 2) return false;

    const [emitido, firmaRecibida] = partes;
    if (!/^\d+$/.test(emitido) || !/^[a-f0-9]{64}$/.test(firmaRecibida)) return false;

    const firmaEsperada = crypto
        .createHmac('sha256', pinReal)
        .update(`informeApp:v1:${emitido}`)
        .digest('hex');

    return compararSeguro(firmaRecibida, firmaEsperada);
}

function sanitizarEntero(valor, min, max) {
    const num = Number.parseInt(valor, 10);
    if (!Number.isFinite(num) || num < min) return min;
    if (num > max) return max;
    return num;
}

function formatearMesSeguro(valorMes) {
    if (typeof valorMes !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(valorMes)) {
        return '-';
    }
    const [anio, mes] = valorMes.split('-');
    const indice = Number.parseInt(mes, 10) - 1;
    return `${MESES_ES[indice]} de ${anio}`;
}

function responderErrorHtml(res, status, titulo, mensaje) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(status).send(`<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex, nofollow">
    <title>${titulo}</title>
    <style>
        body { font-family: system-ui, sans-serif; background: #f0f4f8; color: #1a202c; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
        .card { background: #fff; padding: 2rem; border-radius: 1.5rem; max-width: 400px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.08); }
        h1 { color: #1a365d; font-size: 1.5rem; margin-top: 0; }
        p { color: #4a5568; line-height: 1.5; }
        button { margin-top: 1rem; padding: 0.9rem 1.5rem; border: none; border-radius: 1rem; background: #2b6cb0; color: #fff; font-weight: bold; font-size: 1rem; cursor: pointer; }
    </style>
</head>
<body>
    <div class="card">
        <h1>${titulo}</h1>
        <p>${mensaje}</p>
        <button onclick="window.close()">Cerrar esta ventana</button>
    </div>
</body>
</html>`);
}

module.exports = async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Referrer-Policy', 'no-referrer');

    if (req.method !== 'POST') {
        return responderErrorHtml(res, 405, 'Acceso no permitido', 'Utiliza el botón de envío dentro de la aplicación.');
    }

    const pinReal = process.env.CONGREGACION_PIN;
    const gruposRaw = process.env.GRUPOS_JSON;

    if (!pinReal || !gruposRaw) {
        return responderErrorHtml(res, 500, 'Error de servidor', 'La configuración del servidor está incompleta.');
    }

    const body = req.body || {};
    const token = typeof body.token === 'string' ? body.token.trim() : '';

    if (!verificarTokenSesion(token, pinReal.trim())) {
        return responderErrorHtml(
            res,
            401,
            'Sesión vencida o clave actualizada',
            'La clave de acceso de la congregación cambió. Vuelve a la app, toca "Cambiar usuario" e ingresa la clave nueva.'
        );
    }

    let grupos;
    try {
        grupos = JSON.parse(gruposRaw);
        if (!Array.isArray(grupos)) throw new Error('Formato inválido');
    } catch {
        return responderErrorHtml(res, 500, 'Error de servidor', 'No se pudo leer la lista de grupos.');
    }

    const grupoId = typeof body.grupoId === 'string' ? body.grupoId.trim() : '';
    const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';

    const grupo = grupos.find(g => g.id === grupoId);
    if (!grupo || !Array.isArray(grupo.hermanos) || !grupo.hermanos.includes(nombre)) {
        return responderErrorHtml(
            res,
            400,
            'Perfil no encontrado',
            'Tu grupo o nombre fue actualizado en la lista. Toca "Cambiar usuario" en la app y vuelve a seleccionarte.'
        );
    }

    const telefono = String(grupo.telefono || '').trim();
    if (!/^[1-9]\d{7,14}$/.test(telefono)) {
        return responderErrorHtml(res, 500, 'Número no válido', 'El teléfono del encargado no tiene un formato válido.');
    }

    const mesLegible = formatearMesSeguro(body.mes);
    const participo = body.participo === 'true' || body.participo === true;
    const cursos = sanitizarEntero(body.cursos, 0, 99);
    const precursor = body.precursor === 'true' || body.precursor === true;
    const horas = sanitizarEntero(body.horas, 0, 744);

    let mensaje = `*Informe de Predicación*\n`;
    mensaje += `------------------------\n`;
    mensaje += `*Publicador:* ${nombre}\n`;
    mensaje += `*Grupo:* ${grupo.nombreGrupo}\n`;
    mensaje += `*Mes:* ${mesLegible}\n`;
    mensaje += `*Participó en la predicación:* ${participo ? 'Sí' : 'No'}\n`;
    mensaje += `*Cursos bíblicos:* ${cursos}\n`;

    if (precursor) {
        mensaje += `*Precursor:* Sí\n`;
        mensaje += `*Horas:* ${horas}\n`;
    }

    const urlWhatsApp = `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`;

    // 303 See Other redirige el POST directamente a WhatsApp sin exponer el número en la app
    res.writeHead(303, { Location: urlWhatsApp });
    return res.end();
};
