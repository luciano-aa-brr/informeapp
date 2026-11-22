const crypto = require('crypto');

// Comparación segura contra ataques de tiempo (timing attacks)
function compararPinSeguro(pinIngresado, pinReal) {
    const bufA = Buffer.from(String(pinIngresado));
    const bufB = Buffer.from(String(pinReal));
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = async function handler(req, res) {
    // Cabeceras estrictas: nunca guardar esta respuesta en caché
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

    if (!pinIngresado || !compararPinSeguro(pinIngresado, pinReal.trim())) {
        // Pequeña pausa de 500ms para frenar intentos automáticos de fuerza bruta
        await new Promise(resolve => setTimeout(resolve, 500));
        return res.status(401).json({ error: 'Clave incorrecta.' });
    }

    try {
        const grupos = JSON.parse(gruposRaw);
        if (!Array.isArray(grupos)) {
            throw new Error('Formato inválido');
        }
        return res.status(200).json({ grupos });
    } catch {
        return res.status(500).json({ error: 'Error al leer la lista de grupos en el servidor.' });
    }
};
