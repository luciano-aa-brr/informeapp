const crypto = require('crypto');

function compararSeguro(valorA, valorB) {
    const bufA = Buffer.from(String(valorA));
    const bufB = Buffer.from(String(valorB));
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

function generarTokenSesion(pinReal) {
    const emitido = Date.now().toString();
    const firma = crypto
        .createHmac('sha256', pinReal)
        .update(`informeApp:v1:${emitido}`)
        .digest('hex');
    return `${emitido}.${firma}`;
}

module.exports = async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    const pinReal = process.env.CONGREGACION_PIN;
    const gruposRaw = process.env.GRUPOS_JSON;

    if (!pinReal || !gruposRaw) {
        return res.status(500).json({ error: 'Configuración del servidor incompleta.' });
    }

    let body = req.body;
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body);
        } catch {
            return res.status(400).json({ error: 'Solicitud inválida.' });
        }
    }

    const pinIngresado = typeof body?.pin === 'string' ? body.pin.trim() : '';

    if (!pinIngresado || !compararSeguro(pinIngresado, pinReal.trim())) {
        await new Promise(resolve => setTimeout(resolve, 500));
        return res.status(401).json({ error: 'Clave incorrecta.' });
    }

    try {
        const grupos = JSON.parse(gruposRaw);
        if (!Array.isArray(grupos)) {
            throw new Error('Formato inválido');
        }

        // Lista blanca de campos: JAMÁS incluimos "telefono" en la respuesta al navegador
        const gruposSinTelefonos = grupos.map(g => ({
            id: String(g.id || '').trim(),
            nombreGrupo: String(g.nombreGrupo || '').trim(),
            encargado: String(g.encargado || '').trim(),
            hermanos: Array.isArray(g.hermanos) ? g.hermanos.map(h => String(h).trim()) : []
        }));

        const token = generarTokenSesion(pinReal.trim());
        return res.status(200).json({ grupos: gruposSinTelefonos, token });
    } catch {
        return res.status(500).json({ error: 'Error al leer la lista de grupos en el servidor.' });
    }
};
