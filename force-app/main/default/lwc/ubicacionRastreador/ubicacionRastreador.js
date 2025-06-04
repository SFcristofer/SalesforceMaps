import { LightningElement, track, wire } from 'lwc';
import guardarUbicacion from '@salesforce/apex/UbicacionController.guardarUbicacion';
import obtenerUltimaUbicacion from '@salesforce/apex/UbicacionController.obtenerUltimaUbicacion';
import { CurrentPageReference } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import obtenerDireccionDesdeCoordenadas from '@salesforce/apex/UbicacionController.obtenerDireccionDesdeCoordenadas';
import enviarEventoUbicacion from '@salesforce/apex/UbicacionEventPublisher.enviarEventoUbicacion';
import { loadScript, loadStyle } from 'lightning/platformResourceLoader';
import LEAFLET from '@salesforce/resourceUrl/leaflet';

export default class UbicacionRastreador extends LightningElement {
    @track lat;
    @track lon;
    @track lastUpdated;
    @track locationName;
    @track mapMarkers = [];
    @track center;
    @track ultimaLat;
    @track ultimaLon;
    @track tiempoParado = 0;
    intervaloVerificacion;
    tiempoMaximoParado = 60;

    userId;
    watchId;
    mapInitialized = false;
    map; // Referencia al mapa Leaflet
    marker; // Referencia al marcador actual

    @wire(CurrentPageReference)
    wiredPageRef(currentPageReference) {
        if (currentPageReference?.attributes?.recordId) {
            this.userId = currentPageReference.attributes.recordId;
            this.cargarUltimaUbicacion();
        }
    }

    connectedCallback() {
        if (navigator.geolocation) {
            this.watchId = navigator.geolocation.watchPosition(
                async position => {
                    this.lat = position.coords.latitude;
                    this.lon = position.coords.longitude;
                    this.lastUpdated = new Date().toLocaleString();

                    this.locationName = await this.obtenerNombreUbicacion(this.lat, this.lon);
                    this.actualizarMapa(this.lat, this.lon, this.lastUpdated);

                    if (this.lat !== this.ultimaLat || this.lon !== this.ultimaLon) {
                        this.ultimaLat = this.lat;
                        this.ultimaLon = this.lon;
                        this.tiempoParado = 0;
                    } else {
                        this.tiempoParado += 1;
                    }

                    if (
                        this.lat != null && this.lon != null &&
                        !isNaN(this.lat) && !isNaN(this.lon) &&
                        this.lat !== 0 && this.lon !== 0
                    ) {
                        enviarEventoUbicacion({ lat: this.lat, lon: this.lon, userId: this.userId })
                            .then(() => {
                                // Evento enviado correctamente
                            })
                            .catch(error => {
                                console.error('Error enviando evento de ubicación:', error);
                            });
                    }

                    /*
                    if (this.tiempoParado >= this.tiempoMaximoParado) {
                        this.mostrarToast(
                            'Detenido',
                            `Has estado detenido por más de ${this.tiempoMaximoParado} segundos. Se guardará tu ubicación.`,
                            'info'
                        );

                        guardarUbicacion({ lat: this.lat, lon: this.lon })
                            .then(() => {
                                this.mostrarToast('Ubicación guardada', 'Ubicación guardada automáticamente tras estar detenido.', 'success');
                            })
                            .catch(error => {
                                this.mostrarToast('Error', 'No se pudo guardar la ubicación automáticamente.', 'error');
                                console.error('Error al guardar ubicación:', error);
                            });

                        this.tiempoParado = 0;
                    }
                    */
                },
                error => {
                    console.error('Error obteniendo ubicación', error);
                },
                {
                    enableHighAccuracy: true,
                    maximumAge: 0,
                    timeout: 5000
                }
            );

            this.intervaloVerificacion = setInterval(() => {
                if (this.watchId === null) return;
                navigator.geolocation.getCurrentPosition(() => { }, () => { });
            }, 5000);
        } else {
            this.mostrarToast('Error', 'Geolocalización no soportada por el navegador.', 'error');
        }
    }

    disconnectedCallback() {
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
        }
        if (this.intervaloVerificacion) {
            clearInterval(this.intervaloVerificacion);
        }
    }

    cargarUltimaUbicacion() {
        if (!this.userId) return;

        obtenerUltimaUbicacion({ userId: this.userId })
            .then(async ubicacion => {
                if (ubicacion?.Ubicacion__Latitude__s && ubicacion?.Ubicacion__Longitude__s) {
                    const lat = ubicacion.Ubicacion__Latitude__s;
                    const lon = ubicacion.Ubicacion__Longitude__s;
                    const fecha = new Date(ubicacion.Fecha__c).toLocaleString();

                    this.lat = lat;
                    this.lon = lon;
                    this.lastUpdated = fecha;

                    this.locationName = await this.obtenerNombreUbicacion(lat, lon);
                    this.actualizarMapa(lat, lon, fecha);
                }
            })
            .catch(error => {
                this.mostrarToast('Error', 'No se pudo obtener la última ubicación.', 'error');
                console.error('Error al obtener ubicación:', error);
            });
    }

    actualizarMapa(lat, lon, fecha) {
        if (!this.map) return;

        if (this.marker) {
            this.map.removeLayer(this.marker);
        }

        this.marker = L.marker([lat, lon])
            .addTo(this.map)
            .bindPopup(`Fecha: ${fecha}`)
            .openPopup();

        this.map.setView([lat, lon], 15);
    }

    async obtenerNombreUbicacion(lat, lon) {
        try {
            const direccion = await obtenerDireccionDesdeCoordenadas({ lat, lon });
            return direccion;
        } catch (error) {
            console.error('Error al obtener dirección desde Apex:', error);
            return 'Error al obtener dirección';
        }
    }

    guardarUbicacionManual() {
        if (this.lat && this.lon) {
            guardarUbicacion({ lat: this.lat, lon: this.lon })
                .then(() => {
                    this.mostrarToast('Ubicación guardada', 'La ubicación fue guardada manualmente.', 'success');
                })
                .catch(error => {
                    this.mostrarToast('Error', 'No se pudo guardar la ubicación.', 'error');
                    console.error('Error al guardar ubicación manual:', error);
                });
        } else {
            this.mostrarToast('Ubicación no disponible', 'No se puede guardar la ubicación actual.', 'warning');
        }
    }

    mostrarToast(titulo, mensaje, variante) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: titulo,
                message: mensaje,
                variant: variante,
                mode: 'dismissable'
            })
        );
    }

    calcularDistanciaEnMetros(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Radio de la Tierra en metros
        const rad = Math.PI / 180;
        const φ1 = lat1 * rad;
        const φ2 = lat2 * rad;
        const Δφ = (lat2 - lat1) * rad;
        const Δλ = (lon2 - lon1) * rad;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }

    renderedCallback() {
        if (this.mapInitialized) return;
        this.mapInitialized = true;

        Promise.all([
            loadScript(this, LEAFLET + '/leaflet.js'),
            loadStyle(this, LEAFLET + '/leaflet.css')
        ])
        .then(() => {
            const mapContainer = this.template.querySelector('.map');
            this.map = L.map(mapContainer).setView([20.6597, -103.3496], 13);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(this.map);
        })
        .catch(error => {
            console.error('Error al cargar Leaflet:', error);
        });
    }
}
