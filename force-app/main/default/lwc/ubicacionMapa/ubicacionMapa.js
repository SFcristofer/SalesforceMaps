import { LightningElement, wire } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';
import obtenerUltimaUbicacion from '@salesforce/apex/UbicacionController.obtenerUltimaUbicacion';

export default class UbicacionMapa extends LightningElement {
    userId;
    mapMarkers = [];
    center;

    @wire(CurrentPageReference)
    getStateParameters(currentPageReference) {
        if (currentPageReference) {
            this.userId = currentPageReference.attributes.recordId;
            this.cargarUbicacion();
        }
    }

    cargarUbicacion() {
        if (!this.userId) return;

        obtenerUltimaUbicacion({ userId: this.userId })
            .then((ubicacion) => {
                if (ubicacion?.Ubicacion__Latitude__s && ubicacion?.Ubicacion__Longitude__s) {
                    const lat = ubicacion.Ubicacion__Latitude__s;
                    const lon = ubicacion.Ubicacion__Longitude__s;

                    this.mapMarkers = [{
                        location: {
                            Latitude: lat,
                            Longitude: lon
                        },
                        title: "Última ubicación",
                        description: `Fecha: ${ubicacion.Fecha__c}`
                    }];

                    this.center = {
                        latitude: lat,  // ✅ minúsculas
                        longitude: lon
                    };
                }
            })
            .catch(error => {
                console.error('Error al obtener ubicación:', error);
            });
    }
}
