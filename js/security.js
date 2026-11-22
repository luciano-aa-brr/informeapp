// Módulo de ciberseguridad en cliente: Prevención de XSS, sanitización y validación estricta
export const ModuloSeguridad = Object.freeze({
    CLAVE_STORAGE: 'perfilPublicadorV3',

    // Valida formato del token firmado (timestamp.hmac_sha256)
    esTokenValido(token) {
        return typeof token === 'string' && /^\d+\.[a-f0-9]{64}$/.test(token);
    },

    // Valida cadenas de texto no vacías y de largo acotado
    esTextoSeguro(valor, maxLen = 80) {
        return typeof valor === 'string' && valor.trim().length > 0 && valor.trim().length <= maxLen;
    },

    // Sanitiza enteros dentro de un rango seguro (ej. cursos 0-99, horas 0-744)
    sanitizarEntero(valor, min = 0, max = 744) {
        const numero = Number.parseInt(valor, 10);
        if (!Number.isFinite(numero) || numero < min) return min;
        if (numero > max) return max;
        return numero;
    },

    // Valida formato YYYY-MM para el selector de mes
    esMesValido(valorMes) {
        return typeof valorMes === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(valorMes);
    },

    // Valida la selección actual contra los grupos recibidos (sin teléfonos)
    validarSeleccionContraServidor(gruposServidor, grupoId, nombre, token, consentimientoAceptado) {
        if (consentimientoAceptado !== true) return null;
        if (!Array.isArray(gruposServidor)) return null;
        if (!this.esTextoSeguro(grupoId) || !this.esTextoSeguro(nombre)) return null;
        if (!this.esTokenValido(token)) return null;

        const grupo = gruposServidor.find(g => g.id === grupoId);
        if (!grupo || !Array.isArray(grupo.hermanos)) return null;
        if (!grupo.hermanos.includes(nombre)) return null;

        return {
            grupoId: grupo.id,
            nombre: nombre.trim(),
            nombreGrupo: String(grupo.nombreGrupo).trim(),
            encargado: String(grupo.encargado).trim(),
            token,
            consentimientoAceptado: true
        };
    },

    // Valida un perfil guardado en localStorage (sin almacenar teléfonos)
    validarPerfilGuardado(perfil) {
        if (!perfil || typeof perfil !== 'object') return null;
        if (perfil.consentimientoAceptado !== true) return null;
        if (!this.esTextoSeguro(perfil.grupoId)) return null;
        if (!this.esTextoSeguro(perfil.nombre)) return null;
        if (!this.esTextoSeguro(perfil.nombreGrupo)) return null;
        if (!this.esTextoSeguro(perfil.encargado)) return null;
        if (!this.esTokenValido(perfil.token)) return null;

        return {
            grupoId: perfil.grupoId.trim(),
            nombre: perfil.nombre.trim(),
            nombreGrupo: perfil.nombreGrupo.trim(),
            encargado: perfil.encargado.trim(),
            token: perfil.token,
            consentimientoAceptado: true
        };
    },

    // Construcción segura de <select> sin usar innerHTML (Prevención estricta de XSS)
    poblarSelectSeguro(selectElemento, textoPlaceholder, opciones) {
        const fragmento = document.createDocumentFragment();
        const opcionDefault = document.createElement('option');
        opcionDefault.value = '';
        opcionDefault.disabled = true;
        opcionDefault.selected = true;
        opcionDefault.textContent = textoPlaceholder;
        fragmento.appendChild(opcionDefault);

        opciones.forEach(({ valor, etiqueta }) => {
            const opt = document.createElement('option');
            opt.value = valor;
            opt.textContent = etiqueta;
            fragmento.appendChild(opt);
        });

        selectElemento.replaceChildren(fragmento);
    }
});
