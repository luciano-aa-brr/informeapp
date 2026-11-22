import { ModuloSeguridad } from './security.js';

// Registro del Service Worker para habilitar la instalación PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // Lista temporal en memoria RAM (solo existe mientras el usuario elige su perfil)
    let gruposEnMemoria = [];

    // Referencias DOM - Pantallas
    const pantallaConfig = document.getElementById('pantalla-configuracion');
    const pantallaPrincipal = document.getElementById('pantalla-principal');
    const contenedorBtnEnviar = document.getElementById('contenedor-btn-enviar');

    // Referencias DOM - Configuración (PIN + Selección)
    const subtituloConfig = document.getElementById('subtitulo-config');
    const bloquePin = document.getElementById('bloque-pin');
    const inputPin = document.getElementById('input-pin');
    const errorPin = document.getElementById('error-pin');
    const btnVerificarPin = document.getElementById('btn-verificar-pin');

    const bloqueSeleccionPerfil = document.getElementById('bloque-seleccion-perfil');
    const selectGrupo = document.getElementById('select-grupo');
    const selectNombre = document.getElementById('select-nombre');
    const checkConsentimiento = document.getElementById('check-consentimiento');
    const btnGuardarPerfil = document.getElementById('btn-guardar-perfil');
    const errorConfiguracion = document.getElementById('error-configuracion');

    // Referencias DOM - Principal
    const saludoNombre = document.getElementById('saludo-nombre');
    const saludoGrupo = document.getElementById('saludo-grupo');
    const btnCambiarUsuario = document.getElementById('btn-cambiar-usuario');
    const inputMes = document.getElementById('mes');

    const checkParticipo = document.getElementById('check-participo');

    const btnMenosCursos = document.getElementById('btn-menos-cursos');
    const btnMasCursos = document.getElementById('btn-mas-cursos');
    const displayCursos = document.getElementById('display-cursos');
    let cursosCount = 0;

    const checkPrecursor = document.getElementById('check-precursor');
    const seccionHoras = document.getElementById('seccion-horas');

    const btnMenosHoras = document.getElementById('btn-menos-horas');
    const btnMasHoras = document.getElementById('btn-mas-horas');
    const inputHoras = document.getElementById('input-horas');

    const btnRevisar = document.getElementById('btn-revisar');

    // Referencias DOM - Modales
    const modalConfirmacion = document.getElementById('modal-confirmacion');
    const btnCancelar = document.getElementById('btn-cancelar');
    const btnConfirmarEnviar = document.getElementById('btn-confirmar-enviar');

    const modalExito = document.getElementById('modal-exito');
    const linkWhatsappRespaldo = document.getElementById('link-whatsapp-respaldo');
    const btnCerrarExito = document.getElementById('btn-cerrar-exito');

    const modalCambioUsuario = document.getElementById('modal-cambio-usuario');
    const btnCancelarCambio = document.getElementById('btn-cancelar-cambio');
    const btnConfirmarCambio = document.getElementById('btn-confirmar-cambio');

    const modalInstalar = document.getElementById('modal-instalar');
    const btnAbrirInstalar = document.getElementById('btn-abrir-instalar');
    const btnCerrarInstalar = document.getElementById('btn-cerrar-instalar');

    // --- HELPER: LEER PERFIL GUARDADO ---
    const obtenerPerfilSeguro = () => {
        try {
            const raw = localStorage.getItem(ModuloSeguridad.CLAVE_STORAGE);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return ModuloSeguridad.validarPerfilGuardado(parsed);
        } catch {
            localStorage.removeItem(ModuloSeguridad.CLAVE_STORAGE);
            return null;
        }
    };

    // --- ESTADO INICIAL ---
    const cargarEstadoInicial = () => {
        const perfil = obtenerPerfilSeguro();
        if (perfil) {
            saludoNombre.textContent = `Hola, ${perfil.nombre}`;
            saludoGrupo.textContent = `${perfil.nombreGrupo} • ${perfil.encargado}`;
            pantallaConfig.classList.add('hidden');
            pantallaPrincipal.classList.remove('hidden');
            contenedorBtnEnviar.classList.remove('hidden');

            const hoy = new Date();
            inputMes.value = hoy.toISOString().slice(0, 7);
        } else {
            pantallaConfig.classList.remove('hidden');
            pantallaPrincipal.classList.add('hidden');
            contenedorBtnEnviar.classList.add('hidden');
        }
    };
    cargarEstadoInicial();

    // --- PASO A: VERIFICAR PIN EN EL SERVIDOR ---
    const verificarPinEnServidor = async () => {
        const pin = inputPin.value.trim();
        if (!pin) {
            errorPin.textContent = 'Por favor, escribe la clave de acceso.';
            errorPin.classList.remove('hidden');
            return;
        }

        errorPin.classList.add('hidden');
        btnVerificarPin.disabled = true;
        btnVerificarPin.textContent = 'Verificando...';

        try {
            const respuesta = await fetch('/api/grupos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin })
            });

            if (respuesta.status === 401) {
                errorPin.textContent = 'Clave incorrecta. Consulta con el encargado de tu grupo.';
                errorPin.classList.remove('hidden');
                inputPin.value = '';
                inputPin.focus();
                return;
            }

            if (!respuesta.ok) {
                throw new Error('Error del servidor');
            }

            const data = await respuesta.json();
            if (!Array.isArray(data?.grupos) || data.grupos.length === 0) {
                throw new Error('Lista vacía');
            }

            // Guardamos temporalmente en RAM para poblar las listas
            gruposEnMemoria = data.grupos;

            const opcionesGrupos = gruposEnMemoria.map(grupo => ({
                valor: grupo.id,
                etiqueta: `${grupo.nombreGrupo} (${grupo.encargado})`
            }));

            ModuloSeguridad.poblarSelectSeguro(
                selectGrupo,
                'Toca para elegir grupo...',
                opcionesGrupos
            );

            // Limpiamos el PIN de la vista y mostramos la selección de grupo y nombre
            inputPin.value = '';
            bloquePin.classList.add('hidden');
            bloqueSeleccionPerfil.classList.remove('hidden');
            subtituloConfig.textContent = 'Elige tu grupo y tu nombre para dirigir tu informe al encargado correcto.';
        } catch {
            errorPin.textContent = 'No se pudo conectar. Revisa tu internet e intenta nuevamente.';
            errorPin.classList.remove('hidden');
        } finally {
            btnVerificarPin.disabled = false;
            btnVerificarPin.textContent = 'Ingresar';
        }
    };

    btnVerificarPin.addEventListener('click', verificarPinEnServidor);
    inputPin.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            verificarPinEnServidor();
        }
    });

    // --- PASO B: CARGAR NOMBRES SEGÚN EL GRUPO ---
    selectGrupo.addEventListener('change', () => {
        const grupoEncontrado = gruposEnMemoria.find(g => g.id === selectGrupo.value);
        if (grupoEncontrado && Array.isArray(grupoEncontrado.hermanos)) {
            const opcionesHermanos = grupoEncontrado.hermanos.map(h => ({
                valor: h,
                etiqueta: h
            }));
            ModuloSeguridad.poblarSelectSeguro(
                selectNombre,
                'Toca para elegir tu nombre...',
                opcionesHermanos
            );
            selectNombre.disabled = false;
            selectNombre.classList.remove('bg-gray-100');
            selectNombre.classList.add('bg-gray-50');
        }
    });

    // --- GUARDAR PERFIL (SOLO DEL USUARIO ACTUAL) ---
    btnGuardarPerfil.addEventListener('click', () => {
        if (!selectGrupo.value || !selectNombre.value) {
            errorConfiguracion.textContent = 'Debes elegir tu grupo y tu nombre para continuar.';
            errorConfiguracion.classList.remove('hidden');
            return;
        }

        if (!checkConsentimiento.checked) {
            errorConfiguracion.textContent = 'Por favor, marca la casilla de consentimiento para continuar.';
            errorConfiguracion.classList.remove('hidden');
            return;
        }

        const perfilValido = ModuloSeguridad.validarSeleccionContraServidor(
            gruposEnMemoria,
            selectGrupo.value,
            selectNombre.value,
            checkConsentimiento.checked
        );

        if (!perfilValido) {
            errorConfiguracion.textContent = 'Selección no válida. Intenta nuevamente.';
            errorConfiguracion.classList.remove('hidden');
            return;
        }

        errorConfiguracion.classList.add('hidden');
        try {
            localStorage.setItem(ModuloSeguridad.CLAVE_STORAGE, JSON.stringify(perfilValido));
        } catch {}

        // Limpiamos la lista completa de la memoria RAM por privacidad
        gruposEnMemoria = [];
        ModuloSeguridad.poblarSelectSeguro(selectGrupo, 'Toca para elegir grupo...', []);
        ModuloSeguridad.poblarSelectSeguro(selectNombre, 'Primero elige tu grupo...', []);

        cargarEstadoInicial();
    });

    // --- CAMBIO DE USUARIO ---
    btnCambiarUsuario.addEventListener('click', () => {
        modalCambioUsuario.classList.remove('hidden');
        modalCambioUsuario.classList.add('flex');
    });

    btnCancelarCambio.addEventListener('click', () => {
        modalCambioUsuario.classList.add('hidden');
        modalCambioUsuario.classList.remove('flex');
    });

    btnConfirmarCambio.addEventListener('click', () => {
        try {
            localStorage.removeItem(ModuloSeguridad.CLAVE_STORAGE);
            localStorage.removeItem('perfilPublicador');
            localStorage.removeItem('nombrePublicador');
        } catch {}

        gruposEnMemoria = [];
        inputPin.value = '';
        errorPin.classList.add('hidden');
        errorConfiguracion.classList.add('hidden');
        checkConsentimiento.checked = false;

        ModuloSeguridad.poblarSelectSeguro(selectGrupo, 'Toca para elegir grupo...', []);
        ModuloSeguridad.poblarSelectSeguro(selectNombre, 'Primero elige tu grupo...', []);
        selectNombre.disabled = true;
        selectNombre.classList.remove('bg-gray-50');
        selectNombre.classList.add('bg-gray-100');

        bloqueSeleccionPerfil.classList.add('hidden');
        bloquePin.classList.remove('hidden');
        subtituloConfig.textContent = 'Ingresa la clave de tu congregación para cargar la lista de grupos.';

        cargarEstadoInicial();
        modalCambioUsuario.classList.add('hidden');
        modalCambioUsuario.classList.remove('flex');
    });

    // Modal de ayuda PWA
    btnAbrirInstalar.addEventListener('click', () => {
        modalInstalar.classList.remove('hidden');
        modalInstalar.classList.add('flex');
    });
    btnCerrarInstalar.addEventListener('click', () => {
        modalInstalar.classList.add('hidden');
        modalInstalar.classList.remove('flex');
    });

    // --- CONTADORES ---
    const actualizarCursosUI = () => {
        cursosCount = ModuloSeguridad.sanitizarEntero(cursosCount, 0, 99);
        displayCursos.textContent = String(cursosCount);
        btnMenosCursos.classList.toggle('text-gray-400', cursosCount === 0);
        btnMenosCursos.classList.toggle('text-gray-900', cursosCount > 0);
    };
    btnMenosCursos.addEventListener('click', () => { if (cursosCount > 0) { cursosCount--; actualizarCursosUI(); } });
    btnMasCursos.addEventListener('click', () => { cursosCount++; actualizarCursosUI(); });

    const actualizarHorasUI = (valorStr) => {
        const valor = ModuloSeguridad.sanitizarEntero(valorStr, 0, 744);
        inputHoras.value = String(valor);
        btnMenosHoras.classList.toggle('text-gray-400', valor === 0);
        btnMenosHoras.classList.toggle('text-gray-900', valor > 0);
    };
    btnMenosHoras.addEventListener('click', () => {
        const actual = ModuloSeguridad.sanitizarEntero(inputHoras.value, 0, 744);
        if (actual > 0) actualizarHorasUI(actual - 1);
    });
    btnMasHoras.addEventListener('click', () => {
        const actual = ModuloSeguridad.sanitizarEntero(inputHoras.value, 0, 744);
        actualizarHorasUI(actual + 1);
    });
    inputHoras.addEventListener('change', (e) => actualizarHorasUI(e.target.value));

    checkPrecursor.addEventListener('change', (e) => {
        if (e.target.checked) {
            seccionHoras.classList.remove('hidden');
            seccionHoras.classList.add('flex');
            actualizarHorasUI(0);
        } else {
            seccionHoras.classList.add('hidden');
            seccionHoras.classList.remove('flex');
        }
    });

    // --- ENVÍO SEGURO A WHATSAPP ---
    const formatearMes = (valorMes) => {
        if (!ModuloSeguridad.esMesValido(valorMes)) return '-';
        const [year, month] = valorMes.split('-');
        const fecha = new Date(Number(year), Number(month) - 1);
        return fecha.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase());
    };

    btnRevisar.addEventListener('click', () => {
        const perfil = obtenerPerfilSeguro();
        if (!perfil) return;

        const horasSeguras = ModuloSeguridad.sanitizarEntero(inputHoras.value, 0, 744);
        inputHoras.value = String(horasSeguras);

        document.getElementById('res-nombre').textContent = perfil.nombre;
        document.getElementById('res-encargado').textContent = perfil.encargado;
        document.getElementById('res-mes').textContent = formatearMes(inputMes.value);
        document.getElementById('res-participo').textContent = checkParticipo.checked ? 'Sí' : 'No';
        document.getElementById('res-cursos').textContent = String(cursosCount);

        const resHorasCont = document.getElementById('res-horas-container');
        if (checkPrecursor.checked) {
            resHorasCont.classList.remove('hidden');
            document.getElementById('res-horas').textContent = String(horasSeguras);
        } else {
            resHorasCont.classList.add('hidden');
        }

        modalConfirmacion.classList.remove('hidden');
        modalConfirmacion.classList.add('flex');
    });

    btnCancelar.addEventListener('click', () => {
        modalConfirmacion.classList.add('hidden');
        modalConfirmacion.classList.remove('flex');
    });

    const construirUrlWhatsAppSegura = () => {
        const perfil = obtenerPerfilSeguro();
        if (!perfil || !ModuloSeguridad.esTelefonoValido(perfil.telefono)) return '#';

        const mesLegible = formatearMes(inputMes.value);
        const participoTexto = checkParticipo.checked ? 'Sí' : 'No';
        const horasSeguras = ModuloSeguridad.sanitizarEntero(inputHoras.value, 0, 744);

        let mensaje = `*Informe de Predicación*\n`;
        mensaje += `------------------------\n`;
        mensaje += `*Publicador:* ${perfil.nombre}\n`;
        mensaje += `*Grupo:* ${perfil.nombreGrupo}\n`;
        mensaje += `*Mes:* ${mesLegible}\n`;
        mensaje += `*Participó en la predicación:* ${participoTexto}\n`;
        mensaje += `*Cursos bíblicos:* ${cursosCount}\n`;

        if (checkPrecursor.checked) {
            mensaje += `*Precursor:* Sí\n`;
            mensaje += `*Horas:* ${horasSeguras}\n`;
        }

        const textoCodificado = encodeURIComponent(mensaje);
        return `https://wa.me/${perfil.telefono}?text=${textoCodificado}`;
    };

    btnConfirmarEnviar.addEventListener('click', () => {
        const urlWhatsApp = construirUrlWhatsAppSegura();
        if (urlWhatsApp === '#') return;

        linkWhatsappRespaldo.href = urlWhatsApp;
        window.open(urlWhatsApp, '_blank', 'noopener,noreferrer');

        modalConfirmacion.classList.add('hidden');
        modalConfirmacion.classList.remove('flex');
        modalExito.classList.remove('hidden');
        modalExito.classList.add('flex');
    });

    btnCerrarExito.addEventListener('click', () => {
        modalExito.classList.add('hidden');
        modalExito.classList.remove('flex');

        checkParticipo.checked = true;
        cursosCount = 0;
        actualizarCursosUI();

        checkPrecursor.checked = false;
        checkPrecursor.dispatchEvent(new Event('change'));

        window.scrollTo(0, 0);
    });
});

