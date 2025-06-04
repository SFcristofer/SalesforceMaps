import { LightningElement, track } from 'lwc';
import obtenerUltimasUbicaciones from '@salesforce/apex/UbicacionController.obtenerUltimasUbicaciones';

import { subscribe, unsubscribe, onError } from 'lightning/empApi';

export default class UbicacionesGerente extends LightningElement {
    @track mapMarkers = [];
    @track vendedores = [];
    @track center = { latitude: 0, longitude: 0 };

    columns = [
        { label: 'Nombre', fieldName: 'nombre' },
        { label: 'Ubicación', fieldName: 'ubicacion' },
        { label: 'Hora', fieldName: 'hora' },
        {
            type: 'button-icon',
            fixedWidth: 40,
            typeAttributes: {
                iconName: 'utility:preview',
                name: 'ver_mapa',
                title: 'Ver en mapa',
                variant: 'bare'
            }
        }
    ];


    subscription = {};
    channelName = '/event/Ubicacion_Event__e';

    intervalId;

    connectedCallback() {

        this.cargarUbicaciones();
        this.iniciarSuscripcion();

        // Opcional: actualizar histórico cada cierto tiempo
        this.intervalId = setInterval(() => {
            this.cargarUbicaciones();
        }, 1000); // 1 minuto
    }

    disconnectedCallback() {
        clearInterval(this.intervalId);
        this.cancelarSuscripcion();
    }

    async cargarUbicaciones() {
        try {
            const ubicaciones = await obtenerUltimasUbicaciones();

            this.vendedores = ubicaciones.map(u => ({
                id: u.Vendedor__c,
                userId: u.Vendedor__c,
                nombre: u.Vendedor__r.Name,
                ubicacion: `${u.Ubicacion__Latitude__s.toFixed(5)}, ${u.Ubicacion__Longitude__s.toFixed(5)}`,
                hora: new Date(u.Fecha__c).toLocaleString(),
                lat: u.Ubicacion__Latitude__s,
                lon: u.Ubicacion__Longitude__s
            }));

            this.actualizarMapa([...this.vendedores]); // fuerza nueva referencia


        } catch (error) {
            console.error('Error cargando ubicaciones:', error);
        }
    }

    actualizarMapa(vendedores) {
        this.mapMarkers = vendedores.map(v => ({
            location: {
                Latitude: v.lat,
                Longitude: v.lon
            },
            title: v.nombre,
            description: `Fecha: ${v.hora}`
        }));

        if (this.mapMarkers.length > 0) {
            this.center = this.mapMarkers[0].location;
        }
    }

    iniciarSuscripcion() {
        subscribe(this.channelName, -1, message => {
            const payload = message.data.payload;
            const lat = parseFloat(payload.Lat__c);
            const lon = parseFloat(payload.Lon__c);
            const userId = payload.UserId__c;

            // Buscar si ya está el vendedor en la lista
            const index = this.vendedores.findIndex(v => v.userId === userId);

            const nuevaUbicacion = {
                id: userId,
                userId: userId,
                nombre: `Vendedor ${userId.substring(0, 5)}`, // Idealmente reemplaza con nombre real si lo tienes
                ubicacion: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
                hora: new Date().toLocaleString(),
                lat: lat,
                lon: lon
            };

            let updated = [...this.vendedores];
            if (index !== -1) {
                updated[index] = nuevaUbicacion;
            } else {
                updated.push(nuevaUbicacion);
            }
            this.vendedores = updated;
            this.actualizarMapa(this.vendedores);


        }).then(response => {
            this.subscription = response;
            console.log('Suscrito al canal EMP:', response.channel);
        }).catch(error => {
            console.error('Error al suscribirse al canal EMP:', error);
        });
    }


    cancelarSuscripcion() {
        unsubscribe(this.subscription, response => {
            console.log('Desuscrito del canal:', response);
        });
    }

    handleRowAction(event) {
        const row = event.detail.row;
        this.center = {
            latitude: row.lat,
            longitude: row.lon
        };
    }
}
