import { LightningElement, track } from 'lwc';
import { subscribe, unsubscribe, onError } from 'lightning/empApi';
import obtenerDireccionDesdeCoordenadas from '@salesforce/apex/UbicacionController.obtenerDireccionDesdeCoordenadas';
import { loadScript, loadStyle } from 'lightning/platformResourceLoader';
import LEAFLET from '@salesforce/resourceUrl/leaflet';

export default class UbicacionRastreadorGerente extends LightningElement {
    subscription = {};
    channelName = '/event/Ubicacion_Event__e';

    @track usuarios = [];
    map;
    usuariosMapa = new Map();
    leafletInitialized = false;

    connectedCallback() {
        onError(error => console.error('EMP API error', error));
        this.handleSubscribe();
    }

    disconnectedCallback() {
        this.handleUnsubscribe();
    }

    renderedCallback() {
        if (this.leafletInitialized) return;
        this.leafletInitialized = true;

        Promise.all([
            loadScript(this, LEAFLET + '/leaflet.js'),
            loadStyle(this, LEAFLET + '/leaflet.css')
        ])
        .then(() => {
            const mapContainer = this.template.querySelector('.map-container');
            this.map = L.map(mapContainer).setView([0, 0], 2);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(this.map);
        })
        .catch(error => {
            console.error('Error al cargar Leaflet:', error);
        });
    }

    handleSubscribe() {
        const messageCallback = (response) => {
            const payload = response.data.payload;
            const lat = parseFloat(payload.Lat__c);
            const lon = parseFloat(payload.Lon__c);
            const usuarioId = payload.UsuarioId__c;
            const fecha = payload.Fecha__c;
            const usuarioNombre = payload.UsuarioNombre__c || payload.VendedorNombre__c || usuarioId;

            this.actualizarMarcadores(usuarioId, usuarioNombre, lat, lon, fecha);
        };

        subscribe(this.channelName, -1, messageCallback).then(response => {
            this.subscription = response;
            console.log('Suscrito a ' + this.channelName);
        });
    }

    async actualizarMarcadores(usuarioId, usuarioNombre, lat, lon, fecha) {
        let direccion = `Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}`;
        try {
            const direccionObtenida = await obtenerDireccionDesdeCoordenadas({ lat, lon });
            if (direccionObtenida) {
                direccion = direccionObtenida;
            }
        } catch (error) {
            console.error('Error al obtener dirección desde Apex:', error);
        }

        // Eliminar marcador anterior si ya existe
        if (this.usuariosMapa.has(usuarioId)) {
            const anterior = this.usuariosMapa.get(usuarioId);
            if (anterior.marker) {
                this.map.removeLayer(anterior.marker);
            }
        }

        // Crear nuevo marcador
        const marker = L.marker([lat, lon])
            .addTo(this.map)
            .bindPopup(`<b>${usuarioNombre}</b><br>${direccion}<br>${new Date(fecha).toLocaleString()}`);

        this.usuariosMapa.set(usuarioId, {
            nombre: usuarioNombre,
            ubicacion: direccion,
            fecha: new Date(fecha).toLocaleString(),
            marker
        });

        // Actualizar tabla
        this.usuarios = Array.from(this.usuariosMapa.entries()).map(([id, u]) => ({
            id,
            nombre: u.nombre,
            ubicacion: u.ubicacion,
            fecha: u.fecha
        }));

        /* // Centrar el mapa en la posición promedio
        const allCoords = Array.from(this.usuariosMapa.values()).map(u => u.marker.getLatLng());
        if (allCoords.length > 0) {
            const avgLat = allCoords.reduce((sum, c) => sum + c.lat, 0) / allCoords.length;
            const avgLon = allCoords.reduce((sum, c) => sum + c.lng, 0) / allCoords.length;
            this.map.setView([avgLat, avgLon], 10);
        } */
    }

    handleUnsubscribe() {
        unsubscribe(this.subscription, response => {
            console.log('Desuscrito de ' + this.channelName);
        });
    }
}
