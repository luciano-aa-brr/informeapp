const crypto = require('crypto');

function compararSeguro(valorA, valorB) {
    const bufA = Buffer.from(String(valorA));
    const bufB = Buffer.from(String(valorB));
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

function generarTokenGrupo(grupoId, pinGrupo) {
    const emitido = Date.now().toString();
    const firma = crypto
        .createHmac('sha256', pinGrupo)
        .update(`informeApp:v2:${grupoId}:${emitido}`)
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

    const gruposRaw = process.env.GRUPOS_JSON;
    if (!gruposRaw) {
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
    if (!pinIngresado) {
        await new Promise(resolve => setTimeout(resolve, 500));
        return res.status(401).json({ error: 'Clave incorrecta.' });
    }

    let grupos;
    try {
        grupos = JSON.parse(gruposRaw);
        if (!Array.isArray(grupos)) throw new Error('Formato inválido');
    } catch {
        return res.status(500).json({ error: 'Error al leer la lista de grupos en el servidor.' });
    }

    // Recorremos TODOS los grupos en tiempo constante (sin detener el ciclo antes)
    // para evitar filtrar información por tiempo de respuesta (timing attack)
    let grupoEncontrado = null;
    for (const g of grupos) {
        const pinGrupo = typeof g?.pin === 'string' ? g.pin.trim() : '';
        if (pinGrupo && compararSeguro(pinIngresado, pinGrupo)) {
            grupoEncontrado = g;
        }
    }

    if (!grupoEncontrado) {
        await new Promise(resolve => setTimeout(resolve, 500));
        return res.status(401).json({ error: 'Clave incorrecta.' });
    }

    // Lista blanca estricta: jamás devolvemos "telefono", "pin" ni otros grupos
    const grupoSeguro = {
        id: String(grupoEncontrado.id || '').trim(),
        nombreGrupo: String(grupoEncontrado.nombreGrupo || '').trim(),
        encargado: String(grupoEncontrado.encargado || '').trim(),
        hermanos: Array.isArray(grupoEncontrado.hermanos)
            ? grupoEncontrado.hermanos.map(h => String(h).trim())
            : []
    };

    const token = generarTokenGrupo(grupoSeguro.id, String(grupoEncontrado.pin).trim());
    return res.status(200).json({ grupo: grupoSeguro, token });
};
